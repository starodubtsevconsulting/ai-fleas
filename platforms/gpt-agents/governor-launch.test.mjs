/** Run: node --test platforms/gpt-agents/governor-launch.test.mjs.
 * In-process tests verify exact human selection, directory resolution, and
 * bounded create-vs-reuse and welcome-turn receipt decisions. Passing does not
 * create a live task or prove native delivery and readiness.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensurePersonalGovernor, runGovernorWelcome, resolveGovernorHumanDir,
  selectGovernorHuman, waitForGovernor } from './governor-launch.mjs';
import { hostTaskState, initializeGovernor } from './initialize-governor.mjs';

const catalog = fileURLToPath(new URL('./fixtures/governor/', import.meta.url));

test('unique verified human receipt avoids another bootstrap question', () => {
  const registry = { instances: { old: { agentId: 'personal-governor', status: 'archived',
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    generation: 2, initialization: { sources: [{ id: 'human-profile',
      ref: fileURLToPath(new URL('./fixtures/governor/example-human/profile.yml', import.meta.url)) }] } } } };
  assert.equal(selectGovernorHuman(registry, null, () => { throw new Error('unexpected prompt'); }), 'example-human');
  assert.equal(resolveGovernorHumanDir(registry, 'example-human'),
    fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, ''));
});

test('explicit choose-human asks for a different exact ID despite one receipt', () => {
  const registry = { instances: { current: { agentId: 'personal-governor', status: 'active',
    scope: { kind: 'governed-human', humanProfileId: 'example-human' } } } };
  assert.equal(selectGovernorHuman(registry, null, suggested => {
    assert.equal(suggested, 'example-human');
    return 'another-human';
  },
    { chooseHuman: true }), 'another-human');
  assert.throws(() => selectGovernorHuman(registry, null, () => null,
    { chooseHuman: true }), /GOVERNOR_HUMAN_ID_REQUIRED/);
});

test('human selection accepts an exact underscore ID', () => {
  assert.equal(selectGovernorHuman({ instances: {} }, null, () => 'example_human_2',
    { chooseHuman: true }), 'example_human_2');
});

test('ambiguous humans require only an exact ID and a configured catalog can resolve it', () => {
  const registry = { instances: {
    one: { agentId: 'personal-governor', status: 'active', scope: { kind: 'governed-human', humanProfileId: 'first' } },
    two: { agentId: 'personal-governor', status: 'active', scope: { kind: 'governed-human', humanProfileId: 'second' } },
  } };
  assert.equal(selectGovernorHuman(registry, null, () => 'example-human'), 'example-human');
  assert.equal(resolveGovernorHumanDir(registry, 'example-human', { humansDir: catalog }),
    fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, ''));
  assert.throws(() => selectGovernorHuman(registry, null, () => '../outside'), /GOVERNOR_HUMAN_ID_REQUIRED/);
  assert.throws(() => resolveGovernorHumanDir({ instances: {} }, 'example-human'),
    /GOVERNOR_HUMAN_CATALOG_NOT_CONFIGURED/);
});

test('launcher creates one fresh projectless task only when no current Governor exists', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000004';
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: taskId, projectId: null,
      ephemeral: false, forkedFromId: null, parentThreadId: null, cwd: humanDir, turns: [] } };
    if (method === 'thread/read') return { thread: { id: taskId, projectId: null,
      ephemeral: false, forkedFromId: null, parentThreadId: null, cwd: humanDir, turns: [] } };
    return {};
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
    hostState: async () => ({ archived: false, task: { id: taskId, projectId: null } }),
    initialize: (...args) => { calls.push({ method: 'initialize', args }); return { threadId: taskId, status: 'pending' }; },
    openTask: id => calls.push({ method: 'open', id }),
    wait: async (_, __, id) => ({ status: 'pending', taskId: id }) });
  assert.deepEqual(result, { status: 'pending', taskId });
  assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
  assert.equal(calls.find(call => call.method === 'thread/start').params.projectId, null);
  assert.equal(calls.find(call => call.method === 'initialize').args[2], taskId);
  assert.equal(calls.filter(call => call.method === 'thread/read').length, 1);
  const initAt = calls.findIndex(call => call.method === 'initialize');
  assert.ok(initAt >= 0);
  assert.equal(calls.some(call => call.method === 'thread/name/set'), false);
  assert.equal(calls.some(call => call.method === 'open'), false);
});

test('launcher opens a fresh task only after verified readiness', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000011';
  const opened = [];
  const progress = [];
  const client = { request: async method => method === 'thread/start' || method === 'thread/read'
    ? { thread: { id: taskId, projectId: null, ephemeral: false, cwd: humanDir, turns: [] } } : {} };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
    hostState: async () => ({ archived: false, task: { id: taskId, projectId: null } }),
    initialize: () => ({ threadId: taskId, status: 'pending' }),
    wait: async () => ({ status: 'ready', taskId, completedTurnId: 'ready-turn' }),
    welcome: async () => ({ status: 'completed', turnId: 'welcome-turn' }),
    onProgress: event => progress.push(event.stage),
    openTask: id => opened.push(id) });
  assert.equal(result.status, 'ready');
  assert.equal(result.welcomeStatus, 'completed');
  assert.deepEqual(progress, ['activation-started', 'welcome-started']);
  assert.deepEqual(opened, [taskId]);
});

test('post-bootstrap welcome is sent once and requires a completed human-facing answer', async () => {
  const taskId = '00000000-0000-4000-8000-000000000012';
  const binding = { agentId: 'personal-governor', status: 'active',
    scope: { humanProfileId: 'example-human' },
    initialization: { completedTurnId: 'activation-turn' } };
  const registry = { instances: { [taskId]: binding } };
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/read' && !binding.initialization.welcome)
      return { thread: { id: taskId, projectId: null, status: { type: 'idle' } } };
    if (method === 'turn/start') return { turn: { id: 'welcome-turn', status: 'inProgress' } };
    if (method === 'thread/read') return { thread: { id: taskId, projectId: null, turns: [{
      id: 'welcome-turn', status: 'completed', items: [{ type: 'agentMessage', phase: 'final_answer',
        text: 'Welcome, Example Human. I verified memory and found no configured scheduled follow-ups.' }],
    }] } };
    throw new Error(`unexpected ${method}`);
  } };
  const options = { readRegistry: () => registry,
    updateReceipt: (_, __, expected, next) => {
      assert.deepEqual(binding.initialization.welcome ?? null, expected);
      binding.initialization.welcome = next;
    }, requestId: () => 'welcome-request', now: () => 0 };
  const result = await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', options);
  assert.deepEqual(result, { status: 'completed', turnId: 'welcome-turn' });
  assert.equal(calls.filter(call => call.method === 'turn/start').length, 1);
  assert.match(calls.find(call => call.method === 'turn/start').params.input[0].text,
    /scheduled follow-ups/);
  assert.deepEqual(await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', options), result);
  assert.equal(calls.filter(call => call.method === 'turn/start').length, 1);
});

test('a token-only welcome is blocked and never resubmitted', async () => {
  const taskId = '00000000-0000-4000-8000-000000000013';
  const binding = { agentId: 'personal-governor', status: 'active',
    scope: { humanProfileId: 'example-human' },
    initialization: { completedTurnId: 'activation-turn' } };
  const registry = { instances: { [taskId]: binding } };
  let starts = 0;
  const client = { request: async (method, params) => {
    if (method === 'turn/start') {
      starts++;
      return { turn: { id: 'welcome-turn', status: 'inProgress' } };
    }
    if (params.includeTurns && binding.initialization.welcome) return { thread: { id: taskId, projectId: null,
      turns: [{ id: 'welcome-turn', status: 'completed', items: [{ type: 'agentMessage',
        phase: 'final_answer', text: 'PERSONAL_GOVERNOR_READY' }] }] } };
    return { thread: { id: taskId, projectId: null, status: { type: 'idle' } } };
  } };
  const options = { readRegistry: () => registry,
    updateReceipt: (_, __, expected, next) => {
      assert.deepEqual(binding.initialization.welcome ?? null, expected);
      binding.initialization.welcome = next;
    }, requestId: () => 'welcome-request', now: () => 0 };
  const result = await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', options);
  assert.deepEqual(result, { status: 'blocked', reason: 'GOVERNOR_WELCOME_REPORT_MISSING' });
  assert.deepEqual(await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', options), result);
  assert.equal(starts, 1);
});

test('missing welcome after active activation resumes exact unloaded task and sends once', async () => {
  const taskId = '00000000-0000-4000-8000-000000000031';
  const binding = { agentId: 'personal-governor', status: 'active',
    scope: { humanProfileId: 'example-human' },
    initialization: { completedTurnId: 'activation-turn' } };
  let loaded = false;
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push(method);
    if (method === 'thread/resume') { loaded = true; return { thread: { id: taskId, projectId: null } }; }
    if (method === 'turn/start') {
      assert.equal(loaded, true);
      assert.equal(params.threadId, taskId);
      return { turn: { id: 'welcome-turn', status: 'inProgress' } };
    }
    if (method === 'thread/read') return { thread: { id: taskId, projectId: null,
      status: { type: loaded ? 'idle' : 'notLoaded' },
      turns: [{ id: 'activation-turn', status: 'completed' },
        ...(binding.initialization.welcome?.status === 'inProgress'
          ? [{ id: 'welcome-turn', status: 'completed', items: [
            { type: 'agentMessage', phase: 'final_answer', text: 'Welcome, example-human.' }] }] : [])] } };
    throw new Error(`unexpected ${method}`);
  } };
  const options = { readRegistry: () => ({ instances: { [taskId]: binding } }),
    updateReceipt: (_file, _task, expected, next) => {
      assert.deepEqual(binding.initialization.welcome ?? null, expected);
      binding.initialization.welcome = next;
    }, requestId: () => 'welcome-request', now: () => 0 };
  const first = await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', options);
  assert.deepEqual(first, { status: 'completed', turnId: 'welcome-turn' });
  assert.equal(calls.filter(method => method === 'thread/resume').length, 1);
  assert.equal(calls.filter(method => method === 'turn/start').length, 1);
  const second = await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', options);
  assert.deepEqual(second, first);
  assert.equal(calls.filter(method => method === 'turn/start').length, 1);
});

test('welcome resume that remains unloaded stops pending without sending', async () => {
  const taskId = '00000000-0000-4000-8000-000000000032';
  const binding = { agentId: 'personal-governor', status: 'active',
    scope: { humanProfileId: 'example-human' },
    initialization: { completedTurnId: 'activation-turn' } };
  const calls = [];
  const client = { request: async method => {
    calls.push(method);
    if (method === 'thread/resume') return { thread: { id: taskId, projectId: null } };
    if (method === 'thread/read') return { thread: { id: taskId, projectId: null,
      status: { type: 'notLoaded' }, turns: [{ id: 'activation-turn', status: 'completed' }] } };
    throw new Error(`unexpected ${method}`);
  } };
  const result = await runGovernorWelcome(client, '/unused/registry.json', taskId,
    'example-human', { readRegistry: () => ({ instances: { [taskId]: binding } }), now: () => 0 });
  assert.deepEqual(result, { status: 'pending', reason: 'GOVERNOR_WELCOME_RESUME_NOT_IDLE' });
  assert.deepEqual(calls, ['thread/read', 'thread/resume', 'thread/read']);
  assert.equal(binding.initialization.welcome, undefined);
});

test('foreign rollout writer leaves exact active Governor welcome pending without a request', async () => {
  const taskId = '00000000-0000-4000-8000-000000000033';
  const binding = { agentId: 'personal-governor', status: 'active',
    scope: { humanProfileId: 'example-human' },
    initialization: { completedTurnId: 'activation-turn' } };
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push(method);
    assert.equal(params.threadId, taskId);
    if (method === 'thread/read') return { thread: { id: taskId, projectId: null,
      status: { type: 'notLoaded' }, turns: [{ id: 'activation-turn', status: 'completed' }] } };
    if (method === 'thread/resume') throw new Error(`Thread ${taskId} already has an active writer`);
    throw new Error(`unexpected ${method}`);
  } };
  const options = { readRegistry: () => ({ instances: { [taskId]: binding } }), now: () => 0,
    updateReceipt: () => assert.fail('No welcome receipt may be written before an accepted turn') };
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(await runGovernorWelcome(client, '/unused/registry.json', taskId,
      'example-human', options),
    { status: 'pending', reason: 'GOVERNOR_WELCOME_FOREIGN_WRITER_ACTIVE' });
  }
  assert.deepEqual(calls, ['thread/read', 'thread/resume', 'thread/read', 'thread/resume']);
  assert.equal(binding.initialization.welcome, undefined);
});

test('launcher reuses a verified active Governor without another INIT', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000005';
  const pinnedId = 'pinned-section';
  const calls = [];
  const registry = { instances: { [taskId]: { agentId: 'personal-governor', status: 'active',
    scope: { humanProfileId: 'example-human' }, activatedAt: '2026-10-03T12:00:00Z',
    initialization: { completedTurnId: 'ready-turn', readinessToken: 'PERSONAL_GOVERNOR_READY' } } } };
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'threadSection/list') return { data: [{ id: pinnedId, name: 'Pinned' }] };
    if (method === 'thread/read') return { thread: { name: '🧭 Personal Governor', section: { id: pinnedId } } };
    return {};
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => registry, reconcile: async () => registry,
    hostState: async () => ({ task: { projectId: null }, archived: false }),
    welcome: async () => ({ status: 'completed', turnId: 'welcome-turn' }),
    initialize: () => { throw new Error('duplicate INIT'); },
    openTask: () => { throw new Error('duplicate task'); } });
  assert.deepEqual(result, { status: 'existing', taskId, welcomeStatus: 'completed' });
  assert.equal(calls.some(call => call.method === 'thread/start'), false);
  assert.equal(calls.some(call => call.method === 'thread/section/move'), true);
});

test('launcher never reuses an archived Governor task ID', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const archivedId = '00000000-0000-4000-8000-000000000006';
  const freshId = '00000000-0000-4000-8000-000000000007';
  const calls = [];
  const registry = { instances: { [archivedId]: { agentId: 'personal-governor',
    status: 'archived', scope: { humanProfileId: 'example-human' } } } };
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: freshId, projectId: null,
      ephemeral: false, cwd: humanDir, turns: [] } };
    if (method === 'thread/read') return { thread: { id: freshId, projectId: null,
      ephemeral: false, cwd: humanDir, turns: [] } };
    return {};
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => registry, reconcile: async () => registry,
    hostState: async () => ({ archived: false, task: { id: freshId, projectId: null } }),
    initialize: (...args) => { calls.push({ method: 'initialize', args });
      return { threadId: freshId, status: 'pending' }; },
    openTask: id => calls.push({ method: 'open', id }),
    wait: async (_, __, id) => ({ status: 'pending', taskId: id }) });
  assert.equal(result.taskId, freshId);
  assert.equal(calls.find(call => call.method === 'initialize').args[2], freshId);
  assert.equal(calls.some(call => call.params?.threadId === archivedId), false);
});

test('created-task partial metadata beyond three reads resolves before one INIT', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000015';
  const calls = [];
  let reads = 0;
  let clock = 0;
  let catalogReads = 0;
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: taskId, projectId: null,
      ephemeral: false, cwd: humanDir, turns: [] } };
    if (method === 'thread/read') {
      reads++;
      return reads <= 4 ? { thread: {} } : { thread: { id: taskId, projectId: null,
        ephemeral: false, forkedFromId: null, parentThreadId: null, cwd: humanDir, turns: [] } };
    }
    if (method === 'thread/loaded/list') return { data: [] };
    throw new Error(`unexpected ${method}`);
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
    hostState: async (_, id) => {
      assert.equal(id, taskId);
      catalogReads++;
      return { archived: false, task: { id: taskId, projectId: null } };
    },
    createdTaskVerification: { timeoutMs: 20_000, now: () => clock,
      pause: async ms => { clock += ms; } },
    initialize: (...args) => { assert.equal(catalogReads, 1);
      calls.push({ method: 'initialize', args });
      return { threadId: taskId, status: 'pending' }; },
    wait: async (_, __, id) => ({ status: 'pending', taskId: id }), openTask: () => {} });
  assert.deepEqual(result, { status: 'pending', taskId });
  assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
  assert.equal(calls.filter(call => call.method === 'thread/read').length, 5);
  assert.equal(clock, 4000);
  assert.equal(calls.filter(call => call.method === 'initialize').length, 1);
});

test('permanently unavailable created-task metadata blocks without registration or INIT retry', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000016';
  const calls = [];
  let clock = 0;
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: taskId, projectId: null,
      ephemeral: false, cwd: humanDir, turns: [] } };
    if (method === 'thread/read') return { thread: {} };
    throw new Error(`unexpected ${method}`);
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
    createdTaskVerification: { timeoutMs: 3000, now: () => clock,
      pause: async ms => { clock += ms; } },
    initialize: () => { throw new Error('INIT must not be submitted'); },
    wait: () => { throw new Error('readiness must not start'); }, openTask: () => {} });
  assert.deepEqual(result, { status: 'blocked', taskId,
    reason: 'GOVERNOR_CREATED_TASK_METADATA_UNAVAILABLE', classification: 'partial-metadata',
    recovery: { attempts: 3, timeoutMs: 3000, exhausted: true } });
  assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
  assert.equal(calls.filter(call => call.method === 'thread/read').length, 3);
  assert.equal(calls.some(call => call.method === 'turn/start'), false);
});

test('catalog omission without loaded proof and catalog conflicts block immediately', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000017';
  for (const classification of ['complete-catalog-omission', 'archived-task',
    'catalog-metadata-mismatch', 'catalog-evidence-unverified']) {
    const calls = [];
    let clock = 0;
    let catalogReads = 0;
    const client = { request: async (method, params) => {
      calls.push({ method, params });
      assert.ok(['thread/start', 'thread/read', 'thread/loaded/list'].includes(method));
      if (method === 'thread/loaded/list') return { data: [] };
      if (method === 'thread/read') assert.equal(params.threadId, taskId);
      return { thread: { id: taskId, projectId: null, ephemeral: false, cwd: humanDir, turns: [] } };
    } };
    const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
      humanId: 'example-human', humanDir, preflight: () => {},
      readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
      hostState: async (_, id) => {
        assert.equal(id, taskId);
        catalogReads++;
        if (classification === 'complete-catalog-omission') return null;
        if (classification === 'catalog-evidence-unverified')
          throw new Error('GOVERNOR_HOST_CATALOG_UNVERIFIED');
        return { archived: classification === 'archived-task',
          task: { id: taskId, projectId: classification === 'catalog-metadata-mismatch' ? 'project' : null } };
      },
      createdTaskVerification: { timeoutMs: 3500, now: () => clock,
        pause: async ms => { clock += ms; } },
      initialize: () => { throw new Error('INIT must not be submitted'); },
      wait: () => { throw new Error('readiness must not start'); }, openTask: () => {} });
    assert.equal(result.status, 'blocked');
    assert.equal(result.taskId, taskId);
    assert.equal(result.reason, 'GOVERNOR_PROJECTLESS_HOST_TASK_UNVERIFIED');
    assert.equal(result.classification, classification);
    assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
    assert.deepEqual(result.recovery, { attempts: 1, timeoutMs: 3500, exhausted: false });
    assert.equal(catalogReads, 1);
    assert.equal(clock, 0);
  }
});

test('readiness polling uses the activation receipt without a large transcript read', async () => {
  const taskId = '00000000-0000-4000-8000-000000000009';
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'threadSection/list') return { data: [{ id: 'pin', name: 'Pinned' }] };
    if (method === 'thread/read') return { thread: { name: '🧭 Personal Governor', section: { id: 'pin' } } };
    return {};
  } };
  let reads = 0;
  const result = await waitForGovernor(client, '/unused/registry.json', taskId, {
    humanId: 'example-human', now: () => 0, timeoutMs: 100,
    pause: async () => {},
    readRegistry: () => ({ instances: { [taskId]: {
      agentId: 'personal-governor', scope: { kind: 'governed-human', humanProfileId: 'example-human' },
      status: ++reads === 1 ? 'pending' : 'active', activatedAt: '2026-10-03T12:00:00Z',
      initialization: { completedTurnId: 'ready-turn', readinessToken: 'PERSONAL_GOVERNOR_READY' },
    } } }),
    hostState: async () => ({ task: { projectId: null }, archived: false }),
  });
  assert.deepEqual(result, { status: 'ready', taskId, completedTurnId: 'ready-turn' });
  assert.equal(calls.some(call => call.method === 'thread/read' && call.params.includeTurns === true), false);
});

test('slow activation emits bounded progress while retaining the exact pending task', async () => {
  const taskId = '00000000-0000-4000-8000-000000000014';
  let clock = 0;
  const progress = [];
  const result = await waitForGovernor({ request: async () => { throw new Error('unexpected host read'); } },
    '/unused/registry.json', taskId, {
      humanId: 'example-human', now: () => clock, timeoutMs: 11, progressEveryMs: 4,
      pause: async () => { clock += 2; },
      onProgress: event => progress.push(event),
      readRegistry: () => ({ instances: { [taskId]: { agentId: 'personal-governor',
        scope: { kind: 'governed-human', humanProfileId: 'example-human' }, status: 'pending' } } }),
    });
  assert.deepEqual(result, { status: 'pending', taskId });
  assert.deepEqual(progress, [
    { taskId, stage: 'activation-pending' }, { taskId, stage: 'activation-pending' },
  ]);
});

test('a ready receipt is not presented as finished when the host title is wrong', async () => {
  const taskId = '00000000-0000-4000-8000-000000000010';
  const client = { request: async method => {
    if (method === 'threadSection/list') return { data: [{ id: 'pin', name: 'Pinned' }] };
    if (method === 'thread/read') return { thread: {
      name: 'Personal Governor initialization', section: { id: 'pin' } } };
    return {};
  } };
  await assert.rejects(waitForGovernor(client, '/unused/registry.json', taskId, {
    humanId: 'example-human', now: () => 0, timeoutMs: 100,
    readRegistry: () => ({ instances: { [taskId]: {
      agentId: 'personal-governor', scope: { kind: 'governed-human', humanProfileId: 'example-human' },
      status: 'active', activatedAt: '2026-10-03T12:00:00Z',
      initialization: { completedTurnId: 'ready-turn', readinessToken: 'PERSONAL_GOVERNOR_READY' },
    } } }),
    hostState: async () => ({ task: { projectId: null }, archived: false }),
  }), /GOVERNOR_PRESENTATION_UNVERIFIED/);
});

test('actual controller queues one INIT from loaded blank creation, then requires durable readiness and reuses it', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/local-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000030';
  const calls = [];
  const registry = { instances: {} };
  let durable = false;
  let name = null;
  let section = null;
  let queues = 0;
  // Official start/read metadata may omit turns entirely before persistence.
  const freshThread = { id: taskId, projectId: null, ephemeral: false, cwd: humanDir,
    forkedFromId: null, parentThreadId: null };
  const client = { request: async (method, params) => {
    calls.push({ method, params, durable });
    if (method === 'thread/start') return { thread: { id: taskId, sessionId: taskId,
      preview: '', ephemeral: false } };
    if (method === 'thread/loaded/list') return { data: [taskId] };
    if (method === 'thread/list') return { data: durable && !params.archived
      ? [{ ...freshThread }] : [], nextCursor: null };
    if (method === 'thread/read') {
      // Reading stored turn items on a fresh blank session is unsupported.
      if (!durable && params.includeTurns) throw new Error('rollout file is empty');
      return { thread: { ...freshThread, name, section } };
    }
    if (method === 'thread/name/set') { name = params.name; return {}; }
    if (method === 'threadSection/list') return { data: [{ id: 'pin', name: 'Pinned' }] };
    if (method === 'thread/section/move') { section = { id: params.sectionId }; return {}; }
    assert.fail(`unexpected ${method}`);
  } };
  const hostState = (host, id) => hostTaskState(host, id, { readAgentCreatedRecord: () => null });
  const readRegistry = () => registry;
  const reconcile = async (_, state) => state;
  const initialize = async (humanId, dir, id, registryFile, options) => {
    assert.equal(options.client, client);
    assert.ok(options.bootstrapPermit);
    return initializeGovernor({ humanId, humanDir: dir, taskId: id, registryFile, ...options }, {
      readRegistry, reconcile, hostState,
      queue: (_, queuedId, payload) => {
        assert.equal(queuedId, taskId);
        assert.equal(durable, false);
        queues++;
        // Fake host models the first accepted INIT persisting this exact log.
        durable = true;
        registry.instances[taskId] = { ...payload.binding, status: 'active',
          activatedAt: '2026-10-03T12:00:00Z', initialization: {
            ...payload.binding.initialization, completedTurnId: 'activation-turn' } };
      },
    });
  };
  const options = { client, registryFile: '/unused/agent-bindings.json',
    humanId: 'local-human', humanDir, readRegistry, reconcile, hostState, initialize,
    wait: (host, file, id, settings) => waitForGovernor(host, file, id,
      { ...settings, readRegistry, hostState, now: () => 0 }),
    welcome: async () => ({ status: 'completed', turnId: 'welcome-turn' }),
    openTask: () => {} };
  assert.deepEqual(await ensurePersonalGovernor(options), { status: 'ready', taskId,
    completedTurnId: 'activation-turn', welcomeStatus: 'completed' });
  assert.equal(queues, 1);
  assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
  assert.ok(calls.some(call => call.method === 'thread/list' && !call.durable));
  assert.ok(calls.some(call => call.method === 'thread/loaded/list' && !call.durable));
  assert.ok(calls.some(call => call.method === 'thread/list' && call.durable));
  assert.equal(calls.some(call => !call.durable && call.params?.includeTurns), false);
  assert.deepEqual(await ensurePersonalGovernor(options), { status: 'existing', taskId,
    welcomeStatus: 'completed' });
  assert.equal(queues, 1);
  assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
});

test('initializer uncertainty retains exact task evidence and never creates or queues again', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/local-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000031';
  let creates = 0;
  let initializes = 0;
  const thread = { id: taskId, projectId: null, ephemeral: false, cwd: humanDir };
  const client = { request: async method => {
    if (method === 'thread/start') { creates++; return { thread }; }
    if (method === 'thread/read') return { thread };
    if (method === 'thread/loaded/list') return { data: [taskId] };
    assert.fail(`unexpected ${method}`);
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/agent-bindings.json',
    humanId: 'local-human', humanDir, readRegistry: () => ({ instances: {} }),
    reconcile: async (_, registry) => registry, hostState: async () => null,
    initialize: async () => { initializes++; throw new Error('queue acceptance uncertain'); },
    wait: async () => assert.fail('uncertain INIT must not be retried'), openTask: () => {} });
  assert.deepEqual(result, { status: 'blocked', taskId, reason: 'queue acceptance uncertain',
    classification: 'initializer-failure' });
  assert.equal(creates, 1);
  assert.equal(initializes, 1);
});
