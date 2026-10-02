/**
 * Run: node --test platforms/gpt-agents/plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/register-agent-initialization.unit.test.mjs
 * In-memory filesystem tests prove registration/conditional rollback semantics.
 * No disk writes, queues, tasks or live initialization occur; transport is not tested.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAgentInitialization, rollbackAgentInitialization } from './register-agent-initialization.mjs';
function memory() {
  const files = new Map();
  return {files, fs: {existsSync: file => files.has(file), readFileSync: file => files.get(file), mkdirSync() {}, writeFileSync: (file, data) => files.set(file, data), renameSync: (from,to) => {files.set(to, files.get(from)); files.delete(from);}}};
}
const binding = {platformAdapter:'codex-app', agentId:'admin', generation:1, scope:{kind:'workflow'}, initialization:{readinessToken:'ADMIN_READY', sources:[{id:'rules',ref:'/fictional/rules.md'}]}};
function register(io) { return registerAgentInitialization({sessionId:'task-one',binding,prompt:'INIT\n',dataRoot:'/fictional/runtime'}, {fs:io.fs,now:new Date('2026-01-01T00:00:00Z')}); }
test('registration returns exact existing-registry receipt and refuses active overwrite', () => {
  const io = memory(), result = register(io);
  assert.equal(result.status,'pending'); assert.equal(result.expiresAt,'2026-01-01T00:10:00.000Z');
  const file = result.rollbackReceipt.registryPath, registry = JSON.parse(io.files.get(file));
  assert.equal(registry.instances['task-one'].agentId,'admin');
  registry.instances['task-one'].status = 'active'; io.files.set(file,JSON.stringify(registry));
  assert.throws(() => register(io), /active/);
  assert.equal(rollbackAgentInitialization(result.rollbackReceipt,{fs:io.fs}),false);
});
test('rollback restores only own unchanged pending binding and preserves other entries', () => {
  const io = memory(), file = '/fictional/runtime/agent-bindings.json';
  const previous = {status:'inactive',agentId:'admin'};
  io.files.set(file,JSON.stringify({schemaVersion:1,instances:{'task-one':previous}}));
  const result = register(io), registry = JSON.parse(io.files.get(file));
  registry.instances.other = {status:'active'}; io.files.set(file,JSON.stringify(registry));
  assert.equal(rollbackAgentInitialization(result.rollbackReceipt,{fs:io.fs}),true);
  assert.deepEqual(JSON.parse(io.files.get(file)).instances,{'task-one':previous,other:{status:'active'}});
});
test('new binding rollback removes only its entry; invalid input writes nothing', () => {
  const io = memory(); assert.throws(() => registerAgentInitialization({sessionId:'x',binding:{...binding,platformAdapter:'other'},prompt:'INIT',dataRoot:'/fictional'}, {fs:io.fs}), /codex-app/);
  assert.equal(io.files.size,0);
  const result = register(io); assert.equal(rollbackAgentInitialization(result.rollbackReceipt,{fs:io.fs}),true);
  assert.deepEqual(JSON.parse(io.files.get(result.rollbackReceipt.registryPath)).instances,{});
});
test('renewed registration receives a distinct cryptographic one-use permit nonce', () => {
  const io = memory(), first = register(io), second = register(io);
  const a = first.rollbackReceipt.registeredBinding.initialization.nonce;
  const b = second.rollbackReceipt.registeredBinding.initialization.nonce;
  assert.match(a, /^[0-9a-f-]{36}$/);
  assert.match(b, /^[0-9a-f-]{36}$/);
  assert.notEqual(a, b);
});
