const EXCEPTION_EVENTS = new Set(['blocked', 'depleted', 'unclear']);
const COORDINATES = ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScopeId'];
const EVENT_FIELDS = new Set(['scope', 'type', 'expectedStage', 'references']);
const RESULT_FIELDS = new Set(['acknowledgement', 'correlationId', 'stage', 'role', 'event', 'references']);
const HUMAN_ENTRY_FIELDS = new Set(['scope', 'capability', 'correlationId', 'recipient', 'references']);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function exactScope(expected, actual) {
  for (const field of COORDINATES) {
    if (!actual?.[field] || actual[field] !== expected[field]) {
      fail('BLOCKED_ROUTER_SCOPE', `Router scope mismatch: ${field}`);
    }
  }
}

function referencesOnly(references = []) {
  if (!Array.isArray(references)) fail('BLOCKED_ROUTER_EVENT', 'references must be an array');
  return references.map((reference) => {
    const keys = Object.keys(reference ?? {});
    if (!reference?.kind || !reference?.ref || keys.some((key) => !['kind', 'ref'].includes(key))) {
      fail('BLOCKED_ROUTER_ARTIFACT_BODY', 'Router accepts only { kind, ref } references');
    }
    return { kind: reference.kind, ref: reference.ref };
  });
}

function validateStage(definition, stageId) {
  const stage = definition.stages?.[stageId];
  if (!stage?.role || !stage?.capability) {
    fail('BLOCKED_ROUTER_DEFINITION', `Stage ${stageId} requires role and capability`);
  }
  if (definition.capabilityOwners?.[stage.capability] !== stage.role) {
    fail('BLOCKED_ROUTER_CAPABILITY', `Role ${stage.role} does not own ${stage.capability}`);
  }
  return stage;
}

function stageForCapability(definition, capability) {
  if (!capability || !definition.capabilityOwners?.[capability]) {
    fail('BLOCKED_ROUTER_ENTRY_CAPABILITY', 'Human entry requires a workflow-declared capability');
  }
  const matches = Object.entries(definition.stages ?? {})
    .filter(([, stage]) => stage.capability === capability);
  if (matches.length !== 1) {
    fail('BLOCKED_ROUTER_ENTRY_AMBIGUOUS', `Capability ${capability} must resolve to exactly one workflow stage`);
  }
  const [entry] = matches;
  return { stageId: entry[0], stage: validateStage(definition, entry[0]) };
}

export function validateEndpointResult(expected, result) {
  if (!result || Object.keys(result).some((field) => !RESULT_FIELDS.has(field))) {
    fail('BLOCKED_ROUTER_RESULT', 'Endpoint result contains fields outside the result envelope');
  }
  if (result.acknowledgement !== 'COPY THAT') {
    fail('BLOCKED_ROUTER_ACKNOWLEDGEMENT', 'Endpoint must acknowledge the exact stage envelope');
  }
  for (const field of ['correlationId', 'stage', 'role']) {
    if (!expected?.[field] || result[field] !== expected[field]) {
      fail('BLOCKED_ROUTER_RESULT_IDENTITY', `Endpoint result mismatch: ${field}`);
    }
  }
  if (!result.event) fail('BLOCKED_ROUTER_RESULT', 'Endpoint result requires an event');
  return {
    acknowledgement: result.acknowledgement,
    correlationId: result.correlationId,
    stage: result.stage,
    role: result.role,
    event: result.event,
    references: referencesOnly(result.references),
  };
}

