const EXCEPTION_EVENTS = new Set(['blocked', 'depleted', 'unclear']);
const COORDINATES = ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScopeId'];
const EVENT_FIELDS = new Set(['scope', 'type', 'expectedStage', 'references']);
const RESULT_FIELDS = new Set(['acknowledgement', 'correlationId', 'stage', 'role', 'event', 'references']);

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

export function createWorkflowRuntime(definition, identity) {
  exactScope(definition.scope, identity);
  if (!definition.source || !definition.initialStage || !definition.stages?.[definition.initialStage]) {
    fail('BLOCKED_ROUTER_DEFINITION', 'Runtime definition requires source, initialStage, and declared stages');
  }
  for (const stageId of Object.keys(definition.stages)) validateStage(definition, stageId);

  const state = {
    routerRuntimeId: identity.routerRuntimeId,
    ...Object.fromEntries(COORDINATES.map((field) => [field, identity[field]])),
    currentStage: definition.initialStage,
    assignedRole: definition.stages[definition.initialStage].role,
    assignedInstanceId: null,
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
    state.status = exception ? 'exception' : (rule.terminal ? 'completed' : 'active');
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
