/** Run: node --test platforms/gpt-agents/initialize-governor.test.mjs.
 * In-process fixtures verify canonical preflight and host task-state decisions.
 * Passing does not prove live task creation, queue delivery, or readiness activation.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildGovernorInitialization, hostTaskState, verifyNewGovernorHostTask,
  verifyFreshGovernorHostTask, initializeGovernor } from './initialize-governor.mjs';

const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url));
const gitHumanDir = fileURLToPath(new URL('./fixtures/governor/git-human/', import.meta.url));
const localHumanDir = fileURLToPath(new URL('./fixtures/governor/local-human/', import.meta.url));
const bootstrapHumanDir = fileURLToPath(new URL('./fixtures/governor/bootstrap-human/', import.meta.url));
const usableProvider = () => ({
  status: 0,
  stdout: 'provider=synology\nreachable=true\naccess=read-write\nwritable=true\n',
  stderr: '',
});

test('builds a compact exact-human Governor initialization from declared sources', () => {
  const { binding, prompt } = buildGovernorInitialization(humanDir, 'example-human', 3, {
    checkProvider: usableProvider,
  });
  assert.equal(binding.agentId, 'personal-governor');
  assert.equal(binding.generation, 3);
  assert.deepEqual(binding.scope, { kind: 'governed-human', humanProfileId: 'example-human' });
  assert.equal(binding.initialization.memoryBinding, 'profile-memory://governor');
  assert.equal(binding.initialization.readinessToken, 'PERSONAL_GOVERNOR_READY');
  assert.ok(binding.initialization.sources.every(source => path.isAbsolute(source.ref)));
  assert.match(prompt, /Initialize Personal Governor for example-human/);
});

test('rejects identity mismatch and unusable memory before registering a task', () => {
  assert.throws(() => buildGovernorInitialization(humanDir, 'someone-else', 1, {
    checkProvider: usableProvider,
  }), /human profile ID or type does not match/);
  assert.throws(() => buildGovernorInitialization(humanDir, 'example-human', 1, {
    checkProvider: () => ({ status: 0, stdout: 'provider=synology\nreachable=true\naccess=read-write\nwritable=false\n' }),
  }), /memory is not usable/);
});

test('minimal local-memory human profile passes Governor preflight without workflow access', () => {
  const { binding } = buildGovernorInitialization(localHumanDir, 'local-human', 1);
  assert.equal(binding.scope.humanProfileId, 'local-human');
  assert.equal(binding.initialization.sources.find(source => source.id === 'memory-provider').ref,
    path.join(localHumanDir, 'memory/governor-memory.md'));
});

test('generated human uses a portable role reference that resolves from this installation', () => {
  const { binding } = buildGovernorInitialization(bootstrapHumanDir, 'bootstrap-human', 1);
  const role = binding.initialization.sources.find(source => source.id === 'portable-role');
  assert.equal(path.basename(role.ref), 'personal-governor.yml');
  assert.ok(path.isAbsolute(role.ref));
});

test('reports a task sandbox denial separately from an invalid memory binding', () => {
  const denied = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
  assert.throws(() => buildGovernorInitialization(gitHumanDir, 'git-human', 1, {
    checkMemoryWrite: () => { throw denied; },
  }), /current task environment blocks writing the authoritative Governor memory file: operation not permitted/);
  const { binding } = buildGovernorInitialization(gitHumanDir, 'git-human', 1);
  assert.equal(binding.initialization.memoryBinding, 'profile-memory://governor');
  assert.throws(() => buildGovernorInitialization(humanDir, 'example-human', 1, {
    checkProvider: () => ({ status: 1, stdout: '', stderr: 'network access denied' }),
  }), /current task environment blocks checking the declared memory provider: network access denied/);
});

test('host catalog, rather than stale SQLite status, decides a Governor task state', async () => {
  const taskId = '00000000-0000-4000-8000-000000000001';
  let catalogArchived = false;
  const client = { request: async (method, params) => method === 'thread/list'
    ? { data: params.archived === catalogArchived ? [{ id: taskId, projectId: null }] : [], nextCursor: null }
    : { thread: { id: taskId, threadSource: 'agent_created_thread',
      cwd: '/projectless/task', projectId: null, ephemeral: false } } };
  const row = { id: taskId, thread_source: 'agent_created_thread',
    cwd: '/projectless/task', archived: 0 };
  const active = await hostTaskState(client, taskId, { readAgentCreatedRecord: () => row });
  assert.equal(active.archived, false);
  catalogArchived = true;
  const archived = await hostTaskState(client, taskId, { readAgentCreatedRecord: () => row });
  assert.equal(archived.archived, true);
  catalogArchived = false;
  const cacheArchived = await hostTaskState(client, taskId, {
    readAgentCreatedRecord: () => ({ ...row, archived: 1 }),
  });
  assert.equal(cacheArchived.archived, false);
  await assert.rejects(() => hostTaskState(client, taskId, {
    readAgentCreatedRecord: () => ({ ...row, cwd: '/different-task' }),
  }), /GOVERNOR_HOST_STATE_UNVERIFIED/);
});

test('a task absent from the complete host catalogs remains unverified even when loaded', async () => {
  const taskId = '00000000-0000-4000-8000-000000000003';
  const client = { request: async method => method === 'thread/list'
    ? { data: [], nextCursor: null }
    : method === 'thread/loaded/list'
      ? { data: [taskId] }
      : { thread: { id: taskId, cwd: '/projectless/task', projectId: null, ephemeral: false } } };
  const result = await hostTaskState(client, taskId, { readAgentCreatedRecord: () => null });
  assert.equal(result, null);
});

test('incomplete or conflicting host catalog evidence fails closed before reconciliation can mutate', async () => {
  const taskId = '00000000-0000-4000-8000-000000000008';
  const incomplete = { request: async method => {
    if (method === 'thread/list') return { data: [], nextCursor: 'again' };
    throw new Error(`unexpected ${method}`);
  } };
  await assert.rejects(() => hostTaskState(incomplete, taskId, { readAgentCreatedRecord: () => null }),
    /GOVERNOR_HOST_CATALOG_UNVERIFIED/);
  const conflict = { request: async (_method, params) => ({
    data: [{ id: taskId, projectId: null }], nextCursor: null,
  }) };
  await assert.rejects(() => hostTaskState(conflict, taskId, { readAgentCreatedRecord: () => null }),
    /GOVERNOR_HOST_TASK_AMBIGUOUS/);
});

test('new exact Governor task waits for catalog persistence after same-task reads succeed', async () => {
  const taskId = '00000000-0000-4000-8000-000000000009';
  const calls = [];
  const pauses = [];
  let scan = 1;
  const client = { request: async (method, params) => {
    if (method === 'thread/read') {
      assert.equal(params.threadId, taskId);
      return { thread: { id: taskId, projectId: null, ephemeral: false, cwd: '/projectless/task' } };
    }
    calls.push({ method, params });
    assert.equal(method, 'thread/list');
    const data = scan === 2 && !params.archived ? [{ id: taskId, projectId: null }] : [];
    if (params.archived) scan++;
    return { data, nextCursor: null };
  } };
  const read = await client.request('thread/read', { threadId: taskId, includeTurns: false });
  assert.equal(read.thread.id, taskId);
  const entry = await verifyNewGovernorHostTask(client, taskId, {
    readAgentCreatedRecord: () => null,
    pause: async ms => { pauses.push(ms); },
  });
  assert.equal(entry.task.id, taskId);
  assert.equal(entry.archived, false);
  assert.deepEqual(pauses, [500]);
  assert.deepEqual(calls.map(call => call.params.archived), [false, true, false, true]);
  // Recovery has only catalog reads: no task creation, binding registration,
  // INIT submission, or alternate ID can occur while visibility catches up.
  assert.ok(calls.every(call => call.method === 'thread/list'));
});

test('permanent new-task catalog omission exhausts bounded recovery with the existing blocker', async () => {
  const taskId = '00000000-0000-4000-8000-000000000010';
  let requests = 0;
  const pauses = [];
  const client = { request: async method => {
    assert.equal(method, 'thread/list');
    requests++;
    return { data: [], nextCursor: null };
  } };
  await assert.rejects(() => verifyNewGovernorHostTask(client, taskId, {
    readAgentCreatedRecord: () => null,
    pause: async ms => { pauses.push(ms); },
  }), error => {
    assert.equal(error.message, 'GOVERNOR_PROJECTLESS_HOST_TASK_UNVERIFIED');
    assert.equal(error.taskId, taskId);
    assert.deepEqual(error.recovery, {
      classification: 'complete-catalog-omission', attempts: 3, exhausted: true,
    });
    return true;
  });
  assert.equal(requests, 6);
  assert.deepEqual(pauses, [500, 500]);
});

test('normal new-task verification requires both catalogs without delaying initialization', async () => {
  const taskId = '00000000-0000-4000-8000-000000000011';
  const requests = [];
  const client = { request: async (method, params) => {
    requests.push(method);
    return { data: params.archived ? [] : [{ id: taskId, projectId: null }], nextCursor: null };
  } };
  const entry = await verifyNewGovernorHostTask(client, taskId, {
    readAgentCreatedRecord: () => null,
    pause: async () => assert.fail('verified task should not wait'),
  });
  assert.equal(entry.task.id, taskId);
  assert.equal(entry.archived, false);
  assert.deepEqual(requests, ['thread/list', 'thread/list']);
});

test('new-task recovery does not retry invalid catalogs or archived/project-bound identity', async () => {
  const taskId = '00000000-0000-4000-8000-000000000012';
  for (const condition of ['invalid-catalog', 'archived', 'project-bound', 'ambiguous', 'transport-error']) {
    let requests = 0;
    const client = { request: async (_method, params) => {
      requests++;
      if (condition === 'transport-error') throw new Error('host transport failed');
      if (condition === 'invalid-catalog') return {};
      const present = condition === 'ambiguous' || params.archived === (condition === 'archived');
      return { data: present ? [{ id: taskId, projectId: condition === 'project-bound' ? 'saved-project' : null }] : [],
        nextCursor: null };
    } };
    await assert.rejects(() => verifyNewGovernorHostTask(client, taskId, {
      readAgentCreatedRecord: () => null,
      pause: async () => assert.fail(`${condition} is not a catalog omission`),
    }), /GOVERNOR_(HOST_CATALOG_UNVERIFIED|HOST_TASK_AMBIGUOUS|PROJECTLESS_HOST_TASK_UNVERIFIED)|host transport failed/);
    assert.ok(requests <= 2);
  }
});

test('loaded blank creation receives a connection-bound one-use INIT permit', async () => {
  const taskId = '00000000-0000-4000-8000-000000000020';
  const cwd = localHumanDir.replace(/\/$/, '');
  const thread = { id: taskId, projectId: null, ephemeral: false, cwd, turns: [] };
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/list') return { data: [], nextCursor: null };
    if (method === 'thread/loaded/list') return { data: [taskId] };
    if (method === 'thread/read') return { thread };
    assert.fail(`unexpected ${method}`);
  } };
  const hostState = (host, id) => hostTaskState(host, id, { readAgentCreatedRecord: () => null });
  const fresh = await verifyFreshGovernorHostTask(client, taskId, cwd, thread, { hostState });
  assert.ok(fresh.bootstrapPermit);
  let queues = 0;
  const params = { client, taskId, humanId: 'local-human', humanDir: cwd,
    registryFile: '/unused/agent-bindings.json', bootstrapPermit: fresh.bootstrapPermit };
  const dependencies = { hostState, readRegistry: () => ({ instances: {} }),
    reconcile: async (_, registry) => registry,
    queue: (_, id, payload) => {
      queues++;
      assert.equal(id, taskId);
      assert.equal(payload.binding.generation, 1);
      assert.match(payload.prompt, /Initialize Personal Governor for local-human/);
    } };
  assert.deepEqual(await initializeGovernor(params, dependencies),
    { threadId: taskId, status: 'pending', generation: 1 });
  await assert.rejects(initializeGovernor(params, dependencies), /GOVERNOR_BOOTSTRAP_PERMIT_UNVERIFIED/);
  assert.equal(queues, 1);
  assert.equal(calls.some(call => call.method === 'thread/start'), false);
});

test('fresh blank evidence rejects omissions, conflicts and inherited history', async () => {
  const taskId = '00000000-0000-4000-8000-000000000021';
  const cwd = localHumanDir.replace(/\/$/, '');
  const original = { id: taskId, projectId: null, ephemeral: false, cwd, turns: [] };
  for (const condition of ['not-loaded', 'duplicate-loaded', 'invalid-loaded', 'wrong-id',
    'project', 'ephemeral', 'fork', 'parent', 'cwd', 'history', 'malformed-turns', 'archived']) {
    const read = { ...original };
    if (condition === 'wrong-id') read.id = 'another-id';
    if (condition === 'project') read.projectId = 'project-id';
    if (condition === 'ephemeral') read.ephemeral = true;
    if (condition === 'fork') read.forkedFromId = 'previous';
    if (condition === 'parent') read.parentThreadId = 'parent';
    if (condition === 'cwd') read.cwd = '/not-the-human-directory';
    if (condition === 'history') read.turns = [{ id: 'previous-turn' }];
    if (condition === 'malformed-turns') read.turns = null;
    const client = { request: async method => {
      if (method === 'thread/read') return { thread: read };
      if (method === 'thread/loaded/list') return condition === 'invalid-loaded' ? {}
        : { data: condition === 'not-loaded' ? [] : condition === 'duplicate-loaded'
          ? [taskId, taskId] : [taskId] };
      assert.fail(`unexpected ${method}`);
    } };
    await assert.rejects(verifyFreshGovernorHostTask(client, taskId, cwd, original, {
      hostState: async () => condition === 'archived' ? { archived: true, task: original } : null,
    }), /GOVERNOR_(CREATED_TASK|LOADED_CATALOG)_/);
  }
  await assert.rejects(verifyFreshGovernorHostTask({}, taskId, cwd, { id: 'wrong-id' }),
    /GOVERNOR_CREATED_TASK_START_MISMATCH/);
});

test('partial thread/start response is accepted only with complete exact read and loaded proof', async () => {
  const taskId = '00000000-0000-4000-8000-000000000024';
  const cwd = localHumanDir.replace(/\/$/, '');
  const thread = { id: taskId, cwd, projectId: null, ephemeral: false };
  const client = { request: async method => method === 'thread/loaded/list'
    ? { data: [taskId] } : { thread } };
  const fresh = await verifyFreshGovernorHostTask(client, taskId, cwd,
    { id: taskId, sessionId: taskId, preview: '', ephemeral: false }, { hostState: async () => null });
  assert.ok(fresh.bootstrapPermit);
  for (const conflict of [{ projectId: 'project' }, { ephemeral: true }, { cwd: '/different' },
    { forkedFromId: 'parent' }, { parentThreadId: 'parent' }, { turns: [{ id: 'old-turn' }] }]) {
    await assert.rejects(verifyFreshGovernorHostTask(client, taskId, cwd,
      { id: taskId, ...conflict }, { hostState: async () => null }), /GOVERNOR_CREATED_TASK_START_MISMATCH/);
  }
  for (const omitted of ['cwd', 'projectId', 'ephemeral']) {
    const incomplete = { ...thread };
    delete incomplete[omitted];
    await assert.rejects(verifyFreshGovernorHostTask({ request: async () => ({ thread: incomplete }) },
      taskId, cwd, { id: taskId }, { hostState: async () => null }), /GOVERNOR_CREATED_TASK_METADATA_UNAVAILABLE/);
  }
});

test('blank creation permit cannot cross clients, apply to pending receipts or survive queue uncertainty', async () => {
  const taskId = '00000000-0000-4000-8000-000000000022';
  const cwd = localHumanDir.replace(/\/$/, '');
  const thread = { id: taskId, projectId: null, ephemeral: false, cwd, turns: [] };
  const client = { request: async method => method === 'thread/loaded/list'
    ? { data: [taskId] } : { thread } };
  const { bootstrapPermit } = await verifyFreshGovernorHostTask(client, taskId, cwd, thread,
    { hostState: async () => null });
  const params = { client, taskId, humanId: 'local-human', humanDir: cwd,
    registryFile: '/unused/agent-bindings.json', bootstrapPermit };
  let queues = 0;
  const dependencies = { hostState: async () => null, readRegistry: () => ({ instances: {} }),
    reconcile: async (_, registry) => registry, queue: () => { queues++; throw new Error('queue acceptance uncertain'); } };
  await assert.rejects(initializeGovernor({ ...params, client: { ...client } }, dependencies),
    /GOVERNOR_BOOTSTRAP_PERMIT_UNVERIFIED/);
  await assert.rejects(initializeGovernor({ ...params, taskId: '00000000-0000-4000-8000-000000000023' }, dependencies),
    /GOVERNOR_BOOTSTRAP_PERMIT_UNVERIFIED/);
  await assert.rejects(initializeGovernor(params, { ...dependencies,
    readRegistry: () => ({ instances: { [taskId]: { agentId: 'personal-governor',
      status: 'pending', scope: { humanProfileId: 'local-human' } } } }) }),
    /GOVERNOR_BOOTSTRAP_PERMIT_BINDING_CONFLICT/);
  await assert.rejects(initializeGovernor(params, dependencies), /queue acceptance uncertain/);
  await assert.rejects(initializeGovernor(params, dependencies), /GOVERNOR_BOOTSTRAP_PERMIT_UNVERIFIED/);
  assert.equal(queues, 1);
  // Durable catalog omission remains fatal for later initializer invocations.
  await assert.rejects(initializeGovernor({ ...params, bootstrapPermit: undefined }, {
    ...dependencies, verifyNewTask: host => verifyNewGovernorHostTask(host, taskId, {
      readAgentCreatedRecord: () => null, pause: async () => {},
    }),
  }), /GOVERNOR_HOST_CATALOG_UNVERIFIED/);
  assert.equal(queues, 1);
});
