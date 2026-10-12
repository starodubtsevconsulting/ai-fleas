#!/usr/bin/env node
/** Controller-owned exact Governor INIT audit, invoked by a native dynamic tool after preflight.
 * Inputs: authenticated native tool request and bounded summary; output: verified worker findings.
 * Effects: one inference-only ephemeral worker and a locked audit receipt. No task creation,
 * ordinary work, persistent children, credentials, or readiness self-certification.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import YAML from 'yaml';
import { buildGovernorInitialization, hostTaskState } from './initialize-governor.mjs';
import { withGovernorRegistryLock } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/governor-registry-lock.mjs';

const fail = reason => { throw new Error(reason); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function runGovernorInitAudit({ callerTaskId, registryFile, summary, client, callId = randomUUID(), phase = 'activation', expectedPrompt }, {
  io = fs, worker, preflight = buildGovernorInitialization, hostState = hostTaskState,
  now = Date.now,
} = {}) {
  if (!callerTaskId || typeof summary !== 'string' || !summary.trim() || summary.length > 12000)
    fail('GOVERNOR_AUDIT_INPUT_INVALID');
  const read = () => JSON.parse(io.readFileSync(registryFile, 'utf8'));
  const registry = read();
  const binding = registry.instances?.[callerTaskId];
  const init = binding?.initialization;
  const welcome = phase === 'welcome';
  if (!['activation', 'welcome'].includes(phase)) fail('GOVERNOR_AUDIT_PHASE_INVALID');
  const auditTurnId = welcome ? init?.welcome?.turnId : init?.turnId;
  const auditExpiry = welcome ? Date.parse(init?.welcome?.requestedAt) + 600000 : Date.parse(init?.expiresAt);
  const priorAudit = welcome ? init?.welcome?.audit : init?.audit;
  const lifecycleVerified = welcome
    ? binding?.status === 'active' && init?.audit?.verdict === 'pass' && init.audit.workerClosed === true
      && init.audit.exitCode === 0 && init.audit.generation === binding.generation
      && init.completedTurnId === init.audit.turnId
      && init.welcome?.status === 'inProgress' && init.welcome.requestId && expectedPrompt
    : binding?.status === 'pending' && init?.nonce && init.startedAt
      && Object.values(registry.instances).filter(item => item.initialization?.nonce === init.nonce).length === 1;
  if (binding?.agentId !== 'personal-governor' || binding.platformAdapter !== 'codex-app'
    || !lifecycleVerified || binding.scope?.kind !== 'governed-human'
    || init?.auditTransport !== 'ephemeral-process' || !auditTurnId
    || !Number.isInteger(binding.generation) || binding.generation < 1
    || !Number.isFinite(auditExpiry) || auditExpiry <= now() || priorAudit)
    fail('GOVERNOR_AUDIT_BINDING_UNVERIFIED');
  const humanDir = path.dirname(init.sources?.find(source => source.id === 'human-profile')?.ref || '');
  if (!path.isAbsolute(humanDir)) fail('GOVERNOR_AUDIT_HUMAN_UNVERIFIED');
  const canonical = preflight(humanDir, binding.scope.humanProfileId, binding.generation);
  if (!same(canonical.binding.initialization.sources, init.sources)
    || canonical.binding.initialization.memoryBinding !== init.memoryBinding
    || (!welcome && init.promptSha256 !== createHash('sha256').update(canonical.prompt).digest('hex')))
    fail('GOVERNOR_AUDIT_CANONICAL_SOURCES_CHANGED');
  const governorRef = init.sources.find(source => source.id === 'human-governor')?.ref;
  const governor = YAML.parse(io.readFileSync(governorRef, 'utf8'));
  const utilities = governor.platformBindings?.['codex-app']?.utilitySubagents;
  const route = utilities?.routing?.boundedAnalysis;
  if (utilities?.enabled !== true || typeof route?.model !== 'string' || !route.model || typeof route.reasoning !== 'string' || !route.reasoning
    || (/-sol(?:$|-)/.test(route.model) && route.reasoning !== 'low'))
    fail('GOVERNOR_AUDIT_MODEL_BINDING_INVALID');
  const host = await hostState(client, callerTaskId);
  const parent = (await client.request('thread/read', { threadId: callerTaskId, includeTurns: true }))?.thread;
  const turns = parent?.turns?.filter(turn => turn.id === auditTurnId);
  const userText = turns?.[0]?.items?.find(item => item.type === 'userMessage')?.content
    ?.filter(part => part.type === 'text').map(part => part.text).join('');
  if (!host || host.archived || host.task.projectId != null || parent?.id !== callerTaskId
    || parent.projectId != null || parent.status?.type !== 'active'
    || io.realpathSync(parent.cwd) !== io.realpathSync(humanDir)
    || turns?.length !== 1 || turns[0].status !== 'inProgress' || userText !== (welcome ? expectedPrompt : canonical.prompt))
    fail('GOVERNOR_AUDIT_HOST_UNVERIFIED');
  const verifySingleton = current => {
  const competing = Object.entries(current.instances).some(([id, item]) => id !== callerTaskId
    && id !== binding.replaces?.taskId && item.agentId === 'personal-governor'
    && item.scope?.humanProfileId === binding.scope.humanProfileId && ['active', 'pending'].includes(item.status));
  if (competing) fail('GOVERNOR_AUDIT_COMPETING_BINDING');
  if (binding.replaces) {
    const replacement = binding.replaces, previous = current.instances[replacement.taskId];
    if (replacement.strategy !== 'successor-first' || replacement.taskId === callerTaskId
      || !['active', 'archived'].includes(previous?.status) || previous.agentId !== 'personal-governor'
      || previous.platformAdapter !== 'codex-app' || previous.generation !== replacement.generation
      || !same(previous.scope, binding.scope)) fail('GOVERNOR_AUDIT_PREDECESSOR_UNVERIFIED');
  }
  };
  verifySingleton(registry);
  if (binding.replaces) {
    const predecessor = await hostState(client, binding.replaces.taskId);
    if (!predecessor || predecessor.task.projectId != null
      || predecessor.archived !== (registry.instances[binding.replaces.taskId].status === 'archived'))
      fail('GOVERNOR_AUDIT_PREDECESSOR_UNVERIFIED');
  }
  const writeExact = (expected, audit) => withGovernorRegistryLock(registryFile, () => {
    const fresh = read();
    verifySingleton(fresh);
    if (!same(fresh.instances?.[callerTaskId], expected) || auditExpiry <= now())
      fail('GOVERNOR_AUDIT_BINDING_CHANGED');
    if (welcome) fresh.instances[callerTaskId].initialization.welcome.audit = audit;
    else fresh.instances[callerTaskId].initialization.audit = audit;
    const temporary = `${registryFile}.${process.pid}.audit.tmp`;
    io.writeFileSync(temporary, JSON.stringify(fresh, null, 2) + '\n', { mode: 0o600 });
    io.renameSync(temporary, registryFile);
    return structuredClone(fresh.instances[callerTaskId]);
  }, { io });
  const reserved = writeExact(binding, { transport: 'ephemeral-process', callId,
    turnId: auditTurnId, generation: binding.generation, verdict: 'running' });
  const role = init.sources.find(source => source.id === 'portable-role');
  const result = await worker.run({ cwd: humanDir, model: route.model, reasoning: route.reasoning,
    evidence: { role: 'personal-governor', scope: binding.scope, selectedPlatform: 'codex-app',
      effectiveModel: route.model, reasoning: route.reasoning, parentPreflightSummary: summary,
      canonicalContracts: [role, init.sources.find(source => source.id === 'gpt-initializer')]
        .map(source => ({ id: source.id, text: io.readFileSync(source.ref, 'utf8') })),
      canonicalSourceReferences: init.sources, memoryBinding: init.memoryBinding,
      controllerVerifiedHostEvidence: { taskId: parent.id, projectId: parent.projectId,
        humanDirectoryMatches: true, unarchived: true, inProgressInitTurnId: auditTurnId, lifecyclePhase: phase,
        exactPromptMatches: true, uniqueUnexpiredPermit: !welcome, verifiedWelcomeRequest: welcome, canonicalPreflightPassed: true },
      auditTransport: 'controller-owned ephemeral inference process; no persistent child, tools or workflow role',
    } });
  if (result.workerClosed !== true || result.exitCode !== 0 || !result.workerThreadId
    || !['pass', 'blocked'].includes(result.result?.verdict))
    fail('GOVERNOR_AUDIT_RELEASE_UNVERIFIED');
  const latestHost = await hostState(client, callerTaskId);
  const latestParent = (await client.request('thread/read', { threadId: callerTaskId, includeTurns: true }))?.thread;
  if (!latestHost || latestHost.archived || latestHost.task.projectId != null
    || latestParent?.id !== callerTaskId || latestParent.projectId != null
    || latestParent.turns?.filter(turn => turn.id === auditTurnId && turn.status === 'inProgress').length !== 1)
    fail('GOVERNOR_AUDIT_PARENT_CHANGED');
  if (binding.replaces) {
    const predecessor = await hostState(client, binding.replaces.taskId);
    const latestRegistry = read();
    if (!predecessor || predecessor.task.projectId != null
      || predecessor.archived !== (latestRegistry.instances[binding.replaces.taskId]?.status === 'archived'))
      fail('GOVERNOR_AUDIT_PREDECESSOR_UNVERIFIED');
  }
  preflight(humanDir, binding.scope.humanProfileId, binding.generation);
  const audit = { ...(welcome ? reserved.initialization.welcome.audit : reserved.initialization.audit), workerThreadId: result.workerThreadId,
    workerClosed: true, exitCode: 0, verdict: result.result.verdict, completedAt: new Date(now()).toISOString() };
  writeExact(reserved, audit);
  return { audit, result: result.result };
}

const controllerRegistrations = new WeakMap();

/** Replace only our own handler when verified activation transitions to welcome. */
export function releaseGovernorAuditController(client) {
  controllerRegistrations.get(client)?.();
}

