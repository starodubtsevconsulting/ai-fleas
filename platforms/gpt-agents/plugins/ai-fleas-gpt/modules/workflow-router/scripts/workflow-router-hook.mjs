import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WorkflowTransitionPacket } from './workflow-transition-packet.mjs';

const COORDINATES = ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScopeId'];
const RESULT_FIELDS = new Set(['acknowledgement', 'correlationId', 'stage', 'role', 'event', 'references']);

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function dataPath() {
  const root = process.env.PLUGIN_DATA;
  if (!root) return null;
  return path.join(root, 'bindings.json');
}

function readRegistry() {
  const file = dataPath();
  return file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function readBinding(registry, sessionId) {
  const binding = registry.sessions?.[sessionId];
  return binding?.status === 'active' ? binding : null;
}

function workflowKey(scope) {
  return COORDINATES.map((key) => scope[key]).join(':');
}

function scopeText(binding) {
  return COORDINATES.map((key) => `${key}=${binding.scope[key]}`).join(', ');
}

function correlationPath(sessionId) {
  const root = process.env.PLUGIN_DATA;
  return root && sessionId ? path.join(root, 'correlations', `${sessionId}.json`) : null;
}

function promptDigest(prompt) {
  return createHash('sha256').update(String(prompt ?? '')).digest('hex');
}

function lifecycleControlPath(sessionId) {
  const root = process.env.PLUGIN_DATA;
  return root && sessionId ? path.join(root, 'lifecycle-controls', `${sessionId}.json`) : null;
}

function lifecycleTurnPath(sessionId) {
  const root = process.env.PLUGIN_DATA;
  return root && sessionId ? path.join(root, 'lifecycle-turns', `${sessionId}.json`) : null;
}

function workflowDispatchControlPath(sessionId, digest) {
  const root = process.env.PLUGIN_DATA;
  return root && sessionId && digest
    ? path.join(root, 'workflow-dispatch-controls', sessionId, `${digest}.json`)
    : null;
}

function readJson(file) {
  try {
    return file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
}

function consumeLifecycleControl(input) {
  const permitFile = lifecycleControlPath(input.session_id);
  const permit = readJson(permitFile);
  if (!permit) return null;
  if (Date.parse(permit.expiresAt) <= Date.now()) {
    fs.rmSync(permitFile, { force: true });
    return null;
  }
  const digest = promptDigest(input.prompt);
  if (permit.promptSha256 !== digest) return null;
  const turn = {
    action: permit.action,
    expectedReadiness: permit.expectedReadiness,
    promptSha256: digest,
    turnId: input.turn_id ?? null,
    expiresAt: permit.expiresAt,
  };
  const turnFile = lifecycleTurnPath(input.session_id);
  atomicWrite(turnFile, turn);
  fs.rmSync(permitFile, { force: true });
  return turn;
}

function activeLifecycleTurn(input) {
  const file = lifecycleTurnPath(input.session_id);
  const turn = readJson(file);
  if (!turn) return null;
  if (Date.parse(turn.expiresAt) <= Date.now()) {
    fs.rmSync(file, { force: true });
    return null;
  }
  if (turn.turnId && input.turn_id && turn.turnId !== input.turn_id) return null;
  return turn;
}

function lifecycleContext(binding, turn) {
  return [
    'AI_FLEAS_LIFECYCLE_CONTROL',
    `This is a host-authorized one-shot ${turn.action} turn for the exact ${binding.role} endpoint at ${scopeText(binding)}.`,
    'This turn is lifecycle control, not workflow ingress. Do not emit WORKFLOW_ROUTER_RESULT and do not dispatch another endpoint.',
    `After verifying the requested lifecycle state, return exactly ${turn.expectedReadiness}.`,
  ].join('\n');
}

function persistCorrelation(sessionId, value) {
  if (!sessionId || !value) return null;
  const file = correlationPath(sessionId);
  if (file) atomicWrite(file, { correlationId: value });
  return value;
}

function allocateCorrelation(input) {
  if (!input.session_id) return null;
  const digest = promptDigest(input.prompt).slice(0, 20);
  const value = input.turn_id
    ? `codex:${input.session_id}:${input.turn_id}`
    : `codex:${input.session_id}:prompt-${digest}`;
  return persistCorrelation(input.session_id, value);
}

function expectedCorrelation(input) {
  const file = correlationPath(input.session_id);
  if (file && fs.existsSync(file)) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')).correlationId;
    if (value) return value;
  }
  return input.turn_id ? `codex:${input.session_id}:${input.turn_id}` : null;
}

function registeredWorkflow(registry, binding) {
  return registry.workflows?.[workflowKey(binding.scope)] ?? null;
}

function roleStages(workflow, role) {
  return Object.entries(workflow?.stages ?? {})
    .filter(([, stage]) => stage.role === role)
    .map(([stageId, stage]) => `${stageId}${stage.capability ? ` (capability: ${stage.capability})` : ''}`);
}

function parseWorkflowDispatch(prompt) {
  const lines = String(prompt ?? '').split('\n');
  if (lines[0] !== 'WORKFLOW_ROUTER_DISPATCH' || lines.length < 3) return null;
  try {
    return JSON.parse(lines.slice(2).join('\n'));
  } catch {
    return null;
  }
}

function validWorkflowDispatchPacket(packet, binding, workflow) {
  if (!packet || typeof packet.correlationId !== 'string' || !packet.correlationId) return false;
  if (COORDINATES.some((field) => packet[field] !== binding.scope[field])) return false;
  if (packet.to?.role !== binding.role || workflow?.stages?.[packet.to?.stage]?.role !== binding.role) return false;
  if (!packet.from?.stage || !packet.from?.role || !packet.from?.event) return false;
  if (!Array.isArray(packet.references) || packet.references.some((reference) => {
    const keys = Object.keys(reference ?? {});
    return !reference?.kind || !reference?.ref || keys.some((key) => !['kind', 'ref'].includes(key));
  })) return false;
  return true;
}

function consumeWorkflowDispatch(input, binding, workflow) {
  const digest = promptDigest(input.prompt);
  const permitFile = workflowDispatchControlPath(input.session_id, digest);
  const permit = readJson(permitFile);
  if (!permit) return null;
  if (Date.parse(permit.expiresAt) <= Date.now()) {
    fs.rmSync(permitFile, { force: true });
    return null;
  }
  const packet = parseWorkflowDispatch(input.prompt);
  const validPermit = permit.promptSha256 === digest
    && permit.correlationId === packet?.correlationId
    && permit.targetStage === packet?.to?.stage
    && permit.targetRole === packet?.to?.role;
  fs.rmSync(permitFile, { force: true });
  return validPermit && validWorkflowDispatchPacket(packet, binding, workflow) ? packet : null;
}

function context(binding, routerCorrelation, workflow, dispatchPacket = null) {
  const stages = roleStages(workflow, binding.role);
  return [
    'WORKFLOW_ROUTER_BOUND_TASK',
    `This task is the exact ${binding.role} endpoint for ${scopeText(binding)}.`,
    `Authoritative workflow: ${binding.workflowSource}.`,
    `Owned capabilities: ${(binding.capabilities ?? []).join(', ') || '(none)'}.`,
    `Registered stage IDs for this role: ${stages.join(', ') || '(none)'}. Return a stage ID, never a capability name.`,
    dispatchPacket
      ? `This is a host-authorized routed transition to stage "${dispatchPacket.to.stage}". Continue that assigned stage using only the packet's durable references and your bound workflow instructions.`
      : 'A direct human request is workflow ingress. Perform work only when this endpoint owns the requested capability; otherwise return event "route-required" without doing substitute work.',
    'Do not contact another endpoint. The hidden host Router observes the terminal result and owns every transition and dispatch.',
    routerCorrelation ? `Router-owned correlationId for this turn: ${routerCorrelation}. Preserve it byte-for-byte.` : null,
    'End every completed workflow turn with a WORKFLOW_ROUTER_RESULT JSON object containing only acknowledgement, correlationId, stage, role, event, and references.',
    'The acknowledgement must be exactly "COPY THAT"; preserve Router-supplied correlationId, stage, and role byte-for-byte. References contain only {"kind","ref"}.',
    'Every cross-endpoint reference must resolve to a durable artifact the recipient can open without reading this task history. Conversation-only reports and synthetic identifiers are invalid.',
  ].filter(Boolean).join('\n');
}

function extractResult(message) {
  if (typeof message !== 'string') return null;
  const marker = 'WORKFLOW_ROUTER_RESULT';
  const markerIndex = message.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const tail = message.slice(markerIndex + marker.length);
  const fenced = tail.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? tail;
  const start = source.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(source.slice(start).trim());
  } catch {
    return null;
  }
}

