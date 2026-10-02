/**
 * Run: node --test platforms/gpt-agents/agent-closeout.test.mjs.
 * Passing in-memory class tests prove guarded effect order, exact scope checks
 * and truthful pending results. They do not prove a native child-close capability,
 * live archive success, host deactivation, or desktop message delivery recovery.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCloseout } from './agent-closeout.mjs';

function fixture() {
  const scope = { kind: 'workflow', profileId: 'example', workflowId: 'example-workflow' };
  const input = { taskId: 'agent', role: 'admin', scope, approval: { humanApproved: true } };
  const state = { complete: true, descendantsComplete: true,
    task: { id: 'agent', role: 'admin', scope, bindingVerified: true, archived: false, liveState: 'idle' },
    children: [{ id: 'audit', parentId: 'agent', scope, liveState: 'idle' }] };
  const effects = [];
  let disabled = false;
  const host = {
    verifyApproval: async request => request.operation === 'end-agent' && request.approval.humanApproved,
    readState: async () => structuredClone(state),
    closeChild: async ({ taskId }) => { effects.push('close:' + taskId); state.children.find(child => child.id === taskId).liveState = 'notLoaded'; },
    archive: async () => { effects.push('archive'); state.task.archived = true; state.task.liveState = 'notLoaded'; },
    disableDelivery: async () => { effects.push('disable'); disabled = true; },
    verifyDeliveryDisabled: async () => disabled,
  };
  return { input, state, effects, host, close: () => new AgentCloseout(host).close(input) };
}

test('direct class closes descendants before archival and verifies disabled delivery', async () => {
  const f = fixture();
  const result = await f.close();
  assert.equal(result.status, 'archived');
  assert.equal(result.deliveryDisabled, true);
  assert.deepEqual(f.effects, ['close:audit', 'archive', 'disable']);
});
test('missing capabilities stop before any effect', async () => {
  const f = fixture(); delete f.host.closeChild;
  assert.match((await f.close()).reason, /CAPABILITY_UNSUPPORTED/);
  assert.deepEqual(f.effects, []);
});
test('unapproved or unverified parent never closes children or archives', async () => {
  for (const change of [f => { f.input.approval.humanApproved = false; }, f => { f.state.task.bindingVerified = false; },
    f => { f.state.task.scope = { ...f.input.scope, workflowId: 'other' }; }, f => { f.state.task.liveState = 'running'; }]) {
    const f = fixture(); change(f);
    assert.equal((await f.close()).status, 'STOP_PENDING_DEACTIVATION');
    assert.deepEqual(f.effects, []);
  }
});
test('ambiguous, running, incomplete or unrelated descendant stops all effects', async () => {
  for (const change of [f => f.state.children.push({ ...f.state.children[0] }),
    f => { f.state.children[0].liveState = 'running'; }, f => { f.state.descendantsComplete = false; },
    f => { f.state.children[0].parentId = 'unrelated'; }]) {
    const f = fixture(); change(f);
    assert.equal((await f.close()).status, 'STOP_PENDING_DEACTIVATION');
    assert.deepEqual(f.effects, []);
  }
});
test('close acceptance without observed release cannot archive', async () => {
  const f = fixture(); f.host.closeChild = async () => f.effects.push('close');
  assert.match((await f.close()).reason, /RELEASE_UNVERIFIED/);
  assert.deepEqual(f.effects, ['close']);
});
test('failed archive rereads notLoaded parent and never resumes or resends queued work', async () => {
  const f = fixture();
  f.host.archive = async () => { f.effects.push('archive'); f.state.task.liveState = 'notLoaded'; throw new Error('active writer'); };
  const result = await f.close();
  assert.equal(result.status, 'STOP_PENDING_DEACTIVATION');
  assert.equal(result.archiveOutcome, 'failed-unarchived');
  assert.equal(result.observedState.task.liveState, 'notLoaded');
  assert.equal(result.observedState.task.archived, false);
  assert.equal(result.queuedWorkResent, false);
  assert.deepEqual(f.effects, ['close:audit', 'archive']);
});
test('accepted archive followed by transport timeout remains pending with verified membership', async () => {
  const f = fixture();
  f.host.archive = async () => { f.effects.push('archive'); f.state.task.archived = true;
    f.state.task.liveState = 'notLoaded'; throw new Error('response timed out'); };
  const result = await f.close();
  assert.equal(result.status, 'STOP_PENDING_DEACTIVATION');
  assert.equal(result.archiveOutcome, 'verified-archived-after-error');
  assert.equal(result.observedState.task.archived, true);
  assert.deepEqual(f.effects, ['close:audit', 'archive']);
});
test('archive error with unavailable, incomplete or mismatched fresh state stays uncertain', async () => {
  for (const mode of ['unavailable', 'incomplete', 'mismatched']) {
    const f = fixture(); let archiveAttempted = false;
    f.host.archive = async () => { archiveAttempted = true; f.effects.push('archive'); throw new Error('disconnected'); };
    f.host.readState = async () => {
      if (archiveAttempted) {
        if (mode === 'unavailable') throw new Error('read failed');
        const fresh = structuredClone(f.state);
        if (mode === 'incomplete') fresh.complete = false;
        else fresh.task.id = 'other';
        return fresh;
      }
      return structuredClone(f.state);
    };
    const result = await f.close();
    assert.equal(result.status, 'STOP_PENDING_DEACTIVATION');
    assert.equal(result.archiveOutcome, 'uncertain');
    assert.deepEqual(f.effects, ['close:audit', 'archive']);
  }
});
test('new running descendant in fresh state blocks archive', async () => {
  const f = fixture(); const original = f.host.closeChild;
  f.host.closeChild = async request => {
    await original(request);
    f.state.children.push({ id: 'new-child', parentId: 'agent', scope: f.input.scope, liveState: 'running' });
  };
  const result = await f.close();
  assert.equal(result.status, 'STOP_PENDING_DEACTIVATION');
  assert.equal(result.archiveOutcome, 'not-attempted');
  assert.deepEqual(f.effects, ['close:audit']);
});
test('archived membership alone is not verified deactivation', async () => {
  const f = fixture(); f.host.verifyDeliveryDisabled = async () => false;
  const result = await f.close();
  assert.equal(result.status, 'STOP_PENDING_DEACTIVATION');
  assert.match(result.reason, /DELIVERY_DISABLE_UNVERIFIED/);
  assert.equal(result.observedState.task.archived, true);
});
test('nested descendants close deepest first', async () => {
  const f = fixture();
  f.state.children.push({ id: 'nested', parentId: 'audit', scope: f.input.scope, liveState: 'idle' });
  assert.equal((await f.close()).status, 'archived');
  assert.deepEqual(f.effects, ['close:nested', 'close:audit', 'archive', 'disable']);
});
