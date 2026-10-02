/** Run: node --test platforms/gpt-agents/native-admin-host.test.mjs.
 * In-memory supported RPC and generic plugin fixtures test catalog completeness,
 * bounded Admin creation and readiness correlation; not live transport or effects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNativeAdminHost, NativeAdminHost } from './native-admin-host.mjs';
function fixture() {
  const calls = [];
  const binding = { agentId: 'admin', platformAdapter: 'codex-app', status: 'active', initialization: { readinessToken: 'ADMIN_READY', completedTurnId: 'turn', completedAt: 'date' } };
  const project = { id: 'project', name: 'fictional-financial-insights', roots: [{ path: '/fictional/code' }, { path: '/fictional/data' }] };
  const task = { id: 'task', projectId: 'project', cwd: '/fictional/data', status: { type: 'idle' }, turns: [{ id: 'turn', status: 'completed', items: [{ type: 'agentMessage', text: 'ADMIN_READY' }] }] };
  task.turns[0].items.push({ type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed',
    senderThreadId: 'task', receiverThreadIds: ['audit'] });
  const audit = { id: 'audit', source: { subAgent: { thread_spawn: { parent_thread_id: 'task' } } },
    status: { type: 'notLoaded' }, turns: [{ id: 'audit-turn', status: 'completed', items: [] }] };
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'project/list') return { data: [project] };
    if (method === 'project/read') return { project };
    if (method === 'thread/list') return { data: params.archived ? [] : [task, audit] };
    if (method === 'thread/loaded/list') return { data: ['task'] };
    if (method === 'thread/metadata/update') { task.projectId = params.projectId; return { thread: task }; }
    if (method === 'thread/start') { task.cwd = params.cwd; return { thread: task }; }
    if (method === 'thread/read') return { thread: params.threadId === 'audit' ? audit : task };
    throw new Error('Unexpected RPC');
  } };
  const options = { pluginData: '/fictional/plugin', io: { existsSync: () => true, readFileSync: () => JSON.stringify({ instances: { task: binding } }), realpathSync: value => value },
    queueInitialization: async ({ taskId }) => ({ taskId, status: 'submitted' }), verifyApproval: async () => true, prerequisites: async () => true };
  return { host: buildNativeAdminHost(client, options), client, options, calls, binding, task, audit };
}
const request = { role: 'admin', platform: 'codex-app', scope: { projects: [{ id: 'records', savedProjectId: 'project', root: '/fictional/data' }] } };
test('ephemeral readiness correlates exact native call and rejects persistent children or forged receipt', async () => {
  for (const mutation of [null, 'child', 'call', 'receipt', 'verdict']) {
    const f = fixture(), original = f.client.request;
    f.client.request = async (method, params) => method === 'thread/list'
      ? { data: params.archived ? [] : mutation === 'child' ? [f.task, f.audit] : [f.task] }
      : original(method, params);
    f.binding.generation = 1;
    const audit = { transport: 'ephemeral-process', turnId: 'turn', generation: 1, callId: 'exact-call',
      workerThreadId: 'utility', workerClosed: true, exitCode: 0, verdict: 'pass', completedAt: '2026-01-01T00:00:00Z' };
    Object.assign(f.binding.initialization, { auditTransport: 'ephemeral-process', audit });
    f.task.turns[0].items[1] = { type: 'dynamicToolCall', tool: 'ai_fleas_init_audit', id: 'exact-call',
      status: 'completed', success: true, contentItems: [{ type: 'inputText', text: JSON.stringify({ audit, result: { verdict: 'pass' } }) }] };
    if (mutation === 'call') f.task.turns[0].items[1].id = 'wrong';
    if (mutation === 'receipt') audit.workerThreadId = 'forged';
    if (mutation === 'verdict') audit.verdict = 'blocked';
    if (mutation) await assert.rejects(f.host.wait({ taskId: 'task', timeoutMs: 1 }), /ADMIN_INIT_EPHEMERAL_/);
    else assert.equal((await f.host.wait({ taskId: 'task', timeoutMs: 1 })).token, 'ADMIN_READY');
  }
});
test('class owns host dependencies and independent staged creation state', async () => {
  const f = fixture();
  const first = new NativeAdminHost(f.client, f.options);
  const second = new NativeAdminHost(f.client, f.options);
  assert.ok(f.host instanceof NativeAdminHost);
  assert.equal(first.stagedCreates, undefined);
  assert.equal(second.stagedCreates, undefined);
  assert.equal(first.bindings, undefined);
  assert.equal(first.tasks, undefined);
  assert.equal((await first.catalog()).complete, true);
  assert.equal((await first.wait({ taskId: 'task', timeoutMs: 1 })).token, 'ADMIN_READY');
  assert.throws(() => new NativeAdminHost(null, f.options), /CONFIGURATION_INVALID/);
});
test('complete catalogs include archived enumeration and generic receipt identity', async () => {
  const f = fixture(), catalog = await f.host.catalog();
  assert.equal(catalog.complete, true);
  assert.equal(catalog.tasks[0].status, 'active');
  assert.equal(catalog.bindings[0].taskId, 'task');
  assert.deepEqual(f.calls.filter(call => call.method === 'thread/list').map(call => call.params.archived), [false, true]);
});
test('creates only Admin with authorized data roots, not unrelated saved roots', async () => {
  const f = fixture();
  assert.deepEqual(await f.host.create(request), { status: 'created', taskId: 'task' });
  const call = f.calls.find(call => call.method === 'thread/start');
  assert.deepEqual(call.params.runtimeWorkspaceRoots, ['/fictional/data']);
  assert.equal(call.params.cwd, '/fictional/data');
  assert.equal(call.params.projectId, 'project');
  await assert.rejects(f.host.create({ ...request, role: 'router' }), /ADMIN_CREATE_REQUEST_INVALID/);
});
test('forbids overrides or unverified create roots', async () => {
  const f = fixture();
  await assert.rejects(buildNativeAdminHost(f.client, { ...f.options, createParams: { cwd: '/fictional/code' } }).create(request), /OVERRIDE_FORBIDDEN/);
  await assert.rejects(f.host.create({ ...request, scope: { projects: [{ savedProjectId: 'project', root: '/fictional/outside' }] } }), /SCOPE_UNVERIFIED/);
});
test('readiness requires matching live completed turn and final token', async () => {
  const f = fixture();
  assert.deepEqual(await f.host.wait({ taskId: 'task', timeoutMs: 1 }), { status: 'complete', taskId: 'task', turnId: 'turn', token: 'ADMIN_READY' });
  f.task.turns[0].items[0].text = 'Not ready';
  await assert.rejects(f.host.wait({ taskId: 'task', timeoutMs: 1 }), /READINESS_UNVERIFIED/);
  f.task.turns[0].items[0].text = 'ADMIN_READY';
  f.task.turns[0].status = 'failed';
  await assert.rejects(f.host.wait({ taskId: 'task', timeoutMs: 1 }), /READINESS_UNVERIFIED/);
});
test('terminal blocked INIT returns concrete blocker instead of waiting or claiming readiness', async () => {
  const f = fixture(); f.binding.status = 'pending'; f.binding.initialization.turnId = 'turn';
  f.task.turns[0].items[0].text = 'BLOCKED_INIT_AUDIT\nMissing exact evidence.';
  await assert.rejects(f.host.wait({ taskId: 'task', timeoutMs: 300000 }), /BLOCKED_INIT_AUDIT/);
});
test('ADMIN_READY cannot hide a missing, loaded, running or changed-parent audit', async () => {
  for (const mutate of [
    f => { f.task.turns[0].items.pop(); }, // old released child is not this INIT audit
    f => { f.task.turns[0].items[1].senderThreadId = 'foreign'; },
    f => { f.task.turns[0].items[1].receiverThreadIds = ['foreign']; },
    f => { f.audit.status.type = 'idle'; },
    f => { f.audit.turns[0].status = 'inProgress'; },
    f => { f.audit.source.subAgent.thread_spawn.parent_thread_id = 'foreign'; },
    f => { const original = f.client.request; f.client.request = async (method, params) =>
      method === 'thread/loaded/list' ? { data: ['task', 'audit'] } : original(method, params); },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(f.host.wait({ taskId: 'task', timeoutMs: 1 }), /ADMIN_INIT_AUDIT_/);
  }
});
test('authorized subfolder creation remains narrow and rejects sibling-prefix paths', async () => {
  const f = fixture();
  const scoped = root => ({ ...request, scope: { projects: [{ id: 'records', savedProjectId: 'project', root }] } });
  await f.host.create(scoped('/fictional/data/period'));
  assert.deepEqual(f.calls.find(call => call.method === 'thread/start').params.runtimeWorkspaceRoots, ['/fictional/data/period']);
  await assert.rejects(f.host.create(scoped('/fictional/data-other')), /SCOPE_UNVERIFIED/);
});
test('loaded blank sessions absent from persistent lists remain visible exactly once', async () => {
  const f = fixture(), original = f.client.request;
  f.client.request = async (method, params) => method === 'thread/list' ? { data: [] } : original(method, params);
  assert.equal((await f.host.catalog()).tasks[0].id, 'task');
  assert.equal((await f.host.catalog()).tasks.length, 1);
});
test('blank task uses same-connection staged assignment only before initialization', async () => {
  const f = fixture(), original = f.client.request;
  f.options.io.readFileSync = () => JSON.stringify({ instances: {} });
  f.client.request = async (method, params) => {
    if (method === 'thread/list') return { data: [] };
    if (method === 'thread/read') return { thread: { ...f.task, projectId: null } };
    const result = await original(method, params);
    return result;
  };
  await f.host.create(request);
  const before = (await f.host.catalog()).tasks[0];
  assert.equal(before.projectId, 'project');
  assert.equal(before.projectAssignmentPending, true);
  assert.equal(f.calls.filter(call => call.method === 'thread/metadata/update').length, 0);
  await f.host.initialize({ taskId: 'task', payload: {} });
  const after = (await f.host.catalog()).tasks[0];
  assert.equal(after.projectId, null);
  assert.equal(after.projectAssignmentPending, undefined);
  f.client.request = async (method, params) => {
    if (method === 'thread/read') throw new Error('read failed');
    return original(method, params);
  };
  await assert.rejects(f.host.create(request), error => error.createdTaskId === 'task' && error.message === 'read failed');
});