function validateResult(binding, routerCorrelation, result) {
  if (!result || Object.keys(result).some((field) => !RESULT_FIELDS.has(field))) {
    return 'The terminal WORKFLOW_ROUTER_RESULT is missing, malformed, or contains fields outside the result envelope.';
  }
  if (result.acknowledgement !== 'COPY THAT') return 'acknowledgement must be exactly "COPY THAT".';
  if (routerCorrelation && result.correlationId !== routerCorrelation) {
    return `correlationId must preserve the Router-owned value "${routerCorrelation}" byte-for-byte.`;
  }
  if (!result.correlationId || !result.stage || result.role !== binding.role || !result.event) {
    return `The result must contain a nonempty correlationId, stage, event, and role exactly "${binding.role}".`;
  }
  if (!Array.isArray(result.references) || result.references.some((reference) => {
    const keys = Object.keys(reference ?? {});
    return !reference?.kind || !reference?.ref || keys.some((key) => !['kind', 'ref'].includes(key));
  })) return 'references must be an array containing only {"kind","ref"} objects.';
  return null;
}

function dispatchIdentity(result) {
  return createHash('sha256')
    .update(JSON.stringify([result.correlationId, result.stage, result.event, result.references]))
    .digest('hex');
}

function dispatchReceiptPath(result) {
  const root = process.env.PLUGIN_DATA;
  return root ? path.join(root, 'dispatches', `${dispatchIdentity(result)}.json`) : null;
}

