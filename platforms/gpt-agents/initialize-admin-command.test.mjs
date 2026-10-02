/** Run: node --test platforms/gpt-agents/initialize-admin-command.test.mjs.
 * In-memory command discovery/approval tests; no sockets, files or inference.
 * Passing does not prove live identity, hook trust or human authorization.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminControllerCommand } from './initialize-admin-command.mjs';
const request = { profileId: 'example', workflowId: 'sample', profilePath: '/fictional/profile.yml',
  authorization: { humanApproved: true, profileId: 'example', workflowId: 'sample', projectIds: ['records'], logicalProjectId: 'example-sample' } };
function fixture() {
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
    initialize: async (selected, options) => {
      assert.equal(selected.auditTransport, 'ephemeral-process');
      assert.equal(options.installedScripts, '/fictional/plugin/scripts');
      assert.equal(await options.verifyApproval({ approval: request.authorization, scope, operation: 'initialize-admin-only' }), true);
      assert.equal(await options.verifyApproval({ approval: request.authorization, scope, operation: 'ordinary-work' }), false);
      return { status: 'ready', controllerReleased: true };
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
test('untrusted, ambiguous or missing hook location blocks before creation', async () => {
  const f = fixture(); f.client.request = async () => ({ data: [{ cwd: '/fictional/data', hooks: [] }] });
  assert.equal((await f.command.run(request)).reason, 'BOOTSTRAP_PLUGIN_LOCATION_UNVERIFIED');
  assert.equal(f.calls.at(-1), 'close');
});
