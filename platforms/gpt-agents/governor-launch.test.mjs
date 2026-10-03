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
      ephemeral: false, forkedFromId: null, parentThreadId: null, cwd: humanDir } };
    return {};
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
    initialize: (...args) => { calls.push({ method: 'initialize', args }); return { threadId: taskId, status: 'pending' }; },
    openTask: id => calls.push({ method: 'open', id }),
    wait: async (_, __, id) => ({ status: 'pending', taskId: id }) });
  assert.deepEqual(result, { status: 'pending', taskId });
  assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
  assert.equal(calls.find(call => call.method === 'thread/start').params.projectId, null);
  assert.equal(calls.find(call => call.method === 'initialize').args[2], taskId);
  const titleAt = calls.findIndex(call => call.method === 'thread/name/set');
  const initAt = calls.findIndex(call => call.method === 'initialize');
  assert.ok(titleAt >= 0 && titleAt < initAt);
  assert.equal(calls[titleAt].params.name, '🧭 Personal Governor');
  assert.equal(calls.some(call => call.method === 'open'), false);
});

test('launcher opens a fresh task only after verified readiness', async () => {
  const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)).replace(/\/$/, '');
  const taskId = '00000000-0000-4000-8000-000000000011';
  const opened = [];
  const progress = [];
  const client = { request: async method => method === 'thread/start'
    ? { thread: { id: taskId, projectId: null, ephemeral: false, cwd: humanDir } } : {} };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => ({ instances: {} }), reconcile: async (_, registry) => registry,
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
    if (method === 'thread/read' && !params.includeTurns)
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
    if (params.includeTurns) return { thread: { id: taskId, projectId: null,
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
    initialize: () => { throw new Error('duplicate INIT'); },
    openTask: () => { throw new Error('duplicate task'); } });
  assert.deepEqual(result, { status: 'existing', taskId });
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
      ephemeral: false, cwd: humanDir } };
    return {};
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir, preflight: () => {},
    readRegistry: () => registry, reconcile: async () => registry,
    initialize: (...args) => { calls.push({ method: 'initialize', args });
      return { threadId: freshId, status: 'pending' }; },
    openTask: id => calls.push({ method: 'open', id }),
    wait: async (_, __, id) => ({ status: 'pending', taskId: id }) });
  assert.equal(result.taskId, freshId);
  assert.equal(calls.find(call => call.method === 'initialize').args[2], freshId);
  assert.equal(calls.some(call => call.params?.threadId === archivedId), false);
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