function dispatchJobPath(result) {
  const root = process.env.PLUGIN_DATA;
  return root ? path.join(root, 'dispatch-jobs', `${dispatchIdentity(result)}.json`) : null;
}

function atomicWrite(file, value, exclusive = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (exclusive) {
    fs.writeFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: 'wx' });
    return;
  }
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function retryProgress(result, policy) {
  const kinds = policy?.progressReferenceKinds;
  const maximum = policy?.maxSameProgressAttempts;
  const requireChangedProgress = policy?.requireChangedProgress === true;
  const hasAttemptLimit = Number.isInteger(maximum) && maximum > 0;
  if (!Array.isArray(kinds) || !kinds.length || (!requireChangedProgress && !hasAttemptLimit)) return null;
  const references = result.references.filter(({ kind }) => kinds.includes(kind));
  if (references.length !== kinds.length || kinds.some((kind) => !references.some((reference) => reference.kind === kind))) {
    return null;
  }
  return { maximum: hasAttemptLimit ? maximum : null, requireChangedProgress, references };
}

function previousProgressAttempts(packet, progress) {
  const root = process.env.PLUGIN_DATA;
  const directory = root && path.join(root, 'dispatches');
  if (!directory || !fs.existsSync(directory)) return 0;
  const expectedReferences = JSON.stringify(progress.references);
  let attempts = 0;
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith('.json')) continue;
    try {
      const receipt = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      if (!receipt.targetSessionId || receipt.loopBlocked || receipt.unchangedProgress) continue;
      if (!['queued', 'started', 'completed'].includes(receipt.deliveryStatus)) continue;
      if (COORDINATES.some((field) => receipt[field] !== packet[field])) continue;
      if (receipt.to?.stage !== packet.to.stage) continue;
      const references = (receipt.references ?? []).filter(({ kind }) =>
        progress.references.some((expected) => expected.kind === kind));
      if (JSON.stringify(references) === expectedReferences) attempts += 1;
    } catch {
      // Ignore unrelated or incomplete receipts; they cannot prove a prior successful attempt.
    }
  }
  return attempts;
}

function route(registry, binding, result) {
  const workflow = registry.workflows?.[workflowKey(binding.scope)];
  if (!workflow) return { error: `No host Router workflow registration exists for ${workflowKey(binding.scope)}.` };
  const stage = workflow.stages?.[result.stage];
  if (!stage || stage.role !== binding.role) {
    return { error: `Stage "${result.stage}" is not owned by role "${binding.role}" in the host Router registry.` };
  }
  const transition = stage.transitions?.[result.event];
  if (!transition) return { error: `Event "${result.event}" is not declared from stage "${result.stage}".` };
  const referenceKinds = new Set(result.references.map(({ kind }) => kind));
  const missing = (transition.requiredReferenceKinds ?? []).filter((kind) => !referenceKinds.has(kind));
  if (missing.length) return { error: `Transition ${result.stage}/${result.event} requires references: ${missing.join(', ')}.` };
  if (transition.terminal) return { terminal: true };
  const targetStage = workflow.stages?.[transition.to];
  const targetRole = targetStage?.role;
  if (!targetStage || !targetRole) {
    return { error: `Transition target "${transition.to}" has no declared owner.` };
  }
  if (transition.waitForHuman) {
    return { waitingForHuman: true, targetStage: transition.to, targetRole, retryPolicy: transition.retryPolicy };
  }
  const targetSessionId = targetRole && workflow.endpoints?.[targetRole];
  if (!targetSessionId) {
    return { error: `Transition target "${transition.to}" has no registered role endpoint.` };
  }
  return { targetStage: transition.to, targetRole, targetSessionId, retryPolicy: transition.retryPolicy };
}

