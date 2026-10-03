/**
 * Run with node --test platforms/gpt-agents/governor-reconciliation.test.mjs.
 * Passing proves exact pending-receipt and host-turn decision checks, not live
 * app-server availability, plugin deployment, or operational activation.
 * Effects: none; fixtures are in memory.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { inspectGovernorPending } from './governor-reconciliation.mjs';
import { hostTaskState } from './initialize-governor.mjs';

const prompt = 'Initialize Personal Governor for example-human. Exact host prompt.';
const token = 'PERSONAL_GOVERNOR_READY';
const seconds = value => Date.parse(value) / 1000;

function fixture() {
  const binding = {
    status: 'pending', agentId: 'personal-governor', platformAdapter: 'codex-app', generation: 2,
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    replaces: { taskId: 'previous', generation: 1, strategy: 'successor-first' },
    registeredAt: '2026-10-03T12:00:00Z',
    initialization: {
      nonce: 'exact-permit', promptSha256: createHash('sha256').update(prompt).digest('hex'),
      startedAt: '2026-10-03T12:00:03Z', expiresAt: '2026-10-03T12:10:00Z',
      turnId: 'init-turn', readinessToken: token,
    },
  };
  const registry = { instances: {
    successor: binding,
    previous: { status: 'active', agentId: 'personal-governor', platformAdapter: 'codex-app',
      generation: 1, scope: { kind: 'governed-human', humanProfileId: 'example-human' } },
  } };
  const thread = {
    id: 'successor', projectId: null, status: { type: 'idle' },
    turns: [{ id: 'init-turn', status: 'completed',
      startedAt: seconds('2026-10-03T12:00:03Z'),
      completedAt: seconds('2026-10-03T12:00:12Z'),
      items: [
        { type: 'userMessage', content: [{ type: 'text', text: prompt }] },
        { type: 'agentMessage', phase: 'final_answer', text: token },
      ],
    }],
  };
  return { registry, binding, thread, taskId: 'successor', humanId: 'example-human',
    prompt, now: Date.parse('2026-10-03T12:20:00Z') };
}

test('a completed exact initialization turn can be reconciled after permit expiry', () => {
  assert.deepEqual(inspectGovernorPending(fixture()), {
    status: 'ready', completedTurnId: 'init-turn', completedAt: '2026-10-03T12:00:12.000Z',
  });
});

test('a missing Stop event never makes a different turn or answer ready', () => {
  const wrongTurn = fixture();
  wrongTurn.thread.turns[0].id = 'another-turn';
  assert.equal(inspectGovernorPending(wrongTurn).status, 'blocked');
  const wrongAnswer = fixture();
  wrongAnswer.thread.turns[0].items[1].text = 'Ready';
  assert.equal(inspectGovernorPending(wrongAnswer).status, 'retry');
  const wrongPrompt = fixture();
  wrongPrompt.thread.turns[0].items[0].content[0].text = 'INIT';
  assert.equal(inspectGovernorPending(wrongPrompt).status, 'blocked');
});

test('project attachment, competing Governor, and missing predecessor block activation', () => {
  const project = fixture();
  project.thread.projectId = 'workflow-project';
  assert.equal(inspectGovernorPending(project).status, 'blocked');
  const competing = fixture();
  competing.registry.instances.other = { status: 'active', agentId: 'personal-governor',
    scope: { humanProfileId: 'example-human' } };
  assert.equal(inspectGovernorPending(competing).reason, 'GOVERNOR_COMPETING_BINDING');
  const predecessor = fixture();
  predecessor.registry.instances.previous.status = 'deleted';
  assert.equal(inspectGovernorPending(predecessor).reason, 'GOVERNOR_PREDECESSOR_UNVERIFIED');
  const archived = fixture();
  archived.registry.instances.previous.status = 'archived';
  assert.equal(inspectGovernorPending(archived).status, 'ready');
});

test('expired incomplete permit retries only after the host task stops', () => {
  const stopped = fixture();
  stopped.thread.turns[0].status = 'failed';
  assert.equal(inspectGovernorPending(stopped).status, 'retry');
  const running = fixture();
  running.thread.turns[0].status = 'inProgress';
  assert.equal(inspectGovernorPending(running).status, 'wait');
  const notExpired = fixture();
  notExpired.thread.turns[0].items[1].text = 'BLOCKED';
  notExpired.now = Date.parse('2026-10-03T12:05:00Z');
  assert.equal(inspectGovernorPending(notExpired).status, 'wait');
  const interrupted = fixture();
  interrupted.thread.turns[0].status = 'interrupted';
  interrupted.thread.turns[0].items = interrupted.thread.turns[0].items.slice(0, 1);
  interrupted.now = Date.parse('2026-10-03T12:05:00Z');
  assert.deepEqual(inspectGovernorPending(interrupted),
    { status: 'retry', reason: 'GOVERNOR_INIT_TURN_STOPPED' });
});

test('host catalog distinguishes an archived Governor from an active task', async () => {
  const client = { request: async (_method, params) => ({
    data: params.archived ? [{ id: 'old', projectId: null }] : [{ id: 'new', projectId: null }],
    nextCursor: null,
  }) };
  assert.equal((await hostTaskState(client, 'old')).archived, true);
  assert.equal((await hostTaskState(client, 'new')).archived, false);
  assert.equal(await hostTaskState(client, 'absent'), null);
});
