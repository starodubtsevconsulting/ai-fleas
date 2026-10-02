/** Native Admin-only host ports used explicitly by the lifecycle controller.
 * Inputs: supported RPC client and trusted approval/prerequisite/queue callbacks,
 * generic plugin data directory; outputs complete catalogs and exact task receipts.
 * Effects: reads host/project/binding state, creates one task on explicit create,
 * and queues INIT only through the supplied generic plugin bridge. No role registry,
 * project edits, alternate platform fallback, or follow-up messages are implemented.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readNativeProjectCatalog, listNativeProjects, readNativeProject, projectRootContains } from './native-project-catalog.mjs';
const fail = code => { throw new Error(code); };

export function buildNativeAdminHost(client, { pluginData, queueInitialization, verifyApproval, prerequisites,
  createParams = {}, selectedProjectIds, io = fs, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  if (typeof client?.request !== 'function' || typeof queueInitialization !== 'function' ||
      typeof verifyApproval !== 'function' || typeof prerequisites !== 'function' || !path.isAbsolute(pluginData || ''))
    fail('NATIVE_ADMIN_HOST_CONFIGURATION_INVALID');
  // Same-connection creation evidence only; never a durable identity registry.
  const stagedCreates = new Map();
  function bindings() {
    const file = path.join(pluginData, 'agent-bindings.json');
    if (!io.existsSync(file)) return [];
    const registry = JSON.parse(io.readFileSync(file, 'utf8'));
    if (!registry.instances || typeof registry.instances !== 'object' || Array.isArray(registry.instances)) fail('INVALID_HOST_BINDINGS');
    return Object.entries(registry.instances).map(([taskId, binding]) => ({ ...binding, taskId }));
  }
  async function tasks() {
    const result = [], ids = new Set();
    for (const archived of [false, true]) {
      let cursor;
      const cursors = new Set();
      do {
        const page = await client.request('thread/list', { archived, ...(cursor === undefined ? {} : { cursor }) });
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
        if (staged && response.thread.projectId == null && !bindings().some(binding => binding.taskId === id) &&
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
  return {
    verifyApproval, prerequisites,
    async catalog() {
      return { complete: true, projects: await readNativeProjectCatalog(client, { realpathSync: io.realpathSync, selectedProjectIds }),
        tasks: await tasks(), bindings: bindings() };
    },
    async create(request) {
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
    },
    async initialize({ taskId, payload }) {
      const result = await queueInitialization({ taskId, payload });
      if (result?.taskId !== taskId || result.status !== 'submitted') fail('ADMIN_INIT_UNCERTAIN');
      stagedCreates.delete(taskId);
      if (typeof payload.endpoint?.title === 'string' && payload.endpoint.title.trim())
        await client.request('thread/name/set', { threadId: taskId, name: payload.endpoint.title });
      return result;
    },
    async wait({ taskId, timeoutMs }) {
      const deadline = now() + Math.min(Math.max(timeoutMs || 0, 0), 60000);
      do {
        const candidates = bindings().filter(binding => binding.taskId === taskId);
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
          return { status: 'complete', taskId, turnId: evidence.completedTurnId, token: 'ADMIN_READY' };
        }
        if (binding.status !== 'pending') fail('ADMIN_READINESS_UNVERIFIED');
        if (now() >= deadline) break;
        await sleep(Math.min(1000, deadline - now()));
      } while (now() <= deadline);
      return { status: 'timeout', taskId };
    },
  };
}