function dispatch(registry, binding, result) {
  const resolved = route(registry, binding, result);
  if (resolved.error || resolved.terminal) return resolved;
  const receiptFile = dispatchReceiptPath(result);
  if (receiptFile && fs.existsSync(receiptFile)) return { ...resolved, duplicate: true };
  const legacyDigest = createHash('sha256')
    .update(`${result.correlationId}\0${result.stage}\0${result.event}`)
    .digest('hex');
  const legacyReceipt = readJson(process.env.PLUGIN_DATA
    ? path.join(process.env.PLUGIN_DATA, 'dispatches', `${legacyDigest}.json`) : null);
  if (legacyReceipt && JSON.stringify(legacyReceipt.references) === JSON.stringify(result.references)) {
    return { ...resolved, duplicate: true };
  }
  const packet = {
    correlationId: result.correlationId,
    profileId: binding.scope.profileId,
    workflowId: binding.scope.workflowId,
    logicalProjectId: binding.scope.logicalProjectId,
    runtimeScopeId: binding.scope.runtimeScopeId,
    from: { stage: result.stage, role: result.role, event: result.event },
    to: { stage: resolved.targetStage, role: resolved.targetRole },
    references: result.references,
  };
  if (resolved.waitingForHuman) {
    if (receiptFile) {
      fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
      fs.writeFileSync(receiptFile, `${JSON.stringify({ ...packet, waitingForHuman: true })}\n`, { mode: 0o600, flag: 'wx' });
    }
    return resolved;
  }
  const progress = retryProgress(result, resolved.retryPolicy);
  if (progress) {
    const previousAttempts = previousProgressAttempts(packet, progress);
    if (progress.requireChangedProgress && previousAttempts > 0) {
      if (receiptFile) {
        fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
        fs.writeFileSync(receiptFile, `${JSON.stringify({
          ...packet,
          unchangedProgress: true,
          deliveryStatus: 'not-dispatched',
          progressReferences: progress.references,
        })}\n`, { mode: 0o600, flag: 'wx' });
      }
      return { ...resolved, unchangedProgress: true, progressReferences: progress.references };
    }
    const attempt = previousAttempts + 1;
    if (progress.maximum && attempt >= progress.maximum) {
      if (receiptFile) {
        fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
        fs.writeFileSync(receiptFile, `${JSON.stringify({
          ...packet,
          loopBlocked: true,
          sameProgressAttempt: attempt,
          maxSameProgressAttempts: progress.maximum,
          progressReferences: progress.references,
        })}\n`, { mode: 0o600, flag: 'wx' });
      }
      return { ...resolved, loopBlocked: true, attempt, maximum: progress.maximum };
    }
  }
  const message = new WorkflowTransitionPacket(packet).toCodexTaskMessage();
  if (process.env.WORKFLOW_ROUTER_QUEUE_LOG) {
    fs.appendFileSync(process.env.WORKFLOW_ROUTER_QUEUE_LOG, `${JSON.stringify({ thread: resolved.targetSessionId, message })}\n`);
    if (receiptFile) atomicWrite(receiptFile, {
      ...packet,
      targetSessionId: resolved.targetSessionId,
      deliveryStatus: 'started',
    }, true);
  } else {
    if (!receiptFile) return { error: 'Host Router has no plugin data path for a delivery receipt.' };
    const jobFile = dispatchJobPath(result);
    atomicWrite(receiptFile, {
      ...packet,
      targetSessionId: resolved.targetSessionId,
      deliveryStatus: 'pending',
      requestedAt: new Date().toISOString(),
    }, true);
    atomicWrite(jobFile, {
      packet,
      receiptFile,
      targetSessionId: resolved.targetSessionId,
      dataRoot: process.env.PLUGIN_DATA,
      codexBin: process.env.CODEX_BIN ?? 'codex',
    });
    try {
      const worker = spawn(process.execPath, [
        fileURLToPath(new URL('./workflow-router-dispatch-worker.mjs', import.meta.url)),
        jobFile,
      ], { detached: true, stdio: 'ignore', env: process.env });
      worker.unref();
    } catch (error) {
      atomicWrite(receiptFile, {
        ...packet,
        targetSessionId: resolved.targetSessionId,
        deliveryStatus: 'failed',
        deliveryError: error.message,
      });
      return { error: `Host Router could not start the dispatcher: ${error.message}` };
    }
  }
  return { ...resolved, deliveryStatus: process.env.WORKFLOW_ROUTER_QUEUE_LOG ? 'started' : 'pending' };
}

