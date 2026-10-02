/**
 * Run: node --test platforms/gpt-agents/ephemeral-init-audit.test.mjs.
 * Developer-run in-memory process tests, no files or inference. Passing proves
 * arguments, protocol/close guards and bounded effects, not live model isolation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { EphemeralInitAudit } from './ephemeral-init-audit.mjs';

function fixture(events, exitCode = 0) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
  const calls = [], kills = [];
  child.kill = signal => { kills.push(signal); };
  child.stdin.end = prompt => { calls.push(prompt); queueMicrotask(() => {
    for (const event of events) child.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
    child.emit('close', exitCode, null);
  }); };
  const audit = new EphemeralInitAudit({ executable: '/fictional/codex', spawnProcess: (...args) => { calls.push(args); return child; } });
  return { audit, calls, kills };
}
const input = { cwd: '/fictional/project', model: 'configured-model', reasoning: 'high', evidence: { scope: 'fictional' } };
const success = [{ type: 'thread.started', thread_id: 'ephemeral-worker' }, { type: 'turn.started' },
  { type: 'item.completed', item: { type: 'agent_message', text: '{"verdict":"pass","findings":[]}' } },
  { type: 'turn.completed' }];
test('owns process dependencies and disables inherited config and effectful tools', async () => {
  const f = fixture(success);
  assert.deepEqual(await f.audit.run(input), { result: { verdict: 'pass', findings: [] }, workerThreadId: 'ephemeral-worker', workerClosed: true, exitCode: 0 });
  const [, args, options] = f.calls[0];
  assert.ok(args.includes('--ephemeral') && args.includes('--ignore-user-config'));
  assert.ok(args.includes('read-only') && args.includes('web_search="disabled"'));
  assert.equal(options.shell, false);
  assert.ok(!args.includes('--worktree') && !args.includes('resume') && !args.includes('--output-last-message'));
  assert.equal(f.kills.length, 0);
});
test('never claims completion from final text without successful process exit and turn proof', async () => {
  for (const [events, code] of [[success, 1], [success.slice(0,-1), 0],
    [success.filter(e => e.type !== 'thread.started'), 0]]) {
    await assert.rejects(fixture(events, code).audit.run(input), /COMPLETION_UNVERIFIED|PROTOCOL_INVALID/);
  }
});
test('duplicate worker or turn identity never becomes completion evidence', async () => {
  for (const event of [success[0], success[1], success[3]]) {
    await assert.rejects(fixture([...success, event]).audit.run(input), /PROTOCOL_INVALID/);
  }
});
test('final model text remains pending until the owned process actually closes', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
  child.kill = () => {};
  child.stdin.end = () => { for (const event of success) child.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n')); };
  const audit = new EphemeralInitAudit({ executable: '/fictional/codex', spawnProcess: () => child });
  let settled = false;
  const result = audit.run(input).then(value => { settled = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  child.emit('close', 0, null);
  assert.equal((await result).workerClosed, true);
});
test('tool attempts and inference errors block rather than becoming audit evidence', async () => {
  for (const event of [{ type: 'item.started', item: { type: 'command_execution' } }, { type: 'turn.failed' }]) {
    const f = fixture([event, ...success]);
    await assert.rejects(f.audit.run(input), /TOOL_ATTEMPTED|INFERENCE_FAILED/);
    assert.ok(f.kills.includes('SIGTERM'));
  }
});
test('model cannot inject effect parameters or malformed result fields', async () => {
  assert.throws(() => new EphemeralInitAudit({ executable: 'codex' }), /CONFIGURATION_INVALID/);
  await assert.rejects(fixture(success).audit.run({ ...input, cwd: 'relative' }), /BINDING_INVALID/);
  const malformed = structuredClone(success); malformed[2].item.text = '{"verdict":"pass","findings":[],"command":"anything"}';
  await assert.rejects(fixture(malformed).audit.run(input), /RESULT_INVALID/);
});
test('post-spawn failure with no close is bounded and never reports worker release', async () => {
  const child = new EventEmitter(), kills = [];
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
  child.kill = signal => { kills.push(signal); };
  child.stdin.end = () => { throw new Error('fictional broken input'); };
  const audit = new EphemeralInitAudit({ executable: '/fictional/codex', spawnProcess: () => child, timeoutMs: 1000 });
  await assert.rejects(audit.run(input), /PROCESS_RELEASE_UNVERIFIED/);
  assert.ok(kills.includes('SIGTERM') && kills.includes('SIGKILL'));
});
