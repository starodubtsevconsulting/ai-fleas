/**
 * Purpose: execute one fail-closed, Admin-only codex-app lifecycle transaction.
 * Caller: an authorized lifecycle controller imports initializeWorkflowAdmin;
 * no launcher or desktop runtime invokes this module automatically.
 * Inputs: canonical parsed sources, exact scope, one-time human approval, and
 * injected host ports. Output: ready (created/reused) or a concrete blocked result.
 * Effects: reads complete host catalogs and generic bindings; creates at most one
 * Admin and submits its single bootstrap INIT. An explicitly approved exact live
 * predecessor remains untouched until the plugin activates its ready successor.
 * Never messages an initialized Admin or retires a predecessor before readiness.
 * Ports must bridge the real host; in-memory tests do not prove native support.
 */
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { selectLifecycleRole } from './agents/select-role-initialization.mjs';
import { projectRootContains } from './native-project-catalog.mjs';
import { buildAdminInitPrompt } from './admin-initialization.mjs';

const ports = ['catalog', 'prerequisites', 'verifyApproval', 'create', 'initialize', 'wait'];
const exact = isDeepStrictEqual;
const fail = reason => { throw new Error(reason); };
const scopeKey = s => [s.profileId, s.workflowId, s.logicalProjectId, s.runtimeScope].join('\u0000');

/** Generic workflow binding scope, also suitable for full-roster reconciliation. */
export function normalizeAdminScope(scope) {
  if (!scope || scope.kind !== 'workflow' || ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScope'].some(k =>
    typeof scope[k] !== 'string' || !scope[k].trim()) || !Array.isArray(scope.projects) || !scope.projects.length)
    fail('ADMIN_SCOPE_INVALID');
  const projects = scope.projects.map(p => {
    if (!p?.id || !p.savedProjectId || !path.isAbsolute(p.root || '')) fail('ADMIN_PROJECT_INVALID');
    return { id: p.id, savedProjectId: p.savedProjectId, root: path.resolve(p.root) };
  });
  if (new Set(projects.map(p => p.id)).size !== projects.length) fail('ADMIN_PROJECT_AMBIGUOUS');
  return { kind: 'workflow', profileId: scope.profileId, workflowId: scope.workflowId,
    logicalProjectId: scope.logicalProjectId, runtimeScope: scope.runtimeScope, projects };
}

function inspectCatalog(catalog, scope) {
  if (catalog?.complete !== true || !['tasks', 'bindings', 'projects'].every(k => Array.isArray(catalog[k])))
    fail('HOST_CATALOG_INCOMPLETE');
  for (const project of scope.projects) {
    const matches = catalog.projects.filter(p => p.id === project.savedProjectId);
    if (matches.length !== 1) fail('SAVED_PROJECT_MISMATCH');
    const saved = matches[0];
    if (saved.rootsComplete !== true || !Array.isArray(saved.roots) || !saved.roots.length ||
        saved.roots.some(root => typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root))
      fail('SAVED_PROJECT_ROOTS_UNVERIFIED');
    const authorized = saved.roots.some(root => projectRootContains(root, project.root));
    if (!authorized)
      fail('SAVED_PROJECT_MISMATCH');
  }
  return catalog.bindings.filter(b => {
    if (b.agentId !== 'admin' || scopeKey(b.scope || {}) !== scopeKey(scope)) return false;
    // A receipt is not live authority. Preserve archived history, but do not
    // reuse it or let it block a newly human-authorized initialization. Only
    // one exact archived host entry proves retirement; missing or duplicate
    // entries remain candidates and fail closed below.
    const tasks = catalog.tasks.filter(t => t.id === b.taskId);
    return !(tasks.length === 1 && tasks[0].status === 'archived');
  });
}

function verifyAdmin(catalog, binding, scope, completion) {
  const tasks = catalog.tasks.filter(t => t.id === binding.taskId);
  if (tasks.length !== 1 || tasks[0].status !== 'active' || binding.status !== 'active' ||
      !Number.isInteger(binding.generation) || binding.generation < 1 ||
      tasks[0].projectAssignmentPending === true ||
      binding.platformAdapter !== 'codex-app' || !exact(normalizeAdminScope(binding.scope), scope) ||
      scope.projects[0].savedProjectId !== tasks[0].projectId) fail('ADMIN_IDENTITY_UNVERIFIED');
  const evidence = binding.initialization;
  if (evidence?.readinessToken !== 'ADMIN_READY' || !evidence.completedTurnId || !evidence.completedAt ||
      (completion && (completion.taskId !== binding.taskId ||
      completion.turnId !== evidence.completedTurnId || completion.token !== 'ADMIN_READY' || completion.status !== 'complete')))
    fail('ADMIN_READINESS_UNVERIFIED');
  return { turnId: evidence.completedTurnId, generation: binding.generation };
}

