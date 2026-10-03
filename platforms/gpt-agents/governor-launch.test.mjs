/** Run: node --test platforms/gpt-agents/governor-launch.test.mjs.
 * In-process tests verify exact human selection, directory resolution, and
 * bounded create-vs-reuse decisions. Passing does not create a live task or
 * prove native delivery and readiness.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensurePersonalGovernor, resolveGovernorHumanDir,
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
  assert.equal(calls.find(call => call.method === 'open').id, taskId);
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
    if (method === 'thread/read') return { thread: { section: { id: pinnedId } } };
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
    if (method === 'thread/read') return { thread: { section: { id: 'pin' } } };
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