export function registerGovernorAuditController(client, controller) {
  if (controllerRegistrations.has(client)) fail('GOVERNOR_AUDIT_CONTROLLER_ALREADY_OWNED');
  const unregister = client.registerServerRequestHandler('item/tool/call', request => controller.handle(request));
  const release = () => {
    unregister();
    if (controllerRegistrations.get(client) === release) controllerRegistrations.delete(client);
  };
  controllerRegistrations.set(client, release);
  return release;
}

export const governorInitAuditTool = {
  type: 'function', name: 'ai_fleas_governor_init_audit',
  description: 'Run the mandatory Governor INIT audit after reading and verifying the canonical sources. The controller owns one tool-disabled worker and verifies its exit before returning findings.',
  inputSchema: { type: 'object', additionalProperties: false,
    properties: { summary: { type: 'string', minLength: 1, maxLength: 12000 } }, required: ['summary'] },
};

/** Only the exact native request on the verified controller connection can select a task/turn. */
export class GovernorInitAuditController {
  constructor(client, { taskId, binding, registryFile, worker, io = fs, runAudit = runGovernorInitAudit, phase = 'activation', expectedPrompt }) {
    this.client = client; this.taskId = taskId; this.binding = binding;
    this.registryFile = registryFile; this.worker = worker; this.io = io; this.runAudit = runAudit;
    this.phase = phase; this.expectedPrompt = expectedPrompt;
    this.used = false;
  }
  async handle(request) {
    const params = request.params;
    if (request.method !== 'item/tool/call' || params?.tool !== governorInitAuditTool.name
      || params.namespace != null || params.threadId !== this.taskId || !params.turnId || !params.callId)
      fail('GOVERNOR_AUDIT_NATIVE_REQUEST_INVALID');
    const args = typeof params.arguments === 'string' ? JSON.parse(params.arguments) : params.arguments;
    if (!args || Object.keys(args).length !== 1 || typeof args.summary !== 'string')
      fail('GOVERNOR_AUDIT_INPUT_INVALID');
    const current = JSON.parse(this.io.readFileSync(this.registryFile, 'utf8')).instances?.[this.taskId];
    if (current?.generation !== this.binding.generation || (this.phase === 'welcome' ? current.initialization?.welcome?.turnId : current.initialization?.turnId) !== params.turnId
      || !same(current.scope, this.binding.scope)
      || !same(current.initialization.sources, this.binding.initialization.sources) || this.used)
      fail('GOVERNOR_AUDIT_NATIVE_BINDING_UNVERIFIED');
    this.used = true;
    const result = await this.runAudit({ callerTaskId: params.threadId, callId: params.callId,
      registryFile: this.registryFile, summary: args.summary, client: this.client, phase: this.phase, expectedPrompt: this.expectedPrompt },
    { io: this.io, worker: this.worker });
    return { success: true, contentItems: [{ type: 'inputText', text: JSON.stringify({ ...result,
      instruction: this.phase === 'welcome'
        ? 'Verify these findings for this separate welcome INIT. The worker exited; report actual limitations. Do not emit the activation token or claim this audit certifies later daily INIT.'
        : 'Verify these findings. The one-shot utility worker has exited. Emit readiness only for a passed audit; do not spawn a persistent child or claim full END.' }) }] };
  }
}