/** Owns the six lifecycle ports; each initialize call keeps transaction state local. */
export class WorkflowAdminInitializer {
  #host;
  constructor(host) {
    this.#host = host;
  }

  /** Validate before effects, reuse exact readiness, or create only one Admin. */
  async initialize(input) {
    const host = this.#host;
    let createdTaskId;
    let acceptedInit;
    try {
      if (ports.some(p => typeof host?.[p] !== 'function')) fail('ADMIN_ONLY_HOST_PORT_UNSUPPORTED');
      const { profile, workflow, registry, manifest, adapter, approval, sources } = input;
      const scope = normalizeAdminScope(input.scope);
      const canonicalWorkflows = profile?.workflows?.filter(w => w.path === workflow?.path) || [];
      if (profile?.name !== scope.profileId || manifest?.workflowId !== scope.workflowId ||
          canonicalWorkflows.length !== 1 || !exact(canonicalWorkflows[0], workflow) ||
          workflow.path !== scope.workflowId + '.workflow.md')
        fail('CANONICAL_SCOPE_MISMATCH');
      const admin = manifest.initializer;
      if (admin?.agentId !== 'admin' || typeof admin.roleDefinition !== 'string' || !admin.roleDefinition ||
          admin.lifecycle !== 'persistent-control' || admin.humanFacing !== 'human-owned' ||
          admin.communicationMode !== 'direct-human-administration-only' ||
          admin.readinessToken !== 'ADMIN_READY' || manifest.agents?.some(a => a.agentId === 'admin'))
        fail('CANONICAL_ADMIN_DECLARATION_MISSING');
      selectLifecycleRole(profile, workflow, registry, manifest, adapter, 'admin');
      if (adapter.workflow !== scope.workflowId) fail('ADAPTER_WORKFLOW_MISMATCH');
      if (!sources || ['profile', 'workflow', 'manifest', 'adapter', 'adminContract', 'selfCommands', 'lifecycle', 'platformContract', 'rules', 'registry', 'initializer'].some(k =>
        typeof sources[k] !== 'string' || !sources[k])) fail('CANONICAL_SOURCE_REFERENCES_MISSING');
      if (!Array.isArray(sources.projectManifests) || sources.projectManifests.length !== scope.projects.length ||
          sources.projectManifests.some(p => typeof p !== 'string' || !p)) fail('PROJECT_SOURCE_REFERENCES_MISSING');
      const commonAdminPath = path.resolve(path.dirname(sources.manifest), '../_common/roles/admin.md');
      if (sources.commonAdminContract && sources.commonAdminContract !== commonAdminPath)
        fail('ADMIN_CONTRACT_MISMATCH');
      if (path.resolve(path.dirname(sources.manifest), admin.roleDefinition) !== sources.adminContract ||
          path.resolve(path.dirname(sources.adapter), adapter.role_contracts.admin) !== sources.adminContract ||
          (sources.adminContract !== commonAdminPath &&
            (!admin.commonRoleDefinition || sources.commonAdminContract !== commonAdminPath ||
              path.resolve(path.dirname(sources.manifest), admin.commonRoleDefinition) !== commonAdminPath)))
        fail('ADMIN_CONTRACT_MISMATCH');
      const payload = input.bootstrapPayload;
      if (payload?.binding?.agentId !== 'admin' || payload.binding.platformAdapter !== 'codex-app' ||
          !Number.isInteger(payload.binding.generation) || payload.binding.generation < 1 ||
          !exact(normalizeAdminScope(payload.binding.scope), scope) ||
          payload.binding.initialization?.readinessToken !== 'ADMIN_READY' ||
          payload.prompt !== buildAdminInitPrompt(payload.binding.scope, payload.binding.initialization?.auditTransport)) fail('ADMIN_BOOTSTRAP_PAYLOAD_INVALID');
      const expectedSources = [
        ['portable-role', sources.adminContract], ['portable-manifest', sources.manifest], ['platform-adapter', sources.adapter],
        ...(sources.commonAdminContract ? [['common-admin-role', sources.commonAdminContract]] : []),
        ['work-profile', sources.profile], ['platform-registry', sources.registry], ['workflow', sources.workflow],
        ['lifecycle', sources.lifecycle], ['self-commands', sources.selfCommands], ['admin-only-initializer', sources.initializer],
        ['platform-contract', sources.platformContract], ['rules', sources.rules],
        ...(sources.commandConfig ? [['gpt-command-config', sources.commandConfig]] : []),
        ...scope.projects.map((p, i) => ['project-' + p.id, sources.projectManifests[i]]),
      ].map(([id, ref]) => ({ id, ref }));
      if (!exact(payload.binding.initialization.sources, expectedSources) ||
          !exact(payload.binding.initialization.bootstrapAuthorization,
            { ...approval, verified: false, purpose: 'one-time-admin-initialization' }))
        fail('ADMIN_BOOTSTRAP_CANONICAL_DATA_MISMATCH');
      for (const [index, project] of scope.projects.entries()) {
        const refs = input.projectDeclarations?.filter(p => p.id === project.id) || [];
        if (refs.length !== 1 || !workflow.projects?.some(p => p.ref === refs[0].declaredRef) ||
            refs[0].ref !== sources.projectManifests[index] ||
            !path.isAbsolute(refs[0].root || '') || path.resolve(refs[0].root) !== project.root)
          fail('PROJECT_NOT_AUTHORIZED');
      }
      if (await host.verifyApproval({ approval, scope, operation: 'initialize-admin-only' }) !== true)
        fail('HUMAN_APPROVAL_UNVERIFIED');
      if (await host.prerequisites({ scope, platform: 'codex-app', sources }) !== true)
        fail('PLATFORM_PREREQUISITES_UNAVAILABLE');
      let catalog = await host.catalog();
      const replacement = payload.binding.replaces;
      let predecessor;
      if (replacement) {
        const candidates = inspectCatalog(catalog, scope);
        if (replacement.strategy !== 'successor-first' ||
            approval?.humanApproved !== true || approval.replaceTaskId !== replacement.taskId ||
            approval.replaceGeneration !== replacement.generation ||
            payload.binding.generation !== replacement.generation + 1 ||
            candidates.length !== 1 || candidates[0].taskId !== replacement.taskId ||
            candidates[0].generation !== replacement.generation)
          fail('ADMIN_REPLACEMENT_PREDECESSOR_UNVERIFIED');
        predecessor = structuredClone(candidates[0]);
        const oldScope = normalizeAdminScope(predecessor.scope);
        if (scopeKey(oldScope) !== scopeKey(scope) ||
            oldScope.projects.some(p => p.savedProjectId !== scope.projects[0].savedProjectId))
          fail('ADMIN_REPLACEMENT_SCOPE_MISMATCH');
        verifyAdmin(catalog, predecessor, oldScope);
        const oldReady = await host.wait({ taskId: predecessor.taskId, timeoutMs: 60000 });
        catalog = await host.catalog();
        verifyAdmin(catalog, predecessor, oldScope, oldReady);
      } else if (approval?.replaceTaskId !== undefined || approval?.replaceGeneration !== undefined) {
        fail('ADMIN_REPLACEMENT_APPROVAL_REQUIRED');
      }
      const candidatesFor = current => {
        const candidates = inspectCatalog(current, scope);
        if (!predecessor) return candidates;
        const old = current.bindings.filter(b => b.taskId === predecessor.taskId);
        if (old.length !== 1 || old[0].agentId !== 'admin' ||
            old[0].platformAdapter !== 'codex-app' || old[0].generation !== predecessor.generation ||
            !exact(normalizeAdminScope(old[0].scope), normalizeAdminScope(predecessor.scope)) ||
            !(old[0].status === 'active' || (old[0].status === 'superseded' && old[0].supersededBy === createdTaskId)))
          fail('ADMIN_REPLACEMENT_PREDECESSOR_CHANGED');
        return candidates.filter(b => b.taskId !== predecessor.taskId);
      };
      const matches = candidatesFor(catalog);
      // Scope-bearing unbound host tasks are not safe evidence of absence. Titles
      // are deliberately ignored; the controller must resolve exact host identity.
      if (catalog.tasks.some(t => t.status !== 'archived' && t.agentId === 'admin' && scopeKey(t.scope || {}) === scopeKey(scope) &&
          !matches.some(b => b.taskId === t.id))) fail('ADMIN_IDENTITY_UNBOUND');
      // Presentation can reveal a possible unbound Admin, never prove reuse.
      // Do not create a duplicate simply because native tasks lack role metadata.
      if (catalog.tasks.some(t => t.status === 'active' && t.projectId === scope.projects[0].savedProjectId &&
          t.name === payload.endpoint?.title && typeof t.name === 'string' &&
          !catalog.bindings.some(b => b.taskId === t.id))) fail('ADMIN_IDENTITY_UNBOUND');
      if (matches.length > 1) fail('ADMIN_IDENTITY_AMBIGUOUS');
      if (matches.length === 1) {
        verifyAdmin(catalog, matches[0], scope);
        const completion = await host.wait({ taskId: matches[0].taskId, timeoutMs: 60000 });
        if (completion?.status !== 'complete' || completion.taskId !== matches[0].taskId)
          fail('ADMIN_READINESS_UNVERIFIED');
        catalog = await host.catalog();
        const verified = inspectCatalog(catalog, scope);
        if (verified.length !== 1 || verified[0].taskId !== matches[0].taskId) fail('ADMIN_IDENTITY_UNVERIFIED');
        const readiness = verifyAdmin(catalog, verified[0], scope, completion);
        return { status: 'ready', mode: 'reused', taskId: matches[0].taskId,
          token: 'ADMIN_READY', scope, ...readiness };
      }
      const request = { role: 'admin', platform: 'codex-app', scope, sources,
        roleDefinition: admin.roleDefinition, bootstrap: { approval, command: 'INIT', humanOnly: true },
        readinessToken: 'ADMIN_READY' };
      const existingTaskIds = new Set([...catalog.tasks.map(t => t.id), ...catalog.bindings.map(b => b.taskId)]);
      const task = await host.create(request);
      createdTaskId = task?.taskId;
      if (!createdTaskId || task.status !== 'created') fail('ADMIN_CREATION_UNCERTAIN');
      if (existingTaskIds.has(createdTaskId))
        fail('ADMIN_CREATED_TASK_NOT_FRESH');
      // Never queue INIT against an unverified ID merely because create returned it.
      const fresh = await host.catalog();
      const competing = candidatesFor(fresh);
      const createdTasks = fresh.tasks.filter(t => t.id === createdTaskId);
      if (createdTasks.length !== 1 || createdTasks[0].status !== 'active' ||
          createdTasks[0].projectId !== scope.projects[0].savedProjectId || competing.length ||
          fresh.bindings.some(b => b.taskId === createdTaskId) || fresh.tasks.some(t =>
            t.status !== 'archived' && t.id !== createdTaskId && t.id !== predecessor?.taskId &&
            t.agentId === 'admin' && scopeKey(t.scope || {}) === scopeKey(scope)))
        fail('ADMIN_CREATED_TASK_UNVERIFIED');
      const initialized = await host.initialize({ taskId: createdTaskId, payload });
      if (initialized?.taskId !== createdTaskId || initialized.status !== 'submitted' ||
          typeof initialized.turnId !== 'string' || !initialized.turnId) fail('ADMIN_INIT_UNCERTAIN');
      // A later wait/catalog failure cannot erase the acknowledged exact INIT.
      // This is submission evidence only, never proof of completed readiness.
      acceptedInit = { taskId: createdTaskId, mode: 'created', scope,
        generation: payload.binding.generation, turnId: initialized.turnId,
        acceptedInitTurnId: initialized.turnId, initSubmissionStatus: 'accepted',
        bindingEvidence: { taskId: createdTaskId, agentId: 'admin',
          platformAdapter: 'codex-app', generation: payload.binding.generation, scope } };
      const completion = await host.wait({ taskId: createdTaskId,
        timeoutMs: payload.binding.initialization.auditTransport === 'ephemeral-process' ? 300000 : 60000 });
      if (completion?.taskId !== createdTaskId || completion.status !== 'complete' ||
          completion.turnId !== acceptedInit.turnId) fail('ADMIN_READINESS_UNVERIFIED');
      catalog = await host.catalog();
      const active = candidatesFor(catalog);
      if (active.length !== 1 || active[0].taskId !== createdTaskId) fail('ADMIN_IDENTITY_UNVERIFIED');
      const readiness = verifyAdmin(catalog, active[0], scope, completion);
      if (predecessor && (catalog.bindings.find(b => b.taskId === predecessor.taskId)?.status !== 'superseded' ||
          !exact(active[0].replaces, replacement))) fail('ADMIN_REPLACEMENT_CUTOVER_UNVERIFIED');
      return { status: 'ready', mode: 'created', taskId: createdTaskId,
        token: 'ADMIN_READY', scope, ...readiness,
        ...(predecessor ? { replacedTaskId: predecessor.taskId } : {}) };
    } catch (error) {
      createdTaskId ||= error.createdTaskId;
      return { status: 'blocked', reason: error.message,
        ...(createdTaskId ? { orphanTaskId: createdTaskId } : {}),
        ...(acceptedInit ? { ...acceptedInit, readinessStatus: 'unverified' } : {}) };
    }
  }
}

/** Compatibility entry point, backed by the lifecycle transaction object. */
export async function initializeWorkflowAdmin(input, host) {
  return new WorkflowAdminInitializer(host).initialize(input);
}
