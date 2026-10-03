/** Run: node --test platforms/gpt-agents/initialize-admin-command.test.mjs.
 * In-memory command discovery/approval tests; no sockets, files or inference.
 * Passing does not prove live identity, hook trust, human authorization or real
 * sidebar assignment. App verifier cases exercise the injected adapter contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminControllerCommand } from './initialize-admin-command.mjs';
const request = { profileId: 'example', workflowId: 'sample', profilePath: '/fictional/profile.yml',
  authorization: { humanApproved: true, profileId: 'example', workflowId: 'sample', projectIds: ['records'], logicalProjectId: 'example-sample' } };
function fixture({ initializeResult, verifyAppProject = async ({ taskId, scope }) => ({ taskId, attached: true,
  nativeProjectId: scope.projects[0].savedProjectId, logicalProjectId: scope.logicalProjectId,
  appProjectId: 'app-project' }) } = {}) {
  const calls = [], scope = { kind: 'workflow', profileId: 'example', workflowId: 'sample',
    logicalProjectId: 'example-sample', runtimeScope: 'example-sample',
    projects: [{ id: 'records', savedProjectId: 'project', root: '/fictional/data' }] };
  const client = { request: async method => {
    calls.push(method); return { data: [{ cwd: '/fictional/data', hooks: [{ pluginId: 'ai-fleas-gpt@ai-fleas',
      enabled: true, trustStatus: 'trusted', eventName: 'sessionStart', command: 'node /fictional/plugin/scripts/agent-bootstrap-hook.mjs' }] }] };
  }, close: () => calls.push('close') };
  const command = new AdminControllerCommand({ env: { AI_FLEAS_CODEX_BIN: '/fictional/codex' }, home: '/fictional/home',
    io: { accessSync: () => {}, realpathSync: value => value },
    connect: async options => { calls.push(options); return client; },
    prepare: async selected => { assert.deepEqual(selected.projectIds, ['records']); return { plan: { scope } }; },
    verifyAppProject,
    initialize: async (selected, options) => {
      assert.equal(selected.auditTransport, 'ephemeral-process');
      assert.equal(options.installedScripts, '/fictional/plugin/scripts');
      assert.equal(await options.verifyApproval({ approval: request.authorization, scope, operation: 'initialize-admin-only' }), true);
      assert.equal(await options.verifyApproval({ approval: request.authorization, scope, operation: 'ordinary-work' }), false);
      calls.push('initialize');
      return initializeResult || { status: 'ready', taskId: 'admin-task', token: 'ADMIN_READY', controllerReleased: true };
    } });
  return { command, calls, client };
}
test('requires approval before discovery and closes owned connection after supported initialization', async () => {
  const f = fixture(); assert.equal(f.calls.length, 0);
  assert.equal((await f.command.run({ ...request, authorization: null })).reason, 'HUMAN_BOOTSTRAP_APPROVAL_REQUIRED');
  assert.equal(f.calls.length, 0);
  assert.equal((await f.command.run(request)).status, 'ready');
  assert.equal(f.calls.at(-1), 'close');
});
test('missing owning-app verifier preserves task but blocks complete success', async () => {
  const f = fixture({ verifyAppProject: null });
  const result = await f.command.run(request);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED');
  assert.equal(result.taskId, 'admin-task');
  assert.equal(result.controllerReleased, true);
  assert.equal(result.adminInitialized, true);
  assert.equal(result.token, undefined);
  assert.equal(f.calls.filter(call => call === 'initialize').length, 1);
});
test('exact owning-app attachment is required; native project ID is not app attachment', async () => {
  for (const change of [{ attached: false }, { taskId: 'other' }, { nativeProjectId: 'other' },
    { logicalProjectId: 'other' }, { appProjectId: null }]) {
    const f = fixture({ verifyAppProject: async () => ({ taskId: 'admin-task', attached: true,
      nativeProjectId: 'project', logicalProjectId: 'example-sample', appProjectId: 'app-project', ...change }) });
    assert.equal((await f.command.run(request)).status, 'blocked');
  }
  const success = await fixture().command.run(request);
  assert.equal(success.status, 'ready');
  assert.equal(success.appProjectAttached, true);
  assert.equal(success.appProjectId, 'app-project');
});
test('app catalog failure cannot become native-only success', async () => {
  const f = fixture({ verifyAppProject: async () => { throw new Error('catalog unavailable'); } });
  assert.equal((await f.command.run(request)).reason, 'ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED');
  assert.equal(f.calls.at(-1), 'close');
});
test('release blocker preserves accepted INIT evidence and reports attachment as not verified', async () => {
  let appChecks = 0;
  const result = await fixture({
    initializeResult: { status: 'blocked', reason: 'writer busy', taskId: 'admin-task',
      turnId: 'accepted-turn', generation: 4, mode: 'created', readinessStatus: 'ready',
      titleStatus: { status: 'failed', reason: 'blank rollout' }, controllerReleased: false,
      controllerReleaseStatus: 'blocked' },
    verifyAppProject: async () => { appChecks++; return { attached: true }; },
  }).command.run(request);
  assert.equal(result.status, 'blocked'); assert.equal(result.reason, 'writer busy');
  assert.equal(result.taskId, 'admin-task'); assert.equal(result.turnId, 'accepted-turn');
  assert.equal(result.generation, 4); assert.equal(result.mode, 'created');
  assert.equal(result.readinessStatus, 'ready'); assert.equal(result.titleStatus.status, 'failed');
  assert.equal(result.controllerReleaseStatus, 'blocked');
  assert.equal(result.appProjectAttached, false); assert.equal(result.appProjectAttachmentStatus, 'not-verified');
  assert.equal(appChecks, 0);
});
test('untrusted, ambiguous or missing hook location blocks before creation', async () => {
  const f = fixture(); f.client.request = async () => ({ data: [{ cwd: '/fictional/data', hooks: [] }] });
  assert.equal((await f.command.run(request)).reason, 'BOOTSTRAP_PLUGIN_LOCATION_UNVERIFIED');
  assert.equal(f.calls.at(-1), 'close');
});