function emit(value = {}) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const input = readInput();
const registry = readRegistry();
const binding = registry && readBinding(registry, input.session_id);
if (!binding) {
  emit();
} else if (input.hook_event_name === 'SessionStart') {
  emit({
    hookSpecificOutput: {
      hookEventName: input.hook_event_name,
      additionalContext: context(binding, null, registeredWorkflow(registry, binding)),
    },
  });
} else if (input.hook_event_name === 'UserPromptSubmit') {
  const lifecycleTurn = consumeLifecycleControl(input);
  if (lifecycleTurn) {
    emit({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: lifecycleContext(binding, lifecycleTurn),
      },
    });
  } else {
    const workflow = registeredWorkflow(registry, binding);
    const dispatchPacket = consumeWorkflowDispatch(input, binding, workflow);
    const routerCorrelation = dispatchPacket
      ? persistCorrelation(input.session_id, dispatchPacket.correlationId)
      : allocateCorrelation(input);
    emit({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: context(binding, routerCorrelation, workflow, dispatchPacket),
      },
    });
  }
} else if (input.hook_event_name === 'Stop') {
  const lifecycleTurn = activeLifecycleTurn(input);
  if (lifecycleTurn) {
    if (String(input.last_assistant_message ?? '').trim() === lifecycleTurn.expectedReadiness) {
      fs.rmSync(lifecycleTurnPath(input.session_id), { force: true });
      emit();
    } else if (input.stop_hook_active) {
      emit({ systemMessage: `Lifecycle readiness remains invalid: return exactly ${lifecycleTurn.expectedReadiness}.` });
    } else {
      emit({
        decision: 'block',
        reason: `Lifecycle control requires the exact readiness token ${lifecycleTurn.expectedReadiness}. Return only that token now.`,
      });
    }
  } else {
    const result = extractResult(input.last_assistant_message);
    const problem = validateResult(binding, expectedCorrelation(input), result);
    if (!problem) {
      const resolved = route(registry, binding, result);
      if (resolved.error && !input.stop_hook_active) {
        const stages = roleStages(registeredWorkflow(registry, binding), binding.role).join(', ');
        emit({
          decision: 'block',
          reason: `Workflow Router transition is invalid: ${resolved.error}\nReturn one corrected terminal WORKFLOW_ROUTER_RESULT using a registered stage ID (${stages}) and an event declared from that stage.`,
        });
      } else if (resolved.error) {
        emit({ systemMessage: `Workflow Router transition remains invalid: ${resolved.error}` });
      } else {
        const outcome = dispatch(registry, binding, result);
        if (outcome.error) {
          emit({ systemMessage: `Workflow Router dispatch failed: ${outcome.error}` });
        } else if (outcome.waitingForHuman) {
          emit({ systemMessage: `Workflow Router paused at ${outcome.targetStage}; human input is required before routing continues.` });
        } else if (outcome.loopBlocked) {
          emit({
            systemMessage: `Workflow Router stopped a non-progress loop after ${outcome.attempt} attempts with the same declared progress references. Produce a new revision or request human intervention before routing continues.`,
          });
        } else if (outcome.unchangedProgress) {
          emit({
            systemMessage: 'Workflow Router did not dispatch the next endpoint because the declared progress references are unchanged.',
          });
        } else if (outcome.deliveryStatus === 'pending') {
          emit({ systemMessage: `Workflow Router started delivery to ${outcome.targetRole}; completion requires an observed turn.started receipt.` });
        } else {
          emit();
        }
      }
    } else if (input.stop_hook_active) {
      emit({ systemMessage: `Workflow Router result remains invalid: ${problem}` });
    } else {
      emit({
        decision: 'block',
        reason: `${problem}\nReturn one corrected terminal WORKFLOW_ROUTER_RESULT now. Do not contact another endpoint or invent a route; the hidden Router will observe it.`,
      });
    }
  }
} else {
  emit();
}
