/** Run: node --test platforms/gpt-agents/initialize-governor.test.mjs.
 * In-process fixtures verify canonical preflight and host task-state decisions.
 * Passing does not prove live task creation, queue delivery, or readiness activation.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildGovernorInitialization, hostTaskState } from './initialize-governor.mjs';

const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url));
const gitHumanDir = fileURLToPath(new URL('./fixtures/governor/git-human/', import.meta.url));
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

test('agent-created projectless task is verified through exact host state when hidden from list', async () => {
  const taskId = '00000000-0000-4000-8000-000000000001';
  const client = { request: async (method) => method === 'thread/list'
    ? { data: [], nextCursor: null }
    : { thread: { id: taskId, threadSource: 'agent_created_thread',
      cwd: '/projectless/task', projectId: null } } };
  const row = { id: taskId, thread_source: 'agent_created_thread',
    cwd: '/projectless/task', archived: 0 };
  const active = await hostTaskState(client, taskId, { readAgentCreatedRecord: () => row });
  assert.equal(active.archived, false);
  const archived = await hostTaskState(client, taskId, {
    readAgentCreatedRecord: () => ({ ...row, archived: 1 }),
  });
  assert.equal(archived.archived, true);
  await assert.rejects(() => hostTaskState(client, taskId, {
    readAgentCreatedRecord: () => ({ ...row, cwd: '/different-task' }),
  }), /GOVERNOR_HOST_STATE_UNVERIFIED/);
});

test('newly started projectless task can be verified while loaded but not yet listed', async () => {
  const taskId = '00000000-0000-4000-8000-000000000003';
  const client = { request: async method => method === 'thread/list'
    ? { data: [], nextCursor: null }
    : method === 'thread/loaded/list'
      ? { data: [taskId] }
      : { thread: { id: taskId, cwd: '/projectless/task', projectId: null, ephemeral: false } } };
  const result = await hostTaskState(client, taskId, { readAgentCreatedRecord: () => null });
  assert.equal(result.archived, false);
  assert.equal(result.task.id, taskId);
  const nativeRow = { id: taskId, thread_source: null, cwd: '/projectless/task', archived: 0 };
  const nativeResult = await hostTaskState(client, taskId,
    { readAgentCreatedRecord: () => nativeRow });
  assert.equal(nativeResult.archived, false);
  assert.equal(nativeResult.task.id, taskId);
});

test('exact native task row avoids oversized catalog scans', async () => {
  const taskId = '00000000-0000-4000-8000-000000000008';
  const client = { request: async (method) => {
    if (method === 'thread/list') throw new Error('WebSocket frame exceeds limit');
    if (method === 'thread/read') return { thread: { id: taskId,
      cwd: '/projectless/task', projectId: null, ephemeral: false } };
    throw new Error(`unexpected ${method}`);
  } };
  const result = await hostTaskState(client, taskId, { readAgentCreatedRecord: () =>
    ({ id: taskId, archived: 0, thread_source: null, cwd: '/projectless/task' }) });
  assert.equal(result.archived, false);
});
