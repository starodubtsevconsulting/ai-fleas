/** In-memory Governor audit authorization, reservation and release tests. No inference or host mutations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runGovernorInitAudit, GovernorInitAuditController, governorInitAuditTool } from './governor-init-audit.mjs';

function fixture() {
  const file = '/fictional/runtime/agent-bindings.json';
  const sources = ['human-profile', 'human-governor', 'portable-role', 'gpt-initializer']
    .map(id => ({ id, ref: '/fictional/human/' + id + '.yml' }));
  const binding = { agentId: 'personal-governor', platformAdapter: 'codex-app', status: 'pending',
    generation: 3, scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: { sources, memoryBinding: 'profile-memory://governor', auditTransport: 'ephemeral-process',
      turnId: 'turn', startedAt: '2026-01-01T00:00:01Z', expiresAt: '2099-01-01T00:00:00Z', nonce: 'nonce',
      promptSha256: createHash('sha256').update('exact INIT').digest('hex') } };
  const files = new Map([[file, JSON.stringify({ instances: { task: binding } })]]);
  const io = { readFileSync: ref => files.has(ref) ? files.get(ref) : ref.endsWith('human-governor.yml')
    ? 'platformBindings:\n  codex-app:\n    utilitySubagents:\n      enabled: true\n      routing:\n        boundedAnalysis: { model: gpt-6-sol, reasoning: low }' : 'canonical role',
    realpathSync: ref => ref, mkdirSync() {}, closeSync() {}, unlinkSync: ref => files.delete(ref),
    existsSync: ref => files.has(ref), statSync: () => ({ mtimeMs: Date.now() }),
    openSync: ref => { if (files.has(ref)) throw Object.assign(new Error('busy'), { code: 'EEXIST' }); files.set(ref, ''); return ref; },
    writeFileSync: (ref, text) => files.set(ref, text),
    renameSync: (a, b) => { files.set(b, files.get(a)); files.delete(a); } };
  const thread = { id: 'task', projectId: null, cwd: '/fictional/human', status: { type: 'active' },
    turns: [{ id: 'turn', status: 'inProgress', items: [{ type: 'userMessage', content: [{ type: 'text', text: 'exact INIT' }] }] }] };
  const input = { callerTaskId: 'task', registryFile: file, summary: 'Read and verified exact scope and memory.',
    client: { request: async () => ({ thread }) } };
  const result = { result: { verdict: 'pass', findings: [] }, workerClosed: true, exitCode: 0, workerThreadId: 'worker' };
  let runs = 0;
  const options = { io, hostState: async () => ({ archived: false, task: thread }),
    preflight: () => ({ binding, prompt: 'exact INIT' }), worker: { run: async call => {
      runs++; assert.equal(call.model, 'gpt-6-sol'); assert.equal(call.reasoning, 'low');
      assert.equal(JSON.parse(files.get(file)).instances.task.initialization.audit.verdict, 'running');
      return result;
    } } };
  return { input, options, files, file, thread, result, runs: () => runs,
    mutate: fn => { const registry = JSON.parse(files.get(file)); fn(registry.instances.task); files.set(file, JSON.stringify(registry)); } };
}

test('reserves exact INIT before inference and records pass only after worker exit', async () => {
  const f = fixture();
  const result = await runGovernorInitAudit(f.input, f.options);
  assert.equal(result.audit.verdict, 'pass');
  assert.equal(result.audit.workerClosed, true);
  assert.equal(result.audit.generation, 3);
  await assert.rejects(runGovernorInitAudit(f.input, f.options), /BINDING_UNVERIFIED/);
  assert.equal(f.runs(), 1);
});

test('wrong caller, archived task, source drift, wrong prompt and expired permit cannot run audit', async () => {
  for (const change of [
    f => { f.input.callerTaskId = 'foreign'; },
    f => { f.options.hostState = async () => ({ archived: true, task: f.thread }); },
    f => { f.mutate(b => b.initialization.memoryBinding = 'foreign'); },
    f => { f.thread.turns[0].items[0].content[0].text = 'ordinary message'; },
    f => { f.mutate(b => b.initialization.expiresAt = '2000-01-01T00:00:00Z'); },
    f => { f.thread.projectId = 'workflow'; },
  ]) {
    const f = fixture(); change(f);
    await assert.rejects(runGovernorInitAudit(f.input, f.options), /UNVERIFIED|CHANGED/);
    assert.equal(f.runs(), 0);
  }
});

test('uncertain release and changed generation never produce a passed receipt', async () => {
  const unclosed = fixture(); unclosed.result.workerClosed = false;
  await assert.rejects(runGovernorInitAudit(unclosed.input, unclosed.options), /RELEASE_UNVERIFIED/);
  assert.equal(JSON.parse(unclosed.files.get(unclosed.file)).instances.task.initialization.audit.verdict, 'running');
  const changed = fixture();
  const run = changed.options.worker.run;
  changed.options.worker.run = async call => { const result = await run(call); changed.mutate(b => b.generation++); return result; };
  await assert.rejects(runGovernorInitAudit(changed.input, changed.options), /BINDING_CHANGED/);
});

test('only native request for controller-bound task, generation and turn can dispatch audit', async () => {
  const f = fixture();
  let runs = 0;
  const binding = JSON.parse(f.files.get(f.file)).instances.task;
  const controller = new GovernorInitAuditController(f.input.client, { taskId: 'task', binding,
    registryFile: f.file, io: f.options.io, worker: f.options.worker,
    runAudit: async input => { runs++; assert.equal(input.callId, 'native-call'); return { audit: {}, result: {} }; } });
  const request = { method: 'item/tool/call', params: { tool: governorInitAuditTool.name, threadId: 'task',
    turnId: 'turn', callId: 'native-call', arguments: { summary: 'Verified canonical preflight.' } } };
  for (const patch of [{ threadId: 'foreign' }, { turnId: 'foreign' }, { namespace: 'foreign' },
    { tool: 'unrelated' }, { arguments: { summary: 'done', taskId: 'foreign' } }]) {
    await assert.rejects(controller.handle({ ...request, params: { ...request.params, ...patch } }), /INVALID|UNVERIFIED/);
  }
  assert.equal(runs, 0);
  assert.equal((await controller.handle(request)).success, true);
  assert.equal(runs, 1);
  await assert.rejects(controller.handle(request), /UNVERIFIED/);
});

test('concurrent competing Governor insertion blocks locked audit reservation', async () => {
  const f = fixture();
  f.input.client.request = async () => {
    const registry = JSON.parse(f.files.get(f.file));
    registry.instances.other = structuredClone(registry.instances.task);
    registry.instances.other.initialization.nonce = 'other-nonce';
    f.files.set(f.file, JSON.stringify(registry));
    return { thread: f.thread };
  };
  await assert.rejects(runGovernorInitAudit(f.input, f.options), /COMPETING_BINDING/);
  assert.equal(f.runs(), 0);
});


test('separate active welcome audit preserves activation proof and requires its exact prompt', async () => {
  const f = fixture();
  const activationAudit = {verdict: 'pass', workerClosed: true, exitCode: 0, turnId: 'activation-turn', generation: 3};
  f.mutate(b => { b.status = 'active'; delete b.initialization.turnId; delete b.initialization.promptSha256;
    b.initialization.audit = activationAudit; b.initialization.completedTurnId = 'activation-turn';
    b.initialization.expiresAt = '2000-01-01T00:00:00Z';
    b.initialization.welcome = {status: 'inProgress', requestId: 'request', turnId: 'welcome-turn',
      requestedAt: new Date().toISOString()}; });
  f.thread.turns = [{id: 'welcome-turn', status: 'inProgress', items: [
    {type: 'userMessage', content: [{type: 'text', text: 'exact welcome'}]}]}];
  const input = {...f.input, phase: 'welcome', expectedPrompt: 'wrong welcome'};
  await assert.rejects(runGovernorInitAudit(input, f.options), /HOST_UNVERIFIED/);
  input.expectedPrompt = 'exact welcome';
  const options = {...f.options, worker: {run: async () => {
    const b = JSON.parse(f.files.get(f.file)).instances.task;
    assert.deepEqual(b.initialization.audit, activationAudit);
    assert.equal(b.initialization.welcome.audit.verdict, 'running');
    return f.result;
  }}};
  const result = await runGovernorInitAudit(input, options);
  assert.equal(result.audit.turnId, 'welcome-turn');
  const b = JSON.parse(f.files.get(f.file)).instances.task;
  assert.equal(b.status, 'active');
  assert.deepEqual(b.initialization.audit, activationAudit);
  assert.equal(b.initialization.welcome.audit.verdict, 'pass');
  await assert.rejects(runGovernorInitAudit(input, options), /BINDING_UNVERIFIED/);
});
