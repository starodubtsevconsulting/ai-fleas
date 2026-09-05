import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

export function normalizeRoutableRole(roleLabel, manifest = loadWorkflowAgents()) {
  if (!nonEmpty(roleLabel)) throw new Error('BLOCKED_EXECUTION_ROLE_MISMATCH');
  const normalized = roleLabel.trim().toLowerCase();
  const role = Object.values(manifest.agents)
    .find(({ aliases }) => aliases.includes(normalized))?.agentId;
  if (!role) throw new Error('BLOCKED_EXECUTION_ROLE_MISMATCH');
  return role;
}

const DIRECT_PROCESS_EXECUTION_ROLES = new Set(['command-runner']);

/**
 * Fail-closed authorization for an ordinary process launch. `trustedActorRole`
 * must come from initialized runtime/session identity, never from packet prose
 * or caller-controlled tool input.
 */
export function commandExecutionDecision({ actorRole, trustedActorRole, registeredRoute }) {
  const manifest = loadWorkflowAgents();
  let actor;
  let trustedActor;
  try {
    actor = normalizeRoutableRole(actorRole, manifest);
    trustedActor = normalizeRoutableRole(trustedActorRole, manifest);
  } catch {
    throw new Error('BLOCKED_EXECUTION_ROLE_MISMATCH');
  }
  if (actor !== trustedActor) throw new Error('BLOCKED_EXECUTION_ROLE_MISMATCH');
  if (!nonEmpty(registeredRoute)) throw new Error('BLOCKED_UNREGISTERED_COMMAND_ROUTE');
  if (!DIRECT_PROCESS_EXECUTION_ROLES.has(trustedActor)) {
    throw new Error(`BLOCKED_${trustedActor.replace(/\s*\/\s*|\s+/gu, '_').toUpperCase()}_DIRECT_COMMAND_EXECUTION`);
  }
  return `COMMAND_EXECUTION_ALLOWED:${trustedActor}:${registeredRoute}`;
}

export function resolveExactRoutableTask({ targetTaskId, requiredExecutionRole, registry, profileId, workflowId,
  logicalProjectId, runtimeProjectId }) {
  const manifest = loadWorkflowAgents();
  const role = normalizeRoutableRole(requiredExecutionRole, manifest);
  if (!nonEmpty(targetTaskId) || !Array.isArray(registry)) throw new Error('BLOCKED_EXECUTION_ROLE_MISMATCH');
  const matches = registry.filter((task) => task.taskId === targetTaskId
    && normalizeRoutableRole(task.role, manifest) === role
    && task.profileId === profileId && task.workflowId === workflowId
    && task.logicalProjectId === logicalProjectId && task.runtimeProjectId === runtimeProjectId
    && task.active === true && task.visible === true && task.initialized === true);
  if (matches.length !== 1) throw new Error('BLOCKED_EXECUTION_ROLE_MISMATCH');
  return { taskId: matches[0].taskId, role };
}

export function profileConfigurationTargetDecision({ actorRole, profileId, profileRoot, targetPath,
  directHumanAdminRequest = false, targetProfileId }) {
  if (![profileId, profileRoot, targetPath].every(nonEmpty) || !path.isAbsolute(profileRoot)
    || !path.isAbsolute(targetPath)) throw new Error('BLOCKED_PROFILE_CONFIGURATION_BOUNDARY');
  const normalizedRoot = path.resolve(profileRoot);
  const normalizedTarget = path.resolve(targetPath);
  const relative = path.relative(normalizedRoot, normalizedTarget);
  const contained = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  if (actorRole === 'admin') {
    if (!directHumanAdminRequest || !nonEmpty(targetProfileId) || path.basename(normalizedRoot) !== targetProfileId
      || !contained) throw new Error('BLOCKED_ADMIN_PROFILE_CONFIGURATION_BOUNDARY');
    return `ADMIN_PROFILE_CONFIGURATION_TARGET:${targetProfileId}`;
  }
  if (!['designer / reviewer', 'coder'].includes(actorRole) || path.basename(normalizedRoot) !== profileId
    || !contained || (nonEmpty(targetProfileId) && targetProfileId !== profileId)) {
    throw new Error('BLOCKED_PROFILE_CONFIGURATION_BOUNDARY');
  }
  return `PROFILE_CONFIGURATION_TARGET:${profileId}`;
}

const AGENTS_MANIFEST_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../agents.yml');
const TEAM_POLICY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'team.md');

function loadCsvRows(csvPath, columns, headerError, rowError, duplicateError, key) {
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const [header, ...rows] = content.split(/\r?\n/);
  if (header !== columns.join(',')) throw new Error(headerError);
  const result = {};
  for (const row of rows) {
    const values = row.split(',');
    if (values.length !== columns.length || values.some((value) => !nonEmpty(value))) throw new Error(rowError);
    const entry = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    if (result[entry[key]]) throw new Error(duplicateError);
    result[entry[key]] = entry;
  }
  return result;
}

