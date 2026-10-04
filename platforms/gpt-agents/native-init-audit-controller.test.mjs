/**
 * Run: node --test platforms/gpt-agents/native-init-audit-controller.test.mjs.
 * Developer-invoked in-memory authorization/receipt tests; no processes or files.
 * Passing proves exact call guards and receipt ordering, not live host readiness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeInitAuditController } from './native-init-audit-controller.mjs';
import { EphemeralInitAudit } from './ephemeral-init-audit.mjs';

function fixture() {
  const scope = { kind: 'workflow', profileId: 'example', workflowId: 'sample', logicalProjectId: 'example-sample',
    savedProjectId: 'project', runtimeScope: 'example-sample', projects: [{ id: 'records', savedProjectId: 'project', root: '/fictional/data' }] };
  const binding = { agentId: 'admin', platformAdapter: 'codex-app', status: 'pending', generation: 1, scope, registeredAt: new Date().toISOString(),
    initialization: { auditTransport: 'ephemeral-process', sources: [{ id: 'rules', ref: '/fictional/rules' }],
      nonce: 'exact-nonce', turnId: 'turn', expiresAt: '2099-01-01T00:00:00Z' } };
  const registry = { instances: { task: binding } }, writes = [], runs = [];
  let serialized;
  const io = { readFileSync: ref => ref.endsWith('agent-bindings.json') ? JSON.stringify(registry) : 'fictional canonical contract',
    writeFileSync: (ref, value) => { serialized = value; writes.push(ref); },
    renameSync: () => { Object.assign(registry, JSON.parse(serialized)); } };
  const parent = { id: 'task', model: 'configured-model', reasoningEffort: 'high', status: { type: 'active' }, projectId: 'project', cwd: '/fictional/data', turns: [{ id: 'turn', status: 'inProgress' }] };
  const client = { request: async method => { assert.equal(method, 'thread/read'); return { thread: parent }; } };
  const workerResult = { result: { verdict: 'pass', findings: [] }, workerThreadId: 'utility', workerClosed: true, exitCode: 0 };
  const policy = new EphemeralInitAudit({ executable: '/fictional/codex' });
  const worker = { arguments: input => policy.arguments(input),
    run: async input => { runs.push(input); assert.equal(writes.length, 0); return workerResult; } };
  const plan = { scope, bootstrapPayload: { binding: structuredClone(binding), endpoint: { model: 'configured-model', reasoning: 'high' } },
    sources: { adminContract: '/fictional/roles/admin.md', selfCommands: '/fictional/agents/self-commands.md', lifecycle: '/fictional/agents/lifecycle.md' },
    manifest: { initializer: { agentId: 'admin' } }, approval: { humanApproved: true } };
  const controller = new NativeInitAuditController(client, { worker, plan, pluginData: '/fictional/plugin', io });
  controller.bindTask('task', binding);
  const request = { method: 'item/tool/call', params: { threadId: 'task', turnId: 'turn', callId: 'call', tool: 'ai_fleas_init_audit', arguments: {
    preflightSummary: 'Read all canonical sources and verified exact canonical identity and scope.',
    preflight: { completed: true, sourceRefs: ['/fictional/rules'], effectiveModel: 'configured-model', reasoning: 'high' } } } };
  return { controller, request, registry, parent, workerResult, runs, writes, client, plan, io };
}
test('specialized Admin audits both roles and resolves utilities from the common contract', async () => {
  const f = fixture();
  f.plan.sources.commonAdminContract = '/fictional/roles/admin.md';
  f.plan.sources.adminContract = '/fictional/writing/agents/roles/admin.md';
  const read = f.io.readFileSync;
  const refs = [];
  f.io.readFileSync = ref => { refs.push(ref); return read(ref); };
  await f.controller.handle(f.request);
  assert.ok(refs.includes('/fictional/agents/utility-subagents.md'));
  assert.ok(refs.includes('/fictional/roles/admin.md'));
  assert.ok(refs.includes('/fictional/writing/agents/roles/admin.md'));
  assert.ok(!refs.includes('/fictional/writing/agents/agents/utility-subagents.md'));
});
test('concurrent calls reserve authorization before awaiting native evidence', async () => {
  const f = fixture(); let release;
  f.client.request = () => new Promise(resolve => { release = () => resolve({ thread: f.parent }); });
  const first = f.controller.handle(f.request);
  await assert.rejects(f.controller.handle({ ...f.request, params: { ...f.request.params, callId: 'second' } }), /DUPLICATE/);
  release(); await first;
  assert.equal(f.runs.length, 1);
});
test('writes only exact existing binding after verified worker exit and preserves configured model', async () => {
  const f = fixture(), result = await f.controller.handle(f.request);
  assert.equal(result.success, true);
  assert.equal(f.runs.length, 1);
  assert.equal(f.runs[0].model, 'configured-model');
  assert.equal(f.runs[0].cwd, '/fictional/data');
  assert.equal(f.runs[0].evidence.controllerVerifiedHostEvidence.task.id, 'task');
  assert.equal(f.runs[0].evidence.controllerVerifiedHostEvidence.oneUsePermit.consumedByTurnId, 'turn');
  assert.equal(f.registry.instances.task.initialization.audit.callId, 'call');
  assert.equal(f.registry.instances.task.initialization.audit.workerClosed, true);
  await assert.rejects(f.controller.handle(f.request), /DUPLICATE/);
  assert.equal(f.runs.length, 1);
});
test('invalid call identity, caller parameters, permit and canonical sources stop before inference', async () => {
  for (const mutate of [
    f => { f.request.params.threadId = 'foreign'; }, f => { f.request.params.turnId = 'foreign'; },
    f => { f.request.params.namespace = 'foreign'; }, f => { f.request.params.arguments.command = 'forbidden'; },
    f => { delete f.registry.instances.task.initialization.expiresAt; },
    f => { f.registry.instances.task.initialization.expiresAt = '2000-01-01T00:00:00Z'; },
    f => { f.registry.instances.task.initialization.sources = []; },
    f => { f.registry.instances.task.registeredAt = '2000-01-01T00:00:00Z'; },
    f => { f.registry.instances.other = structuredClone(f.registry.instances.task); },
    f => { f.parent.status.type = 'idle'; },
    f => { f.parent.projectId = 'foreign'; }, f => { f.parent.turns[0].status = 'completed'; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(f.controller.handle(f.request), /INVALID|UNVERIFIED/);
    assert.equal(f.runs.length, 0); assert.equal(f.writes.length, 0);
  }
});
test('worker failure or unverified close cannot produce a receipt; blocked verdict remains blocked', async () => {
  for (const mutate of [f => { f.workerResult.workerClosed = false; }, f => { f.workerResult.exitCode = 1; }]) {
    const f = fixture(); mutate(f);
    await assert.rejects(f.controller.handle(f.request), /RELEASE_UNVERIFIED/);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture(); f.workerResult.result.verdict = 'blocked';
  const response = await f.controller.handle(f.request);
  assert.equal(JSON.parse(response.contentItems[0].text).audit.verdict, 'blocked');
});

test('incomplete, future-tense, wrong-source and wrong-model attestations never consume an audit', async () => {
  for (const mutate of [
    f => { delete f.request.params.arguments.preflight; },
    f => { f.request.params.arguments.preflight.completed = false; },
    f => { f.request.params.arguments.preflight.sourceRefs = []; },
    f => { f.request.params.arguments.preflight.sourceRefs = ['/foreign/rules']; },
    f => { f.request.params.arguments.preflight.effectiveModel = 'foreign'; },
    f => { f.request.params.arguments.preflight.reasoning = 'low'; },
    f => { f.request.params.arguments.preflightSummary = 'I will verify every canonical source.'; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(f.controller.handle(f.request), /ARGUMENTS_INVALID|PREFLIGHT_INCOMPLETE/);
    assert.equal(f.runs.length, 0); assert.equal(f.writes.length, 0);
  }
});

test('Sol Low audit receives canonical snapshots, actual model readback and fixed effect limits', async () => {
  const f = fixture();
  f.plan.bootstrapPayload.endpoint = { model: 'gpt-5.6-sol', reasoning: 'low' };
  f.parent.model = 'gpt-5.6-sol'; f.parent.reasoningEffort = 'low';
  Object.assign(f.request.params.arguments.preflight, { effectiveModel: 'gpt-5.6-sol', reasoning: 'low' });
  await f.controller.handle(f.request);
  const e = f.runs[0].evidence;
  assert.equal(e.canonicalSources[0].ref, '/fictional/rules');
  assert.equal(e.canonicalSources[0].text, 'fictional canonical contract');
  assert.match(e.canonicalSources[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(e.controllerVerifiedModelBinding.observedTaskReasoning, 'low');
  assert.ok(e.controllerVerifiedAuditInvocation.arguments.includes('--ignore-user-config'));
  assert.ok(e.controllerVerifiedAuditInvocation.arguments.includes('--ephemeral'));
  assert.ok(e.controllerVerifiedAuditInvocation.arguments.includes('model_reasoning_effort="low"'));
  assert.ok(e.controllerVerifiedAuditInvocation.arguments.includes('mcp_servers={}'));
});

test('observed task model mismatch blocks before inference', async () => {
  const f = fixture(); f.parent.reasoningEffort = 'low';
  await assert.rejects(f.controller.handle(f.request), /PARENT_TURN_UNVERIFIED/);
  assert.equal(f.runs.length, 0);
});