export function createWorkflowRuntime(definition, identity, entry = {}) {
  exactScope(definition.scope, identity);
  if (!definition.source || !definition.initialStage || !definition.stages?.[definition.initialStage]) {
    fail('BLOCKED_ROUTER_DEFINITION', 'Runtime definition requires source, initialStage, and declared stages');
  }
  for (const stageId of Object.keys(definition.stages)) validateStage(definition, stageId);

  const initialStage = entry.stage ?? definition.initialStage;
  const initialStageDefinition = validateStage(definition, initialStage);
  if (entry.role && entry.role !== initialStageDefinition.role) {
    fail('BLOCKED_ROUTER_ENTRY_ROLE', 'Entry role does not own the selected workflow stage');
  }

  const state = {
    routerRuntimeId: identity.routerRuntimeId,
    ...Object.fromEntries(COORDINATES.map((field) => [field, identity[field]])),
    currentStage: initialStage,
    assignedRole: initialStageDefinition.role,
    assignedInstanceId: entry.instanceId ?? null,
    status: 'active',
    resumeStage: null,
    references: [],
    history: [],
  };

  function transition(event) {
    exactScope(state, event.scope);
    if (Object.keys(event).some((field) => !EVENT_FIELDS.has(field))) {
      fail('BLOCKED_ROUTER_ARTIFACT_BODY', 'Router event contains fields outside the transition envelope');
    }
    if (!event.type || event.expectedStage !== state.currentStage) {
      fail('BLOCKED_ROUTER_STALE_EVENT', 'Event must name the exact current stage');
    }

    const fromStage = state.currentStage;
    const fromRole = state.assignedRole;
    const exception = EXCEPTION_EVENTS.has(event.type);
    const rule = exception
      ? definition.exceptionTransitions?.[event.type]
      : definition.stages[fromStage].transitions?.[event.type];
    if (!rule || !definition.stages[rule.to]) {
      fail('BLOCKED_ROUTER_TRANSITION', `No declared ${event.type} transition from ${fromStage}`);
    }

    const references = referencesOnly(event.references);
    for (const requiredKind of rule.requiredReferenceKinds ?? []) {
      if (!references.some(({ kind }) => kind === requiredKind)) {
        fail('BLOCKED_ROUTER_REFERENCE', `Missing required reference: ${requiredKind}`);
      }
    }

    state.currentStage = rule.to;
    state.assignedRole = validateStage(definition, rule.to).role;
    state.status = exception
      ? 'exception'
      : (rule.terminal ? 'completed' : (rule.waitForHuman ? 'waiting-human' : 'active'));
    state.resumeStage = exception ? fromStage : null;
    state.references = references;
    state.history.push({
      sequence: state.history.length + 1,
      event: event.type,
      fromStage,
      toStage: state.currentStage,
      fromRole,
      toRole: state.assignedRole,
      disposition: state.status,
      exception,
    });
    return snapshot();
  }

  function snapshot() {
    return structuredClone(state);
  }

  async function route(event, adapter) {
    if (!adapter?.resolveRole || !adapter?.dispatch) {
      fail('BLOCKED_ROUTER_ADAPTER', 'Runtime adapter must resolve roles and dispatch handoffs');
    }
    const previous = snapshot();
    const advanced = transition(event);
    if (advanced.status === 'waiting-human') {
      state.assignedInstanceId = null;
      return snapshot();
    }
    try {
      const recipient = await adapter.resolveRole({
        scope: Object.fromEntries(COORDINATES.map((field) => [field, state[field]])),
        role: advanced.assignedRole,
      });
      exactScope(state, recipient);
      if (!recipient.instanceId || recipient.role !== advanced.assignedRole) {
        fail('BLOCKED_ROUTER_IDENTITY', 'Resolved instance does not match the workflow-assigned role');
      }
      await adapter.dispatch({
        targetInstanceId: recipient.instanceId,
        requiredExecutionRole: recipient.role,
        stage: advanced.currentStage,
        references: advanced.references,
        scope: Object.fromEntries(COORDINATES.map((field) => [field, state[field]])),
      });
      state.assignedInstanceId = recipient.instanceId;
      return snapshot();
    } catch (error) {
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, previous);
      throw error;
    }
  }

  return { route, transition, snapshot };
}

export async function createHumanEntryRuntime(definition, identity, input, adapter) {
  exactScope(definition.scope, identity);
  exactScope(definition.scope, input?.scope);
  if (!input || Object.keys(input).some((field) => !HUMAN_ENTRY_FIELDS.has(field))) {
    fail('BLOCKED_ROUTER_ENTRY', 'Human entry contains fields outside the entry envelope');
  }
  if (!input.correlationId || !input.recipient?.instanceId || !input.recipient?.role) {
    fail('BLOCKED_ROUTER_ENTRY_IDENTITY', 'Human entry requires correlation and exact recipient identity');
  }
  exactScope(definition.scope, input.recipient);

  const references = referencesOnly(input.references);
  const { stageId, stage } = stageForCapability(definition, input.capability);
  const ownedByRecipient = input.recipient.role === stage.role;
  if (ownedByRecipient) {
    const runtime = createWorkflowRuntime(definition, identity, {
      stage: stageId,
      role: stage.role,
      instanceId: input.recipient.instanceId,
    });
    return {
      disposition: 'accepted-by-recipient',
      correlationId: input.correlationId,
      references,
      runtime,
      snapshot: runtime.snapshot(),
    };
  }

  if (!adapter?.resolveRole || !adapter?.dispatch) {
    fail('BLOCKED_ROUTER_ADAPTER', 'Runtime adapter must resolve roles and dispatch routed human entry');
  }
  const recipient = await adapter.resolveRole({ scope: input.scope, role: stage.role });
  exactScope(definition.scope, recipient);
  if (!recipient.instanceId || recipient.role !== stage.role) {
    fail('BLOCKED_ROUTER_IDENTITY', 'Resolved entry instance does not match the workflow capability owner');
  }
  await adapter.dispatch({
    targetInstanceId: recipient.instanceId,
    requiredExecutionRole: recipient.role,
    correlationId: input.correlationId,
    stage: stageId,
    references,
    scope: input.scope,
  });
  const runtime = createWorkflowRuntime(definition, identity, {
    stage: stageId,
    role: recipient.role,
    instanceId: recipient.instanceId,
  });
  return {
    disposition: 'routed-to-owner',
    correlationId: input.correlationId,
    references,
    runtime,
    snapshot: runtime.snapshot(),
  };
}