export function loadWorkflowAgents(manifestPath = AGENTS_MANIFEST_PATH) {
  let manifest;
  try {
    manifest = parseYaml(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST_PARSE');
  }
  if (manifest?.schemaVersion !== 'workflow-agents.v1' || !nonEmpty(manifest.workflowId)
    || manifest.harness !== undefined || !nonEmpty(manifest.logicalProjectIdPattern)
    || !Array.isArray(manifest.agents) || manifest.agents.length === 0) {
    throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST');
  }
  const policyFields = ['authority', 'routing', 'elasticPool'];
  const initializerFields = ['agentId', 'roleClass', 'agentName', 'roleDefinition', 'title', 'model', 'reasoning', 'lifecycle',
    'humanFacing', 'communicationMode', 'readinessToken'];
  if (policyFields.some((field) => !nonEmpty(manifest.policy?.[field]))
    || initializerFields.some((field) => !nonEmpty(manifest.initializer?.[field]))
    || manifest.initializer.agentId !== 'admin' || manifest.initializer.roleClass !== 'Admin'
    || !manifest.initializer.roleDefinition.startsWith('../_common/roles/')) {
    throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST');
  }
  const required = ['agentId', 'roleClass', 'agentName', 'roleDefinition', 'title', 'model', 'reasoning', 'lifecycle',
    'humanFacing', 'communicationMode', 'readinessToken'];
  const agents = {};
  const agentNames = new Set();
  const aliases = new Set();
  for (const agent of manifest.agents) {
    if (!agent || required.some((field) => !nonEmpty(agent[field]))
      || !agent.roleDefinition.startsWith('../_common/roles/')
      || agent.workflowBinding !== undefined
      || typeof agent.requiresTicket !== 'boolean' || !Array.isArray(agent.aliases) || agent.aliases.length === 0
      || agent.aliases.some((alias) => !nonEmpty(alias) || alias !== alias.trim().toLowerCase() || aliases.has(alias))
      || new Set(agent.aliases).size !== agent.aliases.length || !agent.aliases.includes(agent.agentId)
      || agents[agent.agentId] || agentNames.has(agent.agentName)) {
      throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST_AGENT');
    }
    if (agent.execution !== undefined && (agent.execution?.mode !== 'proxy'
      || !nonEmpty(agent.execution.bridge) || !nonEmpty(agent.execution.target))) {
      throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST_AGENT_EXECUTION');
    }
    agents[agent.agentId] = { ...agent };
    agentNames.add(agent.agentName);
    agent.aliases.forEach((alias) => aliases.add(alias));
  }
  const dependencyKinds = new Set(['capability-provider', 'return-coordinator']);
  const dependencies = [];
  const dependencyKeys = new Set();
  if (!Array.isArray(manifest.dependencies)) {
    throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST_DEPENDENCY');
  }
  for (const dependency of manifest.dependencies) {
    const fields = ['consumerAgentId', 'providerAgentId', 'kind', 'requirement'];
    const capabilities = dependency?.capabilities;
    const key = `${dependency?.consumerAgentId}\0${dependency?.providerAgentId}\0${dependency?.kind}`;
    if (!dependency || fields.some((field) => !nonEmpty(dependency[field]))
      || !agents[dependency.consumerAgentId] || !agents[dependency.providerAgentId]
      || dependency.consumerAgentId === dependency.providerAgentId || !dependencyKinds.has(dependency.kind)
      || dependency.requirement !== 'capability-bound' || !Array.isArray(capabilities) || capabilities.length === 0
      || capabilities.some((capability) => !nonEmpty(capability))
      || new Set(capabilities).size !== capabilities.length || dependencyKeys.has(key)) {
      throw new Error('BLOCKED_WORKFLOW_AGENTS_MANIFEST_DEPENDENCY');
    }
    dependencyKeys.add(key);
    dependencies.push({ ...dependency, capabilities: [...capabilities] });
  }
  return { ...manifest, agents, dependencies };
}

export function configuredRolesFromManifest(manifest = loadWorkflowAgents()) {
  return Object.fromEntries(Object.values(manifest.agents)
    .map(({ agentId, title, model, reasoning }) => [agentId, { displayLabel: title, model, reasoning }]));
}

export function loadRoleCapabilityOwnership(teamPath = TEAM_POLICY_PATH, manifest = loadWorkflowAgents()) {
  const text = fs.readFileSync(teamPath, 'utf8');
  const section = text.match(/## Team capability policy[\s\S]*?(?=\n## )/)?.[0];
  if (!section) throw new Error('BLOCKED_TEAM_CAPABILITY_POLICY');
  const rows = section.split(/\r?\n/).filter((line) => /^\| .+ \|$/.test(line));
  const headerIndex = rows.findIndex((line) => line.startsWith('| Capability |'));
  if (headerIndex < 0) throw new Error('BLOCKED_TEAM_CAPABILITY_POLICY_HEADER');
  const headers = rows[headerIndex].split('|').slice(1, -1).map((value) => value.trim());
  const agentIds = Object.keys(manifest.agents);
  const expectedNames = Object.values(manifest.agents).map(({ agentName }) => agentName);
  if (headers[0] !== 'Capability' || headers.slice(1).join('\0') !== expectedNames.join('\0')) {
    throw new Error('BLOCKED_TEAM_CAPABILITY_POLICY_HEADER');
  }
  const ownership = {};
  for (const line of rows.slice(headerIndex + 2)) {
    const values = line.split('|').slice(1, -1).map((value) => value.trim());
    if (values.length !== headers.length || values.some((value) => !nonEmpty(value)) || ownership[values[0]]) {
      throw new Error('BLOCKED_TEAM_CAPABILITY_POLICY_ROW');
    }
    ownership[values[0]] = Object.fromEntries(agentIds.map((role, index) => [role, values[index + 1]]));
  }
  const normalizedCapability = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const dependency of manifest.dependencies) {
    for (const capability of dependency.capabilities) {
      const row = Object.entries(ownership).find(([name]) => normalizedCapability(name) === normalizedCapability(capability))?.[1];
      const providerPermission = row?.[dependency.providerAgentId];
      if (!providerPermission || providerPermission === 'PROHIBITED'
        || (dependency.kind === 'capability-provider' && !providerPermission.startsWith('OWN'))) {
        throw new Error('BLOCKED_WORKFLOW_DEPENDENCY_CAPABILITY_MISMATCH');
      }
    }
  }
  return ownership;
}

export function validateProjectContext(context) {
  if (!context || context.schemaVersion !== 'codex-project-context.v1' || !nonEmpty(context.project) || !nonEmpty(context.repository)) {
    throw new Error('BLOCKED_INVALID_PROJECT_CONTEXT');
  }
  if ((context.workflow !== undefined || context.harness !== undefined)
    && (!nonEmpty(context.workflow) || !nonEmpty(context.harness))) {
    throw new Error('BLOCKED_INVALID_WORKFLOW_CONTEXT');
  }
  const tracker = context.tracker;
  if (!tracker || !nonEmpty(tracker.provider) || !nonEmpty(tracker.capability) || !nonEmpty(tracker.workspace)) {
    throw new Error('BLOCKED_INVALID_PROJECT_CONTEXT');
  }
  if (!tracker.container || !nonEmpty(tracker.container.id) || !nonEmpty(tracker.container.url)) {
    throw new Error('BLOCKED_INVALID_PROJECT_CONTEXT');
  }
  for (const state of ['backlog', 'todo', 'inProgress', 'done', 'canceled']) {
    if (!nonEmpty(tracker.lifecycle?.[state])) throw new Error('BLOCKED_INVALID_PROJECT_CONTEXT');
  }
  if (!Array.isArray(tracker.disabledProviders) || tracker.disabledProviders.some((provider) => !nonEmpty(provider))) {
    throw new Error('BLOCKED_INVALID_PROJECT_CONTEXT');
  }
  const configuration = context.configuration;
  for (const field of ['bundleRoot', 'profilePath', 'commandsRoot', 'workflowsRoot', 'baselineRoot']) {
    if (!nonEmpty(configuration?.[field])) throw new Error('BLOCKED_INVALID_CONFIGURATION_SOURCE_BINDING');
  }
  return context;
}

export function verifyConfigurationSourceBinding({ context, candidate }) {
  const expected = validateProjectContext(context).configuration;
  if (!candidate || JSON.stringify(candidate) !== JSON.stringify(expected)) {
    throw new Error('BLOCKED_FOREIGN_OR_MISMATCHED_CONFIGURATION_SOURCE');
  }
  return expected;
}

export function validateInitializedRuleSourceBinding({ context, binding }) {
  const validated = validateProjectContext(context);
  if (!binding || binding.project !== validated.project || binding.repository !== validated.repository || !path.isAbsolute(binding.workspaceRealPath)) {
    throw new Error('BLOCKED_INVALID_INITIALIZED_RULE_SOURCE_BINDING');
  }
  verifyConfigurationSourceBinding({ context: validated, candidate: binding.configuration });
  const rootFields = ['bundleRoot', 'commandsRoot', 'workflowsRoot', 'baselineRoot'];
  for (const field of rootFields) {
    const canonicalRoot = binding.canonicalRoots?.[field];
    if (!path.isAbsolute(canonicalRoot ?? '') || path.relative(binding.workspaceRealPath, canonicalRoot).startsWith('..')) {
      throw new Error('BLOCKED_RULE_SOURCE_ROOT_ESCAPE');
    }
  }
  if (!Array.isArray(binding.sourceManifest) || binding.sourceManifest.length < 7) {
    throw new Error('BLOCKED_INVALID_RULE_SOURCE_MANIFEST');
  }
  const transport = binding.initializationTransport ?? 'embedded-content';
  if (!['embedded-content', 'codex-local-shared-workspace'].includes(transport)) {
    throw new Error('BLOCKED_INVALID_INITIALIZATION_TRANSPORT');
  }
  if (transport === 'codex-local-shared-workspace'
    && (binding.runtimeAdapter !== 'codex-desktop' || binding.sharedWorkspaceVerifiedBy !== 'initializer')) {
    throw new Error('BLOCKED_UNVERIFIED_CODEX_SHARED_WORKSPACE');
  }
  const canonicalPaths = new Set();
  for (const source of binding.sourceManifest) {
    if (!nonEmpty(source?.relativePath) || !path.isAbsolute(source?.canonicalPath ?? '')
      || !/^[a-f0-9]{64}$/.test(source?.sha256 ?? '')) {
      throw new Error('BLOCKED_INVALID_RULE_SOURCE_MANIFEST');
    }
    let sourceBytes;
    if (transport === 'embedded-content') {
      if (!nonEmpty(source?.content)) throw new Error('BLOCKED_INVALID_RULE_SOURCE_MANIFEST');
      sourceBytes = source.content;
    } else {
      let canonicalReadPath;
      try {
        canonicalReadPath = fs.realpathSync(source.canonicalPath);
        if (canonicalReadPath !== source.canonicalPath) throw new Error('symlink-or-alias');
        sourceBytes = fs.readFileSync(canonicalReadPath);
      } catch {
        throw new Error('BLOCKED_INCOMPLETE_CANONICAL_INITIALIZATION');
      }
    }
    if (createHash('sha256').update(sourceBytes).digest('hex') !== source.sha256) {
      throw new Error('BLOCKED_RULE_SOURCE_CONTENT_FINGERPRINT_MISMATCH');
    }
    const contained = Object.values(binding.canonicalRoots).some((root) => path.relative(root, source.canonicalPath) === '' || (!path.relative(root, source.canonicalPath).startsWith('..') && !path.isAbsolute(path.relative(root, source.canonicalPath))));
    if (!contained || canonicalPaths.has(source.canonicalPath)) throw new Error('BLOCKED_FOREIGN_OR_DUPLICATE_RULE_SOURCE');
    canonicalPaths.add(source.canonicalPath);
  }
  return binding;
}

export function verifyInitializedRuleSourceCandidate({ context, initializedBinding, candidateBinding }) {
  const expected = validateInitializedRuleSourceBinding({ context, binding: initializedBinding });
  validateInitializedRuleSourceBinding({ context, binding: candidateBinding });
  if (JSON.stringify(candidateBinding) !== JSON.stringify(expected)) throw new Error('BLOCKED_RULE_SOURCE_PROVENANCE_MISMATCH');
  return expected;
}

export function resolveManagerCallerContext({ envelope, registry, initializedContext, currentTaskId }) {
  const context = validateProjectContext(initializedContext);
  const complete = envelope
    && nonEmpty(envelope.callerTaskId)
    && nonEmpty(envelope.returnTaskId)
    && nonEmpty(envelope.callerIdentity)
    && nonEmpty(envelope.project)
    && nonEmpty(envelope.repository)
    && nonEmpty(envelope.intent);
  if (!complete) {
    return {
      status: 'CLARIFY_CALLER_OR_PROJECT',
      suggestedProject: context.project,
      trackerAccess: 'PROHIBITED',
      trackerMutation: 'PROHIBITED',
      dispatch: 'PROHIBITED',
      authorized: false,
    };
  }
  const candidates = registry.filter((task) => task.taskId === envelope.callerTaskId && task.visible && task.initialized);
  if (candidates.length !== 1) throw new Error('BLOCKED_CALLER_TASK_IDENTITY_MISMATCH');
  const caller = candidates[0];
  const directHuman = envelope.callerIdentity === 'lead/human in this visible task';
  const identityMatches = directHuman
    ? nonEmpty(currentTaskId) && currentTaskId === caller.taskId
    : caller.role === envelope.callerIdentity;
  if (!identityMatches || caller.project !== envelope.project || caller.repository !== envelope.repository) {
    throw new Error('BLOCKED_CALLER_TASK_IDENTITY_MISMATCH');
  }
  if (envelope.project !== context.project || envelope.repository !== context.repository) {
    throw new Error('BLOCKED_CALLER_PROJECT_CONTEXT_MISMATCH');
  }
  if (!['same-as-caller', 'caller-designated'].includes(envelope.returnRouteAuthorization)) throw new Error('BLOCKED_RETURN_ROUTE_AUTHORIZATION_REQUIRED');
  if (envelope.returnRouteAuthorization === 'same-as-caller' && envelope.returnTaskId !== envelope.callerTaskId) {
    throw new Error('BLOCKED_RETURN_ROUTE_AUTHORIZATION_MISMATCH');
  }
  if (envelope.returnRouteAuthorization === 'caller-designated' && envelope.returnTaskId === envelope.callerTaskId) {
    throw new Error('BLOCKED_RETURN_ROUTE_AUTHORIZATION_MISMATCH');
  }
  const returnCandidates = registry.filter((task) => task.taskId === envelope.returnTaskId && task.visible && task.initialized);
  if (returnCandidates.length !== 1) throw new Error('BLOCKED_RETURN_TASK_IDENTITY_MISMATCH');
  const returnTask = returnCandidates[0];
  if (returnTask.project !== context.project || returnTask.repository !== context.repository) throw new Error('BLOCKED_RETURN_TASK_PROJECT_CONTEXT_MISMATCH');
  return {
    status: 'RESOLVED',
    callerTaskId: envelope.callerTaskId,
    returnTaskId: envelope.returnTaskId,
    callerIdentity: envelope.callerIdentity,
    project: context.project,
    repository: context.repository,
    intent: envelope.intent,
    ticketId: envelope.ticketId,
    tracker: context.tracker,
    authorized: true,
  };
}

const MANAGER_PACKET_FIELDS = [
  'callerTaskId', 'returnTaskId', 'callerIdentity', 'project', 'repository',
  'intent', 'ticketCandidateCorrelationId', 'returnRouteAuthorization',
];
const OPTIONAL_MANAGER_TICKET_FIELDS = ['ticketId', 'ticketUrl'];

export function createManagerPacket(fields) {
  const missing = MANAGER_PACKET_FIELDS.filter((field) => !nonEmpty(fields?.[field]));
  if (missing.length > 0) throw new Error(`BLOCKED_INVALID_PACKET:${missing.join(',')}`);
  const packet = Object.fromEntries(MANAGER_PACKET_FIELDS.map((field) => [field, fields[field]]));
  for (const field of OPTIONAL_MANAGER_TICKET_FIELDS) {
    if (fields?.[field] !== undefined) {
      if (!nonEmpty(fields[field])) throw new Error(`BLOCKED_INVALID_PACKET:${field}`);
      packet[field] = fields[field];
    }
  }
  return Object.freeze(packet);
}

export function managerPacketDecision({ packet, registry, initializedContext, trustedSenderTaskId, receipt, attempts = 0 }) {
  try {
    const canonical = createManagerPacket(packet);
    return {
      status: 'ACCEPTED',
      trackerAccess: 'AUTHORIZED_AFTER_CONTEXT_VALIDATION',
      resolved: resolveManagerCallerContext({ envelope: canonical, registry, initializedContext }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'BLOCKED_INVALID_PACKET';
    const returnTaskId = nonEmpty(trustedSenderTaskId) ? trustedSenderTaskId : packet?.returnTaskId;
    if (!nonEmpty(returnTaskId)) throw new Error('BLOCKED_INVALID_PACKET:NO_VISIBLE_RETURN_ROUTE');
    return {
      status: 'BLOCKED_INVALID_PACKET',
      trackerAccess: 'PROHIBITED',
      trackerMutation: 'PROHIBITED',
      receipt: { status: 'BLOCKED_INVALID_PACKET', reason, returnTaskId },
      delivery: terminalDeliveryDecision({ returnTaskId, receipt, attempts }),
    };
  }
}

export function managerTurnCompletionDecision({ visibleResponseCount = 0, delivery }) {
  if (visibleResponseCount < 1) throw new Error('REJECTED_SILENT_MANAGER_COMPLETION');
  if (!nonEmpty(delivery)) throw new Error('BLOCKED_MANAGER_DELIVERY_RECEIPT_REQUIRED');
  return 'MANAGER_TURN_MAY_COMPLETE';
}

export function verifyTrackerBinding({ context, binding }) {
  const expected = validateProjectContext(context).tracker;
  if (expected.disabledProviders.includes(binding?.provider)) throw new Error('BLOCKED_DISABLED_TRACKER_PROVIDER');
  if (JSON.stringify(binding) !== JSON.stringify(expected)) throw new Error('BLOCKED_TRACKER_BINDING_MISMATCH');
  return expected;
}

export function projectTasksForCaller({ resolvedCaller, tasks }) {
  if (!resolvedCaller?.authorized) throw new Error('BLOCKED_UNRESOLVED_CALLER_CONTEXT');
  return tasks.filter((task) => task.project === resolvedCaller.project && task.repository === resolvedCaller.repository);
}

export function terminalDeliveryDecision({
  sameTaskHuman = false,
  scheduler = false,
  returnTaskId,
  receipt,
  attempts = 0,
  appSafetyRejected = false,
  observedTerminalReceipt,
}) {
  if (scheduler) return 'SCHEDULER_NO_CONVERSATIONAL_RETURN';
  if (sameTaskHuman) return 'LOCAL_FINAL_ALLOWED';
  if (!nonEmpty(returnTaskId)) throw new Error('BLOCKED_MISSING_RETURN_TASK_ID');
  if (receipt?.ok === true && receipt.taskId === returnTaskId) return 'TERMINAL_DELIVERED';
  if (attempts < 1) return `RETRY_SAME_RETURN_TASK:${returnTaskId}`;
  if (appSafetyRejected === true
    && observedTerminalReceipt?.returnTaskId === returnTaskId
    && nonEmpty(observedTerminalReceipt?.correlationId)
    && nonEmpty(observedTerminalReceipt?.disposition)) {
    return `TERMINAL_OBSERVED_FALLBACK:${returnTaskId}`;
  }
  return `BLOCKED_DELIVERY:${returnTaskId}`;
}

export function credentialEscalationAuthorizationDecision({
  automaticRegisteredRoute = false,
  coordinatorRole,
  coordinatorTaskId,
  humanAuthorizationSourceTaskId,
  exactHumanMessage,
  authorizedEffects = [],
}) {
  if (automaticRegisteredRoute) return 'CREDENTIAL_REFRESH_AUTOMATIC_ROUTE_ALLOWED';
  if (coordinatorRole !== 'designer / reviewer' || !nonEmpty(coordinatorTaskId)
    || humanAuthorizationSourceTaskId !== coordinatorTaskId) {
    return 'BLOCKED_CREDENTIAL_ESCALATION_COORDINATOR_ATTESTATION_REQUIRED';
  }
  if (!nonEmpty(exactHumanMessage) || authorizedEffects.length !== 1
    || authorizedEffects[0] !== 'credential-refresh') {
    return 'BLOCKED_CREDENTIAL_ESCALATION_HUMAN_AUTHORIZATION_REQUIRED';
  }
  return 'CREDENTIAL_REFRESH_COORDINATOR_ATTESTED_HUMAN_AUTHORIZATION_ALLOWED';
}

export function packetDeliveryAcknowledgementDecision({ correlationId, workerId, dispatchReceipt, recipientBusy = false,
  acknowledgement, acknowledgementCorrelationId, attempts = 0 }) {
  if (!nonEmpty(correlationId) || !nonEmpty(workerId)) throw new Error('BLOCKED_DELIVERY_IDENTITY_REQUIRED');
  if (dispatchReceipt?.ok !== true || dispatchReceipt.taskId !== workerId) {
    if (attempts < 1 && dispatchReceipt?.definiteFailure === true) return `RETRY_SAME_WORKER:${workerId}`;
    throw new Error('BLOCKED_DELIVERY_UNACKNOWLEDGED');
  }
  if (acknowledgement === 'COPY THAT' && acknowledgementCorrelationId === correlationId) return 'PACKET_ACKNOWLEDGED';
  if (recipientBusy) return `PENDING_DELIVERY_BUSY:${workerId}`;
  throw new Error('BLOCKED_DELIVERY_UNACKNOWLEDGED');
}

export function workerDeliveryRecoveryDecision({ correlationId, workerId, dispatchReceipt, acknowledgement,
  acknowledgementCorrelationId, observationExpired = false, recipientTurnEndedWithoutAcknowledgement = false,
  managerVerifiedReplacement = false }) {
  if (!nonEmpty(correlationId) || !nonEmpty(workerId)) throw new Error('BLOCKED_DELIVERY_IDENTITY_REQUIRED');
  if (dispatchReceipt?.ok !== true || dispatchReceipt.taskId !== workerId) {
    throw new Error('BLOCKED_DELIVERY_UNACKNOWLEDGED');
  }
  if (acknowledgement === 'COPY THAT' && acknowledgementCorrelationId === correlationId) return 'PACKET_ACKNOWLEDGED';
  if (!observationExpired && !recipientTurnEndedWithoutAcknowledgement) {
    return `PENDING_DELIVERY_OBSERVATION:${workerId}`;
  }
  if (!managerVerifiedReplacement) return `MANAGER_WORKER_RECOVERY_REQUIRED:${workerId}`;
  return `MANAGER_REPLACE_EXACT_STALE_DISPOSABLE_WORKER:${workerId}`;
}

export function workerFollowupDecision({ correlationId, acknowledgement, acknowledgementCorrelationId,
  terminalReceipt = false, followupKind }) {
  if (!nonEmpty(correlationId)) throw new Error('BLOCKED_DELIVERY_IDENTITY_REQUIRED');
  if (terminalReceipt) return 'DEPENDENT_GATE_MAY_ADVANCE';
  if (acknowledgement === 'COPY THAT' && acknowledgementCorrelationId === correlationId) {
    if (followupKind === undefined) return 'AWAIT_WORKER_TERMINAL_EVIDENCE';
    if (['same-scope-correction', 'safety-stop'].includes(followupKind)) return 'SEND_BOUNDED_WORKER_CORRECTION';
    throw new Error('BLOCKED_ACTIVE_WORKER_CONTINUATION_MESSAGE');
  }
  throw new Error('BLOCKED_DELIVERY_UNACKNOWLEDGED');
}

export function activeScopeInterruptionDecision({ activeCorrelationId, activeTicketId, activeTargetRepository,
  incomingCorrelationId, incomingTicketId, incomingTargetRepository, incomingKind,
  authorizedStopOrReplacement = false }) {
  if (!nonEmpty(activeCorrelationId) || !nonEmpty(incomingCorrelationId)) {
    throw new Error('BLOCKED_ACTIVE_SCOPE_CORRELATION_REQUIRED');
  }
  const sameScope = activeCorrelationId === incomingCorrelationId && activeTicketId === incomingTicketId
    && activeTargetRepository === incomingTargetRepository;
  if (sameScope && ['same-scope-extension', 'same-scope-correction'].includes(incomingKind)) {
    return 'CONTINUE_ACTIVE_SCOPE';
  }
  if (activeCorrelationId === incomingCorrelationId
    && ['stop-current-scope', 'safety-stop', 'replacement'].includes(incomingKind)
    && authorizedStopOrReplacement) {
    return 'STOP_OR_REPLACE_ACTIVE_SCOPE';
  }
  throw new Error('BLOCKED_ACTIVE_SCOPE_INTERRUPTION');
}

// Dispatch state is trusted runtime evidence, never a packet claim.  This
// applies to every visible worker role, including Coder and Command Runner.
export function workerDispatchDecision({ packet, activeAssignment }) {
  if (!activeAssignment?.active) return 'WORKER_IDLE';
  const permitted = ['current-scope-correction', 'safety-stop', 'explicit-replacement'];
  if (!permitted.includes(packet?.interruptionKind)) throw new Error('BLOCKED_WORKER_BUSY');
  if (activeAssignment.allowedInterruptionKind !== packet.interruptionKind) {
    throw new Error('BLOCKED_UNVERIFIED_WORKER_INTERRUPTION');
  }
  if (packet.interruptionKind === 'current-scope-correction'
    && packet.workPacketId !== activeAssignment.workPacketId) {
    throw new Error('BLOCKED_CURRENT_SCOPE_CORRECTION_MISMATCH');
  }
  if (packet.interruptionKind === 'explicit-replacement'
    && (!nonEmpty(packet.replacesWorkPacketId)
      || packet.replacesWorkPacketId !== activeAssignment.workPacketId)) {
    throw new Error('BLOCKED_EXPLICIT_REPLACEMENT_MISMATCH');
  }
  return `VERIFIED_WORKER_INTERRUPTION:${packet.interruptionKind}`;
}

// This is an executable reference model for the Markdown handoff contract. It
// deliberately validates protocol shape only; it does not send Codex messages.
export function validateWorkerPacket({ packet, registry, initializedContext, trustedCurrentTaskId }) {
  const complete = packet
    && nonEmpty(packet.callerTaskId)
    && nonEmpty(packet.returnTaskId)
    && nonEmpty(packet.callerIdentity)
    && nonEmpty(packet.project)
    && nonEmpty(packet.repository)
    && nonEmpty(packet.requestIntent)
    && nonEmpty(packet.workerId)
    && nonEmpty(packet.boundedScope)
    && nonEmpty(packet.validation)
    && nonEmpty(packet.prohibitions)
    && nonEmpty(packet.terminalCondition);
  if (!complete) throw new Error('BLOCKED_INCOMPLETE_WORKER_PACKET');
  if (Object.hasOwn(packet, 'currentTaskId')) throw new Error('BLOCKED_UNTRUSTED_PACKET_CURRENT_TASK_ID');
  if (!nonEmpty(trustedCurrentTaskId)) throw new Error('BLOCKED_MISSING_TRUSTED_CURRENT_TASK_ID');
  if (trustedCurrentTaskId !== packet.workerId) throw new Error('BLOCKED_TRUSTED_RECIPIENT_MISMATCH');
  const workers = registry.filter((task) => task.taskId === packet.workerId && task.visible && task.initialized);
  if (workers.length !== 1) throw new Error('BLOCKED_WORKER_TASK_IDENTITY_MISMATCH');
  if (workers[0].project !== packet.project || workers[0].repository !== packet.repository) throw new Error('BLOCKED_WORKER_TASK_PROJECT_CONTEXT_MISMATCH');
  return resolveManagerCallerContext({
    registry,
    initializedContext,
    currentTaskId: trustedCurrentTaskId,
    envelope: {
      callerTaskId: packet.callerTaskId,
      returnTaskId: packet.returnTaskId,
      callerIdentity: packet.callerIdentity,
      project: packet.project,
      repository: packet.repository,
      intent: packet.requestIntent,
      ticketId: packet.ticketId ?? packet.workPacketId,
      returnRouteAuthorization: packet.returnRouteAuthorization,
    },
  });
}

export function workerHandoffDecision({ packet, registry, initializedContext, trustedCurrentTaskId, acknowledgement, acknowledgementPhase, priorUserVisibleResponseCount, turnEndedAfterAcknowledgement = false, terminal = false, terminalDisposition, partial = false, completion, blocker, evidence }) {
  const resolved = validateWorkerPacket({ packet, registry, initializedContext, trustedCurrentTaskId });
  if (acknowledgement !== 'COPY THAT') throw new Error('BLOCKED_EXACT_COPY_THAT_ACKNOWLEDGEMENT_REQUIRED');
  if (acknowledgementPhase !== 'commentary' || priorUserVisibleResponseCount !== 0) throw new Error('BLOCKED_COPY_THAT_MUST_BE_FIRST_COMMENTARY_RESPONSE');
  if (turnEndedAfterAcknowledgement) throw new Error('REJECTED_ACKNOWLEDGEMENT_ONLY_TURN');
  if (partial) throw new Error('REJECTED_PARTIAL_PROGRESS_NOT_ACCEPTANCE_OR_COMPLETION');
  if (!terminal) return packet.persistenceRequired ? 'CONTINUE_WORKER_PACKET' : 'EXECUTE_BOUNDED_PACKET';
  if (completion === 'incomplete') throw new Error('REJECTED_INCOMPLETE_PACKET_MUST_CONTINUE');
  if (!['DONE', 'BLOCKED', 'APPROVAL_REQUIRED'].includes(terminalDisposition)) throw new Error('BLOCKED_INVALID_TERMINAL_DISPOSITION');
  const genuineBlocker = blocker && nonEmpty(blocker.evidence) && nonEmpty(blocker.nextAction);
  if (terminalDisposition === 'DONE' && completion !== 'complete') throw new Error('REJECTED_IN_SCOPE_CODING_CANNOT_BE_TERMINAL_BLOCKER');
  if (terminalDisposition === 'BLOCKED' && !(completion === 'blocked' && genuineBlocker && blocker.kind === 'external')) throw new Error('REJECTED_IN_SCOPE_CODING_CANNOT_BE_TERMINAL_BLOCKER');
  if (terminalDisposition === 'APPROVAL_REQUIRED' && !(completion === 'blocked' && genuineBlocker && blocker.kind === 'authority')) throw new Error('REJECTED_IN_SCOPE_CODING_CANNOT_BE_TERMINAL_BLOCKER');
  const completeEvidence = evidence
    && Array.isArray(evidence.changedFiles)
    && Array.isArray(evidence.commandsTests)
    && Array.isArray(evidence.requirementToTest)
    && Array.isArray(evidence.residualRisksBlockers)
    && nonEmpty(evidence.nonClosureStatus)
    && evidence.returnTaskId === resolved.returnTaskId;
  if (!completeEvidence) throw new Error('BLOCKED_INCOMPLETE_TERMINAL_EVIDENCE');
  return `TERMINAL_EVIDENCE_REQUIRED:${resolved.returnTaskId}`;
}

export function resolveVisibleRole({ request, registry, configuredRoles, delivery = 'codex-app-existing-task', ticketId }) {
  if (delivery !== 'codex-app-existing-task') throw new Error('BLOCKED_SUBAGENT_OR_SUBSTITUTE_ROUTE');
  let role;
  try {
    role = normalizeRoutableRole(request);
  } catch {
    throw new Error('BLOCKED_UNKNOWN_ROLE');
  }
  const expected = configuredRoles[role];
  const candidates = registry.filter((task) => task.role === role && task.active && task.visible && task.initialized);
  if (candidates.length !== 1) throw new Error('BLOCKED_EXACT_VISIBLE_TASK_UNAVAILABLE_OR_DUPLICATED');
  const task = candidates[0];
  if (!task.taskId || task.title !== expected.displayLabel || task.model !== expected.model || task.reasoning !== expected.reasoning) {
    throw new Error('BLOCKED_MODEL_REASONING_OR_TASK_ID_MISMATCH');
  }
  if (loadWorkflowAgents().agents[role].requiresTicket && !ticketId) {
    throw new Error('BLOCKED_MISSING_TICKET_ID');
  }
  return { role, taskId: task.taskId, delivery };
}

export function workerDisposition({ role, terminalReceipt, callerAccepted, correction, pending, dependency, approval, automation }) {
  const disposable = role === 'command-runner-test' || loadWorkflowAgents().agents[role]?.lifecycle === 'disposable worker';
  if (!disposable) return 'PERSISTENT_CONTROL_ROLE';
  return terminalReceipt && callerAccepted && !correction && !pending && !dependency && !approval && !automation
    ? 'ARCHIVE_EXACT_WORKER_NEVER_DELETE'
    : 'KEEP_ACTIVE';
}

export function staffingDecision({ role, registry }) {
  const active = registry.filter((task) => task.role === role && task.active);
  if (active.length > 1) throw new Error('BLOCKED_DUPLICATE_ACTIVE_WORKERS');
  return active.length === 0 ? 'CREATE_ONE_FRESH_VISIBLE_WORKER' : `USE_EXACT_TASK_ID:${active[0].taskId}`;
}

export function adminControlTaskDecision({ directHumanRequest = false, adminTasks = [], runtimeProjectId,
  expectedModel = 'gpt-5.6-sol', expectedReasoning = 'high', acknowledgement }) {
  if (!directHumanRequest) throw new Error('BLOCKED_ADMIN_HUMAN_ONLY_FIREWALL');
  const matching = adminTasks.filter((task) => task.active && task.title === '🔑 Admin'
    && task.projectId === runtimeProjectId);
  if (matching.length !== 1) throw new Error('BLOCKED_ADMIN_CONTROL_TASK_IDENTITY');
  const [admin] = matching;
  if (!nonEmpty(admin.taskId) || admin.model !== expectedModel || admin.reasoning !== expectedReasoning
    || acknowledgement !== 'ADMIN_READY') {
    throw new Error('BLOCKED_ADMIN_CONTROL_TASK_IDENTITY');
  }
  return `VERIFIED_ADMIN:${admin.taskId}`;
}

export function adminExplicitEffectDecision({ directHumanRequest = false, messageKind, requestedEffects = [],
  requestedTargets = [], adminBypassConfirmed = false }) {
  const nonMutatingKinds = new Set(['criticism', 'diagnosis', 'status', 'example', 'desired-state']);
  const allowedEffects = new Set(['create', 'archive', 'unarchive', 'initialize', 'reinitialize', 'reload', 'repair',
    'rename', 'move', 'repository-edit']);
  if (!directHumanRequest || nonMutatingKinds.has(messageKind)) return 'ADMIN_NO_MUTATION';
  if (messageKind !== 'explicit-command' || requestedEffects.length === 0
    || requestedEffects.length !== requestedTargets.length
    || requestedEffects.some((effect) => !allowedEffects.has(effect))
    || requestedTargets.some((target) => !nonEmpty(target))) {
    throw new Error('BLOCKED_ADMIN_EXACT_EFFECT_REQUIRED');
  }
  return requestedEffects.map((effect, index) => {
    const target = requestedTargets[index];
    if (effect === 'repository-edit') return `repository-edit:${target}`;
    if ((effect === 'create' || effect === 'initialize') && target === 'manager') {
      return `BOOTSTRAP_MANAGER:${effect}:${target}`;
    }
    if (adminBypassConfirmed) return `ADMIN_CONFIRMED_OVERRIDE:${effect}:${target}`;
    return `DELEGATE_TO_MANAGER:${effect}:${target}`;
  }).join('|');
}

export function adminSuccessorHandoffDecision({ directHumanRequest = false, includeAdmin = false, predecessor,
  successor, runtimeProjectId, acknowledgement }) {
  if (!directHumanRequest || !includeAdmin) throw new Error('BLOCKED_ADMIN_HUMAN_ONLY_FIREWALL');
  if (!predecessor?.active || predecessor.title !== '🔑 Admin' || predecessor.projectId !== runtimeProjectId
    || !nonEmpty(predecessor.taskId)) throw new Error('BLOCKED_ADMIN_SUCCESSOR_HANDOFF');
  if (!successor) return 'DELEGATE_ADMIN_SUCCESSOR_TO_MANAGER';
  if (successor.taskId === predecessor.taskId || successor.title !== '🔑 Admin'
    || successor.projectId !== runtimeProjectId || successor.model !== predecessor.model
    || successor.reasoning !== predecessor.reasoning || successor.ready !== true
    || acknowledgement !== 'ADMIN_READY') throw new Error('BLOCKED_ADMIN_SUCCESSOR_HANDOFF');
  return `MANAGER_ARCHIVE_PREDECESSOR_ADMIN_LAST:${predecessor.taskId}`;
}

export function concurrentRosterReinitializationDecision({ adminTaskId, governedRoles = [], activeOldRoles = [],
  archiveReceipts = [], inactiveRoleIds = [], freshRoles = [], pendingCreations = [] }) {
  if (!nonEmpty(adminTaskId) || governedRoles.length === 0 || new Set(governedRoles).size !== governedRoles.length) {
    throw new Error('BLOCKED_ADMIN_CONTROL_TASK_IDENTITY');
  }
  if (activeOldRoles.some((task) => task.taskId === adminTaskId)) {
    throw new Error('BLOCKED_ADMIN_SELF_ARCHIVE');
  }
  if (archiveReceipts.length !== activeOldRoles.length
    || activeOldRoles.some((task) => !inactiveRoleIds.includes(task.taskId))) {
    return 'WAIT_FOR_COMPLETE_INACTIVE_ROSTER_BARRIER';
  }
  const pendingClientIds = pendingCreations.map((creation) => creation.clientThreadId);
  if (pendingCreations.some((creation) => !governedRoles.includes(creation.role)
    || !nonEmpty(creation.clientThreadId)) || new Set(pendingClientIds).size !== pendingClientIds.length) {
    throw new Error('BLOCKED_INVALID_PENDING_CREATION_LEDGER');
  }
  if (pendingCreations.some((creation) => creation.status === 'pending')) {
    return 'WAIT_FOR_PENDING_CREATION_RECEIPTS';
  }
  if (freshRoles.length === 0) return 'CREATE_GOVERNED_ROSTER_CONCURRENTLY';
  const freshRoleNames = freshRoles.map((task) => task.role);
  const complete = freshRoles.length === governedRoles.length && new Set(freshRoleNames).size === governedRoles.length
    && governedRoles.every((role) => freshRoleNames.includes(role))
    && freshRoles.every((task) => task.ready === true && task.projectId === activeOldRoles[0]?.projectId);
  if (!complete) return 'FRESH_ROSTER_NON_DISPATCHABLE';
  return 'FRESH_ROSTER_READY';
}

export function rosterExpansionRepairDecision({ adminTaskId, runtimeProjectId, declaredRoles = [], activeRoles = [] }) {
  if (!nonEmpty(adminTaskId) || !nonEmpty(runtimeProjectId)
    || declaredRoles.length === 0 || new Set(declaredRoles).size !== declaredRoles.length
    || !declaredRoles.includes('proxy-coder')) {
    throw new Error('BLOCKED_ROSTER_EXPANSION_CONTEXT');
  }
  const activeNames = activeRoles.map((task) => task.role);
  const missing = declaredRoles.filter((role) => !activeNames.includes(role));
  const validLegacyRoster = activeRoles.length === 6
    && new Set(activeNames).size === 6
    && missing.length === 1
    && missing[0] === 'proxy-coder'
    && activeRoles.every((task) => task.active === true && task.ready === true
      && task.projectId === runtimeProjectId && nonEmpty(task.taskId));
  if (!validLegacyRoster) throw new Error('BLOCKED_ROSTER_EXPANSION_CONTEXT');
  return 'CREATE_ONLY_MISSING_PROXY_CODER';
}

export function validateReplacementWorkerInitialization({ role, visible, unique, contractParts, acknowledgement }) {
  const configuredAgent = loadWorkflowAgents().agents[role];
  const expected = configuredAgent?.readinessToken
    ?? (role === 'command-runner-test' ? 'COMMAND_RUNNER_TEST_READY' : undefined);
  if (!expected) throw new Error('BLOCKED_UNKNOWN_AI_ROLE');
  const required = ['agents', 'workflow', 'workflow-agents', 'shared-execution-routing', 'permission-envelope',
    'team-policy', 'workflow-agents-manifest', 'project-context', 'common-role-definition'];
  if (!Array.isArray(contractParts) || required.some((part) => !contractParts.includes(part))) {
    throw new Error('BLOCKED_INCOMPLETE_CANONICAL_INITIALIZATION');
  }
  if (acknowledgement !== expected) throw new Error('BLOCKED_WORKER_READINESS_ACKNOWLEDGEMENT');
  if (!visible || !unique) throw new Error('BLOCKED_UNVERIFIED_INITIALIZED_WORKER');
  return `INITIALIZED_VISIBLE_WORKER:${role}`;
}

export function validateJudgeAgentInstantiation({ role, taskId, profileId, workflowId, logicalProjectId,
  runtimeProjectId, agentDefinitionPath, sourceManifestPaths = [], focusedGovernanceValidationCommands = [],
  canonicalLiveScenario, scheduleName }) {
  if (role !== 'judge' || !nonEmpty(taskId) || !nonEmpty(profileId) || !nonEmpty(workflowId)
    || !nonEmpty(runtimeProjectId)) {
    throw new Error('BLOCKED_JUDGE_INSTANCE_IDENTITY_REQUIRED');
  }
  const logicalBase = `${profileId}-${workflowId}`;
  if (logicalProjectId !== logicalBase && !logicalProjectId?.startsWith(`${logicalBase}-`)) {
    throw new Error('BLOCKED_JUDGE_INSTANCE_PROJECT_MISMATCH');
  }
  if (agentDefinitionPath !== 'ai-workflows/_common/roles/judge.md') {
    throw new Error('BLOCKED_JUDGE_SHARED_AGENT_DEFINITION_REQUIRED');
  }
  const requiredSources = [
    'ai-workflows/agents.md',
    'ai-workflows/_common/roles/judge.md',
    `ai-workflows/${workflowId}/${workflowId}.workflow.md`,
    `ai-workflows/${workflowId}/agents/team.md`,
    `ai-workflows/${workflowId}/agents/shared-execution-routing.md`,
    `ai-workflows/${workflowId}/agents/permission-envelope.md`,
    `ai-workflows/${workflowId}/agents.yml`,
    `ai-workflows/${workflowId}/agents/elastic-agent-pool.md`,
  ];
  if (!Array.isArray(sourceManifestPaths) || new Set(sourceManifestPaths).size !== sourceManifestPaths.length
    || requiredSources.some((source) => !sourceManifestPaths.includes(source))) {
    throw new Error('BLOCKED_JUDGE_INSTANCE_SOURCE_MANIFEST');
  }
  if (!Array.isArray(focusedGovernanceValidationCommands)
    || focusedGovernanceValidationCommands.length === 0
    || new Set(focusedGovernanceValidationCommands).size !== focusedGovernanceValidationCommands.length
    || focusedGovernanceValidationCommands.some((command) => !nonEmpty(command))
    || !nonEmpty(canonicalLiveScenario) || !nonEmpty(scheduleName)) {
    throw new Error('BLOCKED_JUDGE_INSTANCE_BINDING_REQUIRED');
  }
  return `INSTANTIATED_SHARED_JUDGE:${logicalProjectId}:${taskId}`;
}

export function proxyCoderActivationDecision({ gate1Evidence, ticketId, capability = 'local-hermes-delegation' }) {
  const required = ['hermesReady', 'asusQwenUsable', 'requestAcknowledged', 'codebaseWorkStarted',
    'correlatedStatusReturned', 'sanitizedFailureVerified'];
  if (ticketId !== 'ari:cloud:trello::card/workspace/631cab2a192e3303df9d967d/6a945e43c94cea9e014c13b5'
    || capability !== 'local-hermes-delegation'
    || required.some((field) => gate1Evidence?.[field] !== true)) {
    throw new Error('BLOCKED_PROXY_CODER_GATE_1_EVIDENCE_REQUIRED');
  }
  return 'PROXY_CODER_ACTIVATION_GATE_PASSED';
}

export function proxyCoderProxyRouteDecision({ callerKind, callerTaskId, currentTaskId, designerTaskId,
  capability = 'local-hermes-delegation', operations = [] }) {
  const humanRoute = callerKind === 'human' && nonEmpty(currentTaskId) && callerTaskId === currentTaskId;
  const designerRoute = callerKind === 'designer-reviewer' && nonEmpty(designerTaskId)
    && callerTaskId === designerTaskId;
  if ((!humanRoute && !designerRoute) || capability !== 'local-hermes-delegation') {
    throw new Error('BLOCKED_PROXY_CODER_PROXY_ROUTE');
  }
  if (operations.length !== 3 || operations[0] !== 'local_hermes_submit'
    || operations[1] !== 'local_hermes_status' || operations[2] !== 'local_proxy_usage') {
    throw new Error('BLOCKED_PROXY_CODER_UNREGISTERED_OPERATION');
  }
  return humanRoute ? 'PROXY_CODER_HUMAN_PROXY_ROUTE' : 'PROXY_CODER_DESIGNER_PROXY_ROUTE';
}

export function ticketDecision({ clearMatches, boundedMatches = [] }) {
  if (clearMatches.length > 1) throw new Error('BLOCKED_AMBIGUOUS_OR_DUPLICATE_TICKET');
  if (clearMatches.length === 1) return `REUSE_TICKET:${clearMatches[0]}`;
  if (boundedMatches.length > 1) throw new Error('BLOCKED_AMBIGUOUS_OR_DUPLICATE_TICKET');
  if (boundedMatches.length === 1) return `ADD_CHECKLIST_ITEM:${boundedMatches[0]}`;
  return 'CREATE_EXACTLY_ONE_AUTHORIZED_TICKET';
}

export function validateNewTicketMetadata({ labels, workType, preExistingFunctionality = false, priority, estimate, approximatePlan = [] }) {
  if (!Array.isArray(labels) || labels.length === 0 || labels.some((label) => !nonEmpty(label))) {
    throw new Error('BLOCKED_MISSING_GROUPING_LABELS');
  }
  const normalizedLabels = [...new Set(labels.map((label) => label.trim().toLowerCase()))];
  if (!['bug', 'feature', 'enhancement', 'maintenance'].includes(workType)) {
    throw new Error('BLOCKED_INVALID_WORK_TYPE');
  }
  if (workType === 'bug' && !normalizedLabels.includes('bug')) {
    throw new Error('BLOCKED_MISSING_CANONICAL_BUG_LABEL');
  }
  if (workType === 'bug' && preExistingFunctionality !== true) {
    throw new Error('BLOCKED_UNGROUNDED_BUG_CLASSIFICATION');
  }
  if (!estimate || !Number.isFinite(estimate.value) || estimate.value <= 0 || !['hours', 'days'].includes(estimate.unit)) {
    throw new Error('BLOCKED_INVALID_HUMAN_TIME_ESTIMATE');
  }
  if (!priority || !['critical', 'high', 'medium', 'low'].includes(priority.level) || !nonEmpty(priority.basis)) {
    throw new Error('BLOCKED_INVALID_GROUNDED_PRIORITY');
  }
  if (!Array.isArray(approximatePlan) || approximatePlan.length > 5 || approximatePlan.some((step) => !nonEmpty(step))) {
    throw new Error('BLOCKED_INVALID_APPROXIMATE_PLAN');
  }
  return { labels: normalizedLabels, workType, preExistingFunctionality, priority, estimate, approximatePlan };
}

const GOVERNANCE_RECEIPT_ORDER = ['disclosure', 'explanation', 'validation', 'comprehension', 'authorization'];

const HUMAN_SEEDED_RULE_OPERATIONS = new Set([
  'correct-expression',
  'rephrase-preserving-meaning',
  'replicate-to-explicit-locations',
  'synchronize-human-named-representations',
  'add-mechanical-validation',
]);

const HUMAN_SEEDED_RULE_REPRESENTATION_KINDS = new Set([
  'team-policy-row',
  'role-declaration',
  'diagram',
  'validation-test',
]);

export function governanceHumanRuleSeedDecision({ directHumanRequest = false, humanAuthoredMarkdownDiff = false,
  seedPredatesJudgeTurn = false, seedAuthorshipVerifiedBy, humanIdentifiedSeedPaths = [], operation,
  gitDiffVerified = false, gitDiffComparedAgainstHead = false,
  diffContainsIdentifiedSeed = false, semanticDeviation = false,
  explicitTargetPaths = [], explicitTargetsWithinSeedScope = false,
  humanNamedProjectionFamily,
  humanRequestedRepresentationSynchronization = false,
  projectionTargetsResolvedFromCanonicalReferences = false, projectionPathsDisclosed = false,
  resolvedProjectionPaths = [], resolvedProjectionKinds = [], projectionScopeMatchesSeed = false,
  projectionRequiresScopeExpansion = false, projectionRepresentationAmbiguous = false }) {
  const ordinaryHumanSeed = humanAuthoredMarkdownDiff === true
    && seedAuthorshipVerifiedBy === 'human-in-current-task';
  if (!directHumanRequest || !ordinaryHumanSeed || seedPredatesJudgeTurn !== true
    || gitDiffVerified !== true || gitDiffComparedAgainstHead !== true || diffContainsIdentifiedSeed !== true
    || !Array.isArray(humanIdentifiedSeedPaths) || humanIdentifiedSeedPaths.length === 0
    || new Set(humanIdentifiedSeedPaths).size !== humanIdentifiedSeedPaths.length
    || humanIdentifiedSeedPaths.some((item) => !nonEmpty(item) || !item.endsWith('.md'))) {
    throw new Error('BLOCKED_HUMAN_RULE_SEED_REQUIRED');
  }
  if (!HUMAN_SEEDED_RULE_OPERATIONS.has(operation)) throw new Error('BLOCKED_JUDGE_RULE_ORIGINATION');
  if (semanticDeviation) throw new Error('BLOCKED_JUDGE_RULE_SEMANTIC_DEVIATION');
  if (operation === 'replicate-to-explicit-locations' && explicitTargetsWithinSeedScope !== true) {
    throw new Error('BLOCKED_JUDGE_RULE_SCOPE_EXPANSION');
  }
  if (operation === 'replicate-to-explicit-locations'
    && (!Array.isArray(explicitTargetPaths) || explicitTargetPaths.length === 0
      || explicitTargetPaths.some((item) => !nonEmpty(item)))) {
    throw new Error('BLOCKED_JUDGE_RULE_REPLICATION_TARGET_REQUIRED');
  }
  if (operation === 'synchronize-human-named-representations'
    && (projectionRequiresScopeExpansion === true || projectionScopeMatchesSeed !== true)) {
    throw new Error('BLOCKED_JUDGE_RULE_SCOPE_EXPANSION');
  }
  if (operation === 'synchronize-human-named-representations' && projectionRepresentationAmbiguous === true) {
    throw new Error('BLOCKED_JUDGE_RULE_PROJECTION_AMBIGUITY');
  }
  if (operation === 'synchronize-human-named-representations'
    && (humanRequestedRepresentationSynchronization !== true || !nonEmpty(humanNamedProjectionFamily)
      || projectionTargetsResolvedFromCanonicalReferences !== true || projectionPathsDisclosed !== true
      || !Array.isArray(resolvedProjectionPaths) || resolvedProjectionPaths.length === 0
      || new Set(resolvedProjectionPaths).size !== resolvedProjectionPaths.length
      || resolvedProjectionPaths.some((item) => !nonEmpty(item))
      || !Array.isArray(resolvedProjectionKinds) || resolvedProjectionKinds.length === 0
      || new Set(resolvedProjectionKinds).size !== resolvedProjectionKinds.length
      || resolvedProjectionKinds.some((item) => !HUMAN_SEEDED_RULE_REPRESENTATION_KINDS.has(item)))) {
    throw new Error('BLOCKED_JUDGE_RULE_PROJECTION_FAMILY_REQUIRED');
  }
  return 'JUDGE_HUMAN_SEEDED_RULE_MAINTENANCE_ALLOWED';
}

export function validateGovernanceReceiptChain({ governanceDiffId, receipts, consumedReceiptIds = [], effect, repository, branch, remote, target, prDestination }) {
  if (!nonEmpty(governanceDiffId)) throw new Error('BLOCKED_GOVERNANCE_DIFF_ID_REQUIRED');
  const ordered = GOVERNANCE_RECEIPT_ORDER.map((name) => receipts?.[name]);
  if (ordered.some((receipt) => !receipt || receipt.governanceDiffId !== governanceDiffId)) throw new Error('BLOCKED_GOVERNANCE_RECEIPT_DIFF_MISMATCH');
  if (ordered.some((receipt) => !nonEmpty(receipt.receiptId))) throw new Error('BLOCKED_GOVERNANCE_RECEIPT_ID_REQUIRED');
  if (new Set(ordered.map((receipt) => receipt.receiptId)).size !== ordered.length) throw new Error('BLOCKED_GOVERNANCE_DUPLICATE_RECEIPT_ID');
  if (ordered.some((receipt) => !Number.isInteger(receipt.sequence))) throw new Error('BLOCKED_GOVERNANCE_RECEIPT_SEQUENCE_REQUIRED');
  if (ordered.some((receipt, index) => index > 0 && receipt.sequence <= ordered[index - 1].sequence)) throw new Error('BLOCKED_GOVERNANCE_RECEIPT_ORDER');
  const comprehension = receipts.comprehension;
  if (!Array.isArray(comprehension.coverage) || comprehension.coverage.length === 0 || comprehension.coverage.some((item) => item?.understood !== true)) {
    throw new Error('BLOCKED_GOVERNANCE_UNDERSTANDING_COVERAGE');
  }
  const authorization = receipts.authorization;
  if (consumedReceiptIds.includes(authorization.receiptId)) throw new Error('BLOCKED_GOVERNANCE_REUSED_AUTHORIZATION');
  if (authorization.action !== effect || Array.isArray(authorization.action)) throw new Error('BLOCKED_GOVERNANCE_BUNDLED_OR_WRONG_ACTION');
  for (const [name, actual] of [['repository', repository], ['branch', branch], ['remote', remote], ['target', target], ['prDestination', prDestination]]) {
    if ((actual ?? null) !== (authorization[name] ?? null)) throw new Error(`BLOCKED_GOVERNANCE_WRONG_${name.toUpperCase()}`);
  }
  return { authorizationReceiptId: authorization.receiptId, governanceDiffId };
}

export function governancePublicationDecision({ governanceDiffId, currentGovernanceDiffId, protectedWorkingTreeClean = false, receipts, consumedReceiptIds, effect, repository, branch, remote, target, prDestination, verifiedEffects = {}, ambiguousOutcome = false, retryExplicitlyAllowed = false, verifiedExistingPrId, verifiedCanonicalPrUrl }) {
  if (effect === 'commit' && currentGovernanceDiffId !== governanceDiffId) throw new Error('BLOCKED_GOVERNANCE_CURRENT_DIFF_MISMATCH');
  if (effect !== 'commit' && protectedWorkingTreeClean !== true) throw new Error('BLOCKED_GOVERNANCE_POST_COMMIT_PROTECTED_CHANGES');
  const validated = validateGovernanceReceiptChain({ governanceDiffId, receipts, consumedReceiptIds, effect, repository, branch, remote, target, prDestination });
  if (ambiguousOutcome && !retryExplicitlyAllowed) throw new Error('BLOCKED_GOVERNANCE_EFFECT_READBACK_REQUIRED');
  const required = { commit: [], push: ['commit'], 'create-pr': ['commit', 'push'], 'update-pr': ['commit', 'push'], 'open-pr': ['commit', 'push'] };
  if (!Object.hasOwn(required, effect)) throw new Error('BLOCKED_GOVERNANCE_EFFECT_NOT_ALLOWED');
  for (const prior of required[effect]) {
    const receipt = verifiedEffects[prior];
    if (!receipt?.verified || receipt.governanceDiffId !== governanceDiffId || receipt.repository !== repository || receipt.branch !== branch || receipt.remote !== remote) {
      throw new Error('BLOCKED_GOVERNANCE_PUBLICATION_ORDER');
    }
  }
  if (effect === 'update-pr' && !nonEmpty(verifiedExistingPrId)) throw new Error('BLOCKED_GOVERNANCE_VERIFIED_PR_IDENTITY_REQUIRED');
  if (effect === 'open-pr') {
    const prReceipt = verifiedEffects['create-pr'] ?? verifiedEffects['update-pr'];
    if (!prReceipt?.verified || prReceipt.governanceDiffId !== governanceDiffId || !nonEmpty(verifiedCanonicalPrUrl) || prReceipt.prUrl !== verifiedCanonicalPrUrl) {
      throw new Error('BLOCKED_GOVERNANCE_CANONICAL_PR_REQUIRED');
    }
  }
  return { decision: 'EXECUTE_EXACT_REGISTERED_GOVERNANCE_EFFECT', consumeReceiptIdOnSuccess: validated.authorizationReceiptId };
}

export function governanceMarkdownActivationDecision({ governanceDiffId, verifiedCommitReceipt, initializedDiffId, initializedCommitSha, initializedRoles = [], canonicalScenario, liveTestStatus, humanApprovedProceedWithoutReinitialization = false }) {
  const requiredRoles = Object.keys(loadWorkflowAgents().agents);
  const freshInitialization = verifiedCommitReceipt?.verified
    && verifiedCommitReceipt.governanceDiffId === governanceDiffId
    && nonEmpty(verifiedCommitReceipt.commitSha)
    && nonEmpty(governanceDiffId)
    && initializedDiffId === governanceDiffId
    && initializedCommitSha === verifiedCommitReceipt.commitSha
    && !requiredRoles.some((role) => !initializedRoles.includes(role))
    && new Set(initializedRoles).size === requiredRoles.length;
  if (!freshInitialization && !humanApprovedProceedWithoutReinitialization) {
    throw new Error('BLOCKED_HUMAN_REINITIALIZATION_DECISION_REQUIRED');
  }
  if (canonicalScenario !== 'ai-workflows/dev/dev-live-test.md') throw new Error('BLOCKED_GOVERNANCE_LIVE_TEST_SCENARIO_MISMATCH');
  if (liveTestStatus !== 'PASS') throw new Error('BLOCKED_GOVERNANCE_LIVE_TEST_NOT_PASSED');
  return freshInitialization
    ? 'MARKDOWN_GOVERNANCE_ACTIVATION_GATE_PASSED'
    : 'MARKDOWN_GOVERNANCE_ACTIVATION_HUMAN_EXCEPTION_PASSED';
}

export function governanceJudgeScenarioCommunicationDecision({ directHumanAuthorized, governanceDiffId,
  verifiedCommitReceipt, initializedDiffId, initializedCommitSha, scenario, action, recipientRole,
  humanApprovedProceedWithoutReinitialization = false }) {
  const freshInitialization = verifiedCommitReceipt?.verified
    && verifiedCommitReceipt.governanceDiffId === governanceDiffId
    && verifiedCommitReceipt.commitSha === initializedCommitSha
    && governanceDiffId === initializedDiffId;
  if (!directHumanAuthorized || (!freshInitialization && !humanApprovedProceedWithoutReinitialization) || scenario !== 'ai-workflows/dev/dev-live-test.md') {
    throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
  }
  if (action === 'observe-evidence' && recipientRole === 'lead/human') return 'JUDGE_CANONICAL_SCENARIO_OBSERVATION_ALLOWED';
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function governanceAdvisoryDecision({ callerRole, advisoryId, callerTaskId, returnTaskId, proposedAction,
  evidenceRefs = [], evidenceVerified = false }) {
  void callerRole; void advisoryId; void callerTaskId; void returnTaskId; void proposedAction;
  void evidenceRefs; void evidenceVerified;
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function governanceJudgeAdvisoryReplyDecision({ actorRole, action, purpose, recipientRole, advisoryId,
  requestAdvisoryId, recipientTaskId, approvedSourceTaskId, advisoryPacketVerified = false }) {
  void actorRole; void action; void purpose; void recipientRole; void advisoryId; void requestAdvisoryId;
  void recipientTaskId; void approvedSourceTaskId; void advisoryPacketVerified;
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function governanceJudgeProposalDecision({ senderRole, requestId, category, workflowProject, sourceTaskId,
  ticketId, targetRepository, humanApprovedExactRequest = false, managerContextVerified = false }) {
  void senderRole; void requestId; void category; void workflowProject; void sourceTaskId;
  void ticketId; void targetRepository; void humanApprovedExactRequest; void managerContextVerified;
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function governanceJudgeProposalReportDecision({ action, purpose, requestId, approvedRequestId,
  recipientRole, recipientTaskId, approvedSourceTaskId, approvedConversation = false }) {
  void action; void purpose; void requestId; void approvedRequestId; void recipientRole;
  void recipientTaskId; void approvedSourceTaskId; void approvedConversation;
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function managerGovernanceContextVerificationDecision({ senderRole, requestId, humanApprovedExactRequest = false,
  workflowProject, sourceTaskId, ticketId, targetRepository, verifiedTicketId, verifiedProject,
  verifiedRepository, verifiedSourceTaskId }) {
  void senderRole; void requestId; void humanApprovedExactRequest; void workflowProject; void sourceTaskId;
  void ticketId; void targetRepository; void verifiedTicketId; void verifiedProject;
  void verifiedRepository; void verifiedSourceTaskId;
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function judgeScenarioReloadDecision({ canonicalScenario, verifiedContractGap = false, reloadRoles = [], existingRoles = [] }) {
  void canonicalScenario; void verifiedContractGap; void reloadRoles; void existingRoles;
  throw new Error('BLOCKED_GOVERNANCE_JUDGE_COMMUNICATION_FIREWALL');
}

export function managerHeartbeatDecision({ schedules = [], managerTaskId, previousManagerTaskId, project, cadenceMinutes = 10, capability = 'observe-lifecycle' }) {
  if (!nonEmpty(project)) throw new Error('BLOCKED_MANAGER_HEARTBEAT_MISSING_PROJECT');
  const active = schedules.filter((schedule) => schedule.active);
  if (active.length === 0) return `CREATE_MANAGER_HEARTBEAT:${managerTaskId}`;
  if (active.length > 1) throw new Error('BLOCKED_MANAGER_HEARTBEAT_COUNT');
  const schedule = active[0];
  if (schedule.targetRole !== 'manager') throw new Error('BLOCKED_MANAGER_HEARTBEAT_WRONG_ROLE');
  if (schedule.project !== project) throw new Error('BLOCKED_MANAGER_HEARTBEAT_FOREIGN_PROJECT');
  if (schedule.cadenceMinutes !== cadenceMinutes) throw new Error('BLOCKED_MANAGER_HEARTBEAT_WRONG_CADENCE');
  if (!['observe-lifecycle', 'reconcile-tracker-state', 'verify-closure-evidence'].includes(capability)) throw new Error('BLOCKED_MANAGER_HEARTBEAT_CAPABILITY');
  if (schedule.targetTaskId !== managerTaskId) {
    if (nonEmpty(previousManagerTaskId) && schedule.targetTaskId === previousManagerTaskId) return `REPLACE_EXACT_MANAGER_HEARTBEAT:${schedule.scheduleId}:${previousManagerTaskId}->${managerTaskId}`;
    throw new Error('BLOCKED_MANAGER_HEARTBEAT_STALE_TARGET');
  }
  return 'MANAGER_HEARTBEAT_EXACT';
}

export function judgeHeartbeatDecision({ schedules = [], judgeTaskId, previousJudgeTaskId, project,
  cadenceMinutes = 10, capability = 'audit-new-role-turns' }) {
  if (!nonEmpty(project)) throw new Error('BLOCKED_JUDGE_HEARTBEAT_MISSING_PROJECT');
  if (!nonEmpty(judgeTaskId)) throw new Error('BLOCKED_JUDGE_HEARTBEAT_MISSING_TASK');
  const active = schedules.filter((schedule) => schedule.active);
  if (active.length === 0) return `CREATE_JUDGE_HEARTBEAT:${judgeTaskId}`;
  if (active.length > 1) throw new Error('BLOCKED_JUDGE_HEARTBEAT_COUNT');
  const schedule = active[0];
  if (schedule.targetRole !== 'judge') throw new Error('BLOCKED_JUDGE_HEARTBEAT_WRONG_ROLE');
  if (schedule.project !== project) throw new Error('BLOCKED_JUDGE_HEARTBEAT_FOREIGN_PROJECT');
  if (schedule.cadenceMinutes !== cadenceMinutes) throw new Error('BLOCKED_JUDGE_HEARTBEAT_WRONG_CADENCE');
  if (capability !== 'audit-new-role-turns') throw new Error('BLOCKED_JUDGE_HEARTBEAT_CAPABILITY');
  if (schedule.targetTaskId !== judgeTaskId) {
    if (nonEmpty(previousJudgeTaskId) && schedule.targetTaskId === previousJudgeTaskId) {
      return `REPLACE_EXACT_JUDGE_HEARTBEAT:${schedule.scheduleId}:${previousJudgeTaskId}->${judgeTaskId}`;
    }
    throw new Error('BLOCKED_JUDGE_HEARTBEAT_STALE_TARGET');
  }
  return 'JUDGE_HEARTBEAT_EXACT';
}

export function publicGovernancePublicationDecision({ sourcePath, targetRepository, targetPath,
  existingPublicPathVerified = false, registryEntry, portabilityReviewPassed = false,
  privacyReviewPassed = false, licenseReviewPassed = false, exactMirrorVerified = false,
  bothSidesFetched = false, divergenceReviewed = false }) {
  if (![sourcePath, targetRepository, targetPath].every(nonEmpty)) {
    throw new Error('BLOCKED_PUBLIC_SYNC_SCOPE');
  }
  const registered = registryEntry?.publication === 'public-mirror'
    && registryEntry.syncMode === 'exact-mirror'
    && registryEntry.reconciliation === 'bidirectional'
    && registryEntry.sourcePath === sourcePath
    && registryEntry.targetRepository === targetRepository
    && registryEntry.targetPath === targetPath;
  if (!existingPublicPathVerified && !registered) throw new Error('BLOCKED_PUBLIC_SYNC_SCOPE');
  if (!portabilityReviewPassed || !privacyReviewPassed || !licenseReviewPassed) {
    throw new Error('BLOCKED_PUBLIC_SYNC_REVIEW_REQUIRED');
  }
  if (!exactMirrorVerified) throw new Error('BLOCKED_PUBLIC_SYNC_EXACT_MIRROR_REQUIRED');
  if (!bothSidesFetched || !divergenceReviewed) throw new Error('BLOCKED_PUBLIC_SYNC_RECONCILIATION_REQUIRED');
  return 'PUBLIC_GOVERNANCE_SYNC_CANDIDATE_ALLOWED';
}

export function publicMirrorManifestDecision({ include, privateMembers, publicMembers,
  symlinkMembers = [], modeHashMismatches = [] }) {
  if (!Array.isArray(include) || include.length === 0) throw new Error('BLOCKED_PUBLIC_SYNC_MANIFEST_REQUIRED');
  const normalized = include.map((entry) => typeof entry === 'string' ? entry : '');
  if (normalized.some((entry) => !entry || entry !== entry.trim() || entry.startsWith('/')
    || entry !== path.posix.normalize(entry) || entry.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    || entry.includes('\\') || /[\u0000-\u001f\u007f]/u.test(entry))
    || new Set(normalized).size !== normalized.length) {
    throw new Error('BLOCKED_PUBLIC_SYNC_MANIFEST_PATH');
  }
  if (symlinkMembers.length) throw new Error('BLOCKED_PUBLIC_SYNC_MANIFEST_SYMLINK');
  const expected = [...normalized].sort();
  if (JSON.stringify(expected) !== JSON.stringify([...privateMembers].sort())) throw new Error('BLOCKED_PUBLIC_SYNC_PRIVATE_MEMBER');
  if (JSON.stringify(expected) !== JSON.stringify([...publicMembers].sort())) throw new Error('BLOCKED_PUBLIC_SYNC_PUBLIC_INVENTORY');
  if (modeHashMismatches.length) throw new Error('BLOCKED_PUBLIC_SYNC_MODE_HASH_MISMATCH');
  return 'PUBLIC_MIRROR_MANIFEST_EXACT';
}

const GIT_PROVENANCE_ROLES = new Set([
  ...Object.keys(loadWorkflowAgents().agents).map((role) => role.replace(/\s*\/\s*|\s+/g, '-')),
  'human',
]);

export function gitRoleProvenanceDecision({ branchName, initiatingRole, executorRole, existingLegacy = false,
  legacyAuthorization = null, reviewMetadata = null }) {
  if (![initiatingRole, executorRole].every((role) => GIT_PROVENANCE_ROLES.has(role))) {
    throw new Error('BLOCKED_GIT_PROVENANCE_ROLE');
  }
  const expectedPrefix = `${initiatingRole}/`;
  const canonical = branchName.startsWith(expectedPrefix)
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(branchName.slice(expectedPrefix.length));
  if (!canonical) {
    if (!existingLegacy) throw new Error('BLOCKED_GIT_PROVENANCE_BRANCH');
    if (legacyAuthorization?.branch !== branchName || !['commit', 'push', 'pr'].includes(legacyAuthorization?.effect)
      || legacyAuthorization?.initiatingRole !== initiatingRole) throw new Error('BLOCKED_GIT_LEGACY_AUTHORIZATION');
  }
  if (reviewMetadata && (reviewMetadata.initiatingRole !== initiatingRole
    || reviewMetadata.reviewedByRole !== 'designer-reviewer'
    || !GIT_PROVENANCE_ROLES.has(reviewMetadata.producingRole))) {
    throw new Error('BLOCKED_GIT_REVIEW_PROVENANCE');
  }
  return canonical ? `GIT_ROLE_PROVENANCE:${initiatingRole}:${executorRole}`
    : `GIT_LEGACY_PROVENANCE:${initiatingRole}:${executorRole}:${legacyAuthorization.effect}`;
}

export function agentAwareSourceControlDecision({ callerTaskId, trustedCallerTaskId, callerRole, trustedCallerRole,
  initiatingRole, returnTaskId, trustedReturnTaskId, changeId, producingRole, producingTaskId, productionAttestation,
  trustedProductionReceipt, consumedProductionReceiptIds = [], executorRole, branchName,
  identityEnforcementEnabled, trustedIdentityEnforcementEnabled, identityConfigPath, trustedIdentityConfigPath }) {
  if (![callerTaskId, trustedCallerTaskId, returnTaskId, trustedReturnTaskId].every(nonEmpty)
    || callerTaskId !== trustedCallerTaskId || callerRole !== trustedCallerRole
    || callerRole !== initiatingRole || returnTaskId !== trustedReturnTaskId) {
    throw new Error('BLOCKED_SOURCE_CONTROL_CALLER_PROVENANCE');
  }
  if (![identityConfigPath, trustedIdentityConfigPath].every(nonEmpty)
    || identityConfigPath !== trustedIdentityConfigPath
    || typeof identityEnforcementEnabled !== 'boolean'
    || identityEnforcementEnabled !== trustedIdentityEnforcementEnabled) {
    throw new Error('BLOCKED_SOURCE_CONTROL_IDENTITY_CONFIG');
  }
  if (!GIT_PROVENANCE_ROLES.has(callerRole) || !GIT_PROVENANCE_ROLES.has(executorRole)
    || (identityEnforcementEnabled && producingRole && !GIT_PROVENANCE_ROLES.has(producingRole))) {
    throw new Error('BLOCKED_SOURCE_CONTROL_ROLE_PROVENANCE');
  }
  gitRoleProvenanceDecision({ branchName, initiatingRole: callerRole, executorRole });
  if (!trustedIdentityEnforcementEnabled) return `SOURCE_CONTROL_BRANCH_PROVENANCE:${callerRole}:${branchName}`;
  if (!nonEmpty(changeId)) throw new Error('BLOCKED_SOURCE_CONTROL_CHANGE_ID');
  if (producingRole && producingRole !== callerRole
    && (!nonEmpty(producingTaskId)
      || productionAttestation?.receiptId !== trustedProductionReceipt?.receiptId
      || productionAttestation?.producingRole !== producingRole
      || trustedProductionReceipt?.producingRole !== producingRole
      || productionAttestation?.producingTaskId !== producingTaskId
      || trustedProductionReceipt?.producingTaskId !== producingTaskId
      || productionAttestation?.callerTaskId !== callerTaskId
      || trustedProductionReceipt?.callerTaskId !== callerTaskId
      || productionAttestation?.returnTaskId !== returnTaskId
      || trustedProductionReceipt?.returnTaskId !== returnTaskId
      || productionAttestation?.changeId !== changeId
      || trustedProductionReceipt?.changeId !== changeId
      || !nonEmpty(productionAttestation?.receiptId)
      || consumedProductionReceiptIds.includes(productionAttestation?.receiptId))) {
    throw new Error('BLOCKED_SOURCE_CONTROL_PRODUCTION_ATTESTATION');
  }
  return `SOURCE_CONTROL_PROVENANCE:${callerRole}:${producingRole || callerRole}:${executorRole}:${returnTaskId}`;
}

export function freshTicketIntakeDecision({ newPrompt, managerLookupPerformed, cachedFactsUsed = false, historicalCommentUsedAsApproval = false }) {
  if (!newPrompt) return 'NO_NEW_TICKET_INTAKE';
  if (!managerLookupPerformed) throw new Error('BLOCKED_FRESH_MANAGER_LOOKUP_REQUIRED');
  if (cachedFactsUsed) throw new Error('BLOCKED_CACHED_TICKET_FACTS_PROHIBITED');
  if (historicalCommentUsedAsApproval) throw new Error('BLOCKED_HISTORICAL_COMMENT_NOT_CURRENT_APPROVAL');
  return 'FRESH_MANAGER_TICKET_INTAKE_REQUIRED';
}
