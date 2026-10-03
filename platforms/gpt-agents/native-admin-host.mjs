/** Native Admin-only host ports used explicitly by the lifecycle controller.
 * Inputs: supported RPC client and trusted approval/prerequisite/queue callbacks,
 * generic plugin data directory; outputs complete catalogs and exact task receipts.
 * Effects: reads host/project/binding state, creates one task on explicit create,
 * and queues INIT only through the supplied generic plugin bridge. No role registry,
 * project edits, alternate platform fallback, or follow-up messages are implemented.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readNativeProjectCatalog, listNativeProjects, readNativeProject, projectRootContains } from './native-project-catalog.mjs';
const fail = code => { throw new Error(code); };

/** Owns one native connection and its non-durable creation evidence. */
export class NativeAdminHost {
  #client;
  #options;
  #stagedCreates = new Map();
  constructor(client, { pluginData, queueInitialization, verifyApproval, prerequisites,
    createParams = {}, selectedProjectIds, io = fs, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
    if (typeof client?.request !== 'function' || typeof queueInitialization !== 'function' ||
        typeof verifyApproval !== 'function' || typeof prerequisites !== 'function' || !path.isAbsolute(pluginData || ''))
      fail('NATIVE_ADMIN_HOST_CONFIGURATION_INVALID');
    // Same-connection creation evidence only; never a durable identity registry.
    this.#client = client;
    this.#options = { pluginData, queueInitialization, verifyApproval, prerequisites, createParams, selectedProjectIds, io, sleep, now };
  }

  /** Delegate trusted approval without changing its request or result. */
  verifyApproval(request) {
    return this.#options.verifyApproval.call(this, request);
  }

  /** Delegate platform prerequisite verification before lifecycle effects. */
  prerequisites(request) {
    return this.#options.prerequisites.call(this, request);
  }

  /** Return complete project, task and receipt catalogs for transaction validation. */
  async catalog() {
    const client = this.#client;
    const { io, selectedProjectIds } = this.#options;
    return { complete: true, projects: await readNativeProjectCatalog(client, { realpathSync: io.realpathSync, selectedProjectIds }),
      tasks: await this.#tasks(), bindings: this.#bindings() };
  }

  /** Create only Admin after fresh attached-root checks; never widens scope. */
  async create(request) {
    const client = this.#client, stagedCreates = this.#stagedCreates;
    const { io, createParams } = this.#options;
    if (request?.role !== 'admin' || request.platform !== 'codex-app' || !request.scope?.projects?.length) fail('ADMIN_CREATE_REQUEST_INVALID');
    const roots = [...new Set(request.scope.projects.map(project => io.realpathSync(project.root)))];
    const projectId = request.scope.projects[0].savedProjectId;
    if (!projectId || request.scope.projects.some(project => project.savedProjectId !== projectId)) fail('ADMIN_SAVED_PROJECT_AMBIGUOUS');
    const projects = await listNativeProjects(client);
    const entry = projects.find(item => item.id === projectId);
    const project = entry ? await readNativeProject(client, entry, { realpathSync: io.realpathSync }) : null;
    if (!project || roots.some(root => !project.roots.some(attached => projectRootContains(attached, root)))) fail('ADMIN_CREATE_SCOPE_UNVERIFIED');
    for (const field of ['cwd', 'runtimeWorkspaceRoots', 'projectId', 'ephemeral', 'sandbox', 'permissions', 'approvalPolicy']) {
      if (Object.hasOwn(createParams, field)) fail('ADMIN_CREATE_SCOPE_OVERRIDE_FORBIDDEN');
    }
    const response = await client.request('thread/start', { ...createParams, projectId, cwd: roots[0], runtimeWorkspaceRoots: roots,
      ephemeral: false, sandbox: 'read-only', approvalPolicy: 'on-request', allowProviderModelFallback: false });
    const taskId = response?.thread?.id;
    if (!taskId) fail('ADMIN_CREATION_UNCERTAIN');
    try {
      if (response.thread.projectId !== projectId) fail('ADMIN_CREATION_UNCERTAIN');
      // Blank sessions lack a rollout; no durable metadata write is attempted.
      const read = await client.request('thread/read', { threadId: taskId, includeTurns: false });
      if (read?.thread?.id !== taskId || (read.thread.projectId != null && read.thread.projectId !== projectId) ||
          io.realpathSync(read.thread.cwd) !== roots[0]) fail('ADMIN_CREATED_TASK_UNVERIFIED');
      stagedCreates.set(taskId, { projectId, cwd: roots[0] });
      return { status: 'created', taskId };
    } catch (error) {
      error.createdTaskId = taskId;
      throw error;
    }
  }

  /** Submit exactly the supplied bootstrap through the trusted queue port. */
  async initialize({ taskId, payload }) {
    const stagedCreates = this.#stagedCreates;
    const { queueInitialization } = this.#options;
    const result = await queueInitialization({ taskId, payload });
    if (result?.taskId !== taskId || result.status !== 'submitted') fail('ADMIN_INIT_UNCERTAIN');
    stagedCreates.delete(taskId);
    return result;
  }

  /** Apply presentation metadata only after exact durable task identity exists.
   * A title cannot establish identity or readiness.  In particular, an accepted
   * INIT is never retried, rolled back, or hidden when this bounded recovery
   * cannot name its task yet.
   */
  async applyTitle({ taskId, title, attempts = 3, retryDelayMs = 100 } = {}) {
    if (typeof title !== 'string' || !title.trim()) return { status: 'not-requested', attempts: 0 };
    const limit = Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 3;
    let lastReason = 'ADMIN_TITLE_DURABILITY_UNVERIFIED', lastKind = 'deferred';
    for (let attempt = 1; attempt <= limit; attempt++) {
      try {
        // A completed readiness check writes an active receipt, but require a
        // fresh catalog entry as well before touching host presentation state.
        const bindings = this.#bindings().filter(binding => binding.taskId === taskId);
        const tasks = (await this.#tasks()).filter(task => task.id === taskId && task.status === 'active' &&
          task.projectAssignmentPending !== true);
        if (bindings.length !== 1 || tasks.length !== 1) {
          lastReason = 'ADMIN_TITLE_DURABILITY_UNVERIFIED'; lastKind = 'deferred';
        } else {
          await this.#client.request('thread/name/set', { threadId: taskId, name: title.trim() });
          return { status: 'applied', attempts: attempt };
        }
      } catch (error) {
        lastReason = error?.message || 'ADMIN_TITLE_SET_FAILED'; lastKind = 'failed';
      }
      if (attempt < limit) await this.#options.sleep(Math.max(0, Math.min(retryDelayMs, 1000)));
    }
    return { status: lastKind, attempts: limit, reason: lastReason };
  }

  /** Verify actual parent-owned INIT audit release, not merely its final message. */
  async verifyAuditRelease(taskId, initializationTurn, binding) {
    const tasks = await this.#tasks();
    const parentId = task => task.source?.subAgent?.thread_spawn?.parent_thread_id;
    const descendants = new Set(), ancestors = new Set([taskId]);
    let changed;
    do {
      changed = false;
      for (const task of tasks) if (!ancestors.has(task.id) && ancestors.has(parentId(task))) {
        ancestors.add(task.id); descendants.add(task.id); changed = true;
      }
    } while (changed);
    if (binding?.initialization?.auditTransport === 'ephemeral-process') {
      const audit = binding.initialization.audit;
      if (descendants.size || audit?.transport !== 'ephemeral-process' || audit.verdict !== 'pass' ||
          audit.workerClosed !== true || audit.exitCode !== 0 || audit.generation !== binding.generation ||
          audit.turnId !== initializationTurn?.id || initializationTurn.status !== 'completed' ||
          !audit.workerThreadId || !audit.callId || !Number.isFinite(Date.parse(audit.completedAt)))
        fail('ADMIN_INIT_EPHEMERAL_AUDIT_UNVERIFIED');
      const calls = initializationTurn.items?.filter(item => item.type === 'dynamicToolCall' && item.tool === 'ai_fleas_init_audit');
      if (calls?.length !== 1 || calls[0].id !== audit.callId || calls[0].namespace != null ||
          calls[0].status !== 'completed' || calls[0].success !== true || calls[0].contentItems?.length !== 1 ||
          calls[0].contentItems[0].type !== 'inputText') fail('ADMIN_INIT_EPHEMERAL_CALL_UNVERIFIED');
      let result;
      try { result = JSON.parse(calls[0].contentItems[0].text); } catch { fail('ADMIN_INIT_EPHEMERAL_CALL_UNVERIFIED'); }
      if (!isDeepStrictEqual(result.audit, audit) || result.result?.verdict !== 'pass') fail('ADMIN_INIT_EPHEMERAL_CALL_UNVERIFIED');
      return { released: true, transport: 'ephemeral-process', workerThreadId: audit.workerThreadId, taskIds: [] };
    }
    if (!descendants.size) fail('ADMIN_INIT_AUDIT_UNVERIFIED');
    // Old released children cannot stand in for the audit of this exact INIT.
    // Use the host's structured spawn item, never text mentioning an agent ID.
    const spawns = initializationTurn?.status === 'completed' && Array.isArray(initializationTurn.items)
      ? initializationTurn.items.filter(item => item.type === 'collabAgentToolCall' &&
        item.tool === 'spawnAgent' && item.status === 'completed' && item.senderThreadId === taskId)
      : [];
    const auditIds = spawns.flatMap(item => Array.isArray(item.receiverThreadIds) ? item.receiverThreadIds : []);
    if (!auditIds.length || auditIds.some(id => !descendants.has(id) ||
        parentId(tasks.find(task => task.id === id)) !== taskId)) fail('ADMIN_INIT_AUDIT_TURN_UNVERIFIED');
    for (const id of descendants) {
      const response = await this.#client.request('thread/read', { threadId: id, includeTurns: true });
      const task = response?.thread;
      if (task?.id !== id || parentId(task) !== parentId(tasks.find(item => item.id === id)) ||
          !ancestors.has(parentId(task)) || parentId(task) === id ||
          task.status?.type !== 'notLoaded' || !Array.isArray(task.turns) || !task.turns.length ||
          task.turns.at(-1).status !== 'completed' ||
          task.turns.some(turn => turn.status === 'inProgress')) fail('ADMIN_INIT_AUDIT_RELEASE_UNVERIFIED');
    }
    const seen = new Set(), cursors = new Set(); let cursor;
    do {
      const page = await this.#client.request('thread/loaded/list', cursor === undefined ? {} : { cursor });
      if (!Array.isArray(page?.data)) fail('ADMIN_INIT_AUDIT_RELEASE_UNVERIFIED');
      for (const id of page.data) {
        if (typeof id !== 'string' || !id || seen.has(id) || descendants.has(id))
          fail('ADMIN_INIT_AUDIT_RELEASE_UNVERIFIED');
        seen.add(id);
      }
      cursor = page.nextCursor;
      if (cursor === undefined || cursor === null) break;
      if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) fail('ADMIN_INIT_AUDIT_RELEASE_UNVERIFIED');
      cursors.add(cursor);
    } while (true);
    return { released: true, taskIds: [...descendants] };
  }

  /** Require active receipt plus matching completed native turn and final token. */
  async wait({ taskId, timeoutMs }) {
    const client = this.#client;
    const { now, sleep } = this.#options;
    const deadline = now() + Math.min(Math.max(timeoutMs || 0, 0), 300000);
    do {
      const candidates = this.#bindings().filter(binding => binding.taskId === taskId);
      if (candidates.length !== 1) fail('ADMIN_BINDING_UNVERIFIED');
      const binding = candidates[0], evidence = binding.initialization;
      if (binding.status === 'active') {
        if (binding.agentId !== 'admin' || binding.platformAdapter !== 'codex-app' ||
            evidence?.readinessToken !== 'ADMIN_READY' || !evidence.completedTurnId || !evidence.completedAt) fail('ADMIN_READINESS_UNVERIFIED');
        const response = await client.request('thread/read', { threadId: taskId, includeTurns: true });
        if (response?.thread?.id !== taskId) fail('ADMIN_READINESS_UNVERIFIED');
        const turns = response.thread.turns?.filter(turn => turn.id === evidence.completedTurnId);
        if (turns?.length !== 1 || !['completed', 'inProgress'].includes(turns[0].status)) fail('ADMIN_READINESS_UNVERIFIED');
        // Stop hooks can commit readiness before the runtime marks its turn
        // completed. Wait for that transition without claiming early readiness.
        if (turns[0].status === 'inProgress') {
          if (now() >= deadline) break;
          await sleep(Math.min(1000, deadline - now()));
          continue;
        }
        const messages = turns[0].items?.filter(item => item.type === 'agentMessage');
        if (!messages?.length || messages.at(-1).text?.trim() !== 'ADMIN_READY') fail('ADMIN_READINESS_UNVERIFIED');
        await this.verifyAuditRelease(taskId, turns[0], binding);
        return { status: 'complete', taskId, turnId: evidence.completedTurnId, token: 'ADMIN_READY' };
      }
      if (binding.status !== 'pending') fail('ADMIN_READINESS_UNVERIFIED');
      if (evidence?.turnId) {
        const response = await client.request('thread/read', { threadId: taskId, includeTurns: true });
        const turns = response?.thread?.turns?.filter(turn => turn.id === evidence.turnId);
        if (response?.thread?.id !== taskId || turns?.length !== 1) fail('ADMIN_PENDING_TURN_UNVERIFIED');
        if (['completed', 'failed', 'interrupted'].includes(turns[0].status)) {
          const final = turns[0].items?.filter(item => item.type === 'agentMessage').at(-1)?.text?.trim();
          fail(/^BLOCKED_[A-Z0-9_]+/.exec(final || '')?.[0] || 'ADMIN_READINESS_UNVERIFIED');
        }
      }
      if (now() >= deadline) break;
      await sleep(Math.min(1000, deadline - now()));
    } while (now() <= deadline);
    return { status: 'timeout', taskId };
  }

  // Private implementation

  /** Read the generic plugin registry; it is evidence, not live task authority. */
  #bindings() {
    const { pluginData, io } = this.#options;
    const file = path.join(pluginData, 'agent-bindings.json');
    if (!io.existsSync(file)) return [];
    const registry = JSON.parse(io.readFileSync(file, 'utf8'));
    if (!registry.instances || typeof registry.instances !== 'object' || Array.isArray(registry.instances)) fail('INVALID_HOST_BINDINGS');
    return Object.entries(registry.instances).map(([taskId, binding]) => ({ ...binding, taskId }));
  }
  /** Enumerate persistent and loaded tasks, retaining same-connection blank evidence. */
  async #tasks() {
    const client = this.#client, stagedCreates = this.#stagedCreates;
    const { io } = this.#options;
    const result = [], ids = new Set();
    for (const archived of [false, true]) {
      let cursor;
      const cursors = new Set();
      do {
        const page = await client.request('thread/list', { archived,
          sourceKinds: ['cli', 'vscode', 'exec', 'appServer', 'subAgent', 'subAgentReview',
            'subAgentCompact', 'subAgentThreadSpawn', 'subAgentOther', 'unknown'],
          ...(cursor === undefined ? {} : { cursor }) });
        if (!Array.isArray(page?.data)) fail('HOST_TASK_CATALOG_INVALID');
        for (const task of page.data) {
          if (!task?.id || ids.has(task.id)) fail('HOST_TASK_ID_AMBIGUOUS');
          ids.add(task.id);
          result.push({ ...task, status: archived ? 'archived' : 'active' });
        }
        cursor = page.nextCursor;
        if (cursor === undefined || cursor === null) break;
        if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) fail('HOST_TASK_CURSOR_INVALID');
        cursors.add(cursor);
      } while (true);
    }
    // Fresh blank sessions may exist only in the supported in-memory catalog.
    // Stored/loaded overlap is expected; duplicate loaded IDs are not.
    let cursor;
    const loadedIds = new Set(), cursors = new Set();
    do {
      const page = await client.request('thread/loaded/list', cursor === undefined ? {} : { cursor });
      if (!Array.isArray(page?.data)) fail('HOST_TASK_CATALOG_INVALID');
      for (const id of page.data) {
        if (typeof id !== 'string' || !id || loadedIds.has(id)) fail('HOST_TASK_ID_AMBIGUOUS');
        loadedIds.add(id);
        if (ids.has(id)) continue;
        const response = await client.request('thread/read', { threadId: id, includeTurns: false });
        if (response?.thread?.id !== id) fail('HOST_TASK_IDENTITY_MISMATCH');
        ids.add(id);
        const staged = stagedCreates.get(id);
        if (staged && response.thread.projectId == null && !this.#bindings().some(binding => binding.taskId === id) &&
            io.realpathSync(response.thread.cwd) === staged.cwd) {
          result.push({ ...response.thread, projectId: staged.projectId, projectAssignmentPending: true, status: 'active' });
        } else result.push({ ...response.thread, status: 'active' });
      }
      cursor = page.nextCursor;
      if (cursor === undefined || cursor === null) break;
      if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) fail('HOST_TASK_CURSOR_INVALID');
      cursors.add(cursor);
    } while (true);
    return result;
  }
}

/** Compatibility factory; each call owns a distinct native host instance. */
export function buildNativeAdminHost(client, options) {
  return new NativeAdminHost(client, options);
}
