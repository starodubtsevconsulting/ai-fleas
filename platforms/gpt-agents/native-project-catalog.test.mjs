/** Run: node --test platforms/gpt-agents/native-project-catalog.test.mjs.
 * Passing verifies paginated supported RPC catalog normalization, exact name/root
 * matching and fail-closed errors with in-memory fixtures. It does not prove live
 * desktop transport, task creation, approval, binding, or Admin readiness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GptNativeCatalog, readNativeProjectCatalog, discoverWorkflowSavedProject, projectRootContains } from './native-project-catalog.mjs';
const project = (id, name = 'fictional-financial-insights', roots = ['/fictional/code', '/fictional/records']) => ({ id, name, roots: roots.map(path => ({ path })) });
const realpathSync = value => value.replace('/fictional/link', '/fictional/records');
function fixture(pages = [{ data: [project('one')], nextCursor: null }], reads = {}) {
  const calls = [];
  let index = 0;
  return { calls, request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'project/list') return pages[index++];
    if (method === 'project/read') return { project: reads[params.projectId] ?? pages.flatMap(page => page.data).find(p => p.id === params.projectId) };
    throw new Error('Unexpected mutation RPC');
  } };
}
test('catalog construction only owns dependencies and performs no effects', async () => {
  const client = fixture();
  const rootsRead = [];
  const catalog = new GptNativeCatalog(client, { realpathSync: value => { rootsRead.push(value); return value; } });
  assert.deepEqual(client.calls, []);
  assert.deepEqual(rootsRead, []);
  assert.equal(typeof catalog.list, 'function');
  // Unsupported transport is rejected on use, not during dependency ownership.
  await assert.rejects(new GptNativeCatalog(null).list(), /HOST_PROJECT_RPC_UNSUPPORTED/);
});
test('class methods preserve fresh RPC ordering and selected-root evidence', async () => {
  const client = fixture([{ data: [project('one')] }, { data: [project('one')] }, { data: [project('one')] }]);
  const catalog = new GptNativeCatalog(client, { realpathSync });
  assert.equal((await catalog.list())[0].id, 'one');
  assert.equal((await catalog.read(project('one'))).rootsComplete, true);
  assert.equal((await catalog.readCatalog({ selectedProjectIds: ['one'] }))[0].id, 'one');
  assert.equal((await catalog.discoverWorkflowSavedProject({ logicalProjectId: 'fictional-financial-insights', authorizedRoots: ['/fictional/link'] })).id, 'one');
  assert.deepEqual(client.calls.map(call => call.method), ['project/list', 'project/read', 'project/list', 'project/read', 'project/list', 'project/read']);
});
test('exhausts pagination and reads immutable IDs with complete secondary roots', async () => {
  const client = fixture([{ data: [project('other', 'other')], nextCursor: 'next' }, { data: [project('one')], nextCursor: null }]);
  const found = await discoverWorkflowSavedProject(client, { logicalProjectId: 'fictional-financial-insights', authorizedRoots: ['/fictional/link'], realpathSync });
  assert.deepEqual(found, { id: 'one', name: 'fictional-financial-insights', rootsComplete: true, roots: ['/fictional/code', '/fictional/records'] });
  assert.deepEqual(client.calls.map(c => c.method), ['project/list', 'project/list', 'project/read']);
  assert.deepEqual(client.calls[1].params, { cursor: 'next' });
});
test('rejects duplicate IDs and cursor loops', async () => {
  await assert.rejects(readNativeProjectCatalog(fixture([{ data: [project('one'), project('one')] }]), { realpathSync }), /HOST_PROJECT_ID_AMBIGUOUS/);
  await assert.rejects(readNativeProjectCatalog(fixture([{ data: [], nextCursor: 'same' }, { data: [], nextCursor: 'same' }]), { realpathSync }), /HOST_PROJECT_CURSOR_INVALID/);
});
test('rejects read identity changes and incomplete roots', async () => {
  for (const changed of [project('other'), project('one', 'changed')]) {
    await assert.rejects(readNativeProjectCatalog(fixture(undefined, { one: changed }), { realpathSync }), /HOST_PROJECT_IDENTITY_MISMATCH/);
  }
  for (const roots of [undefined, [], [{ path: 'relative' }], [{ path: '' }]]) {
    const changed = { ...project('one'), roots };
    await assert.rejects(readNativeProjectCatalog(fixture(undefined, { one: changed }), { realpathSync }), /HOST_PROJECT_ROOT/);
  }
});
test('rejects absent or ambiguous names and missing authorized secondary scope', async () => {
  const options = { logicalProjectId: 'fictional-financial-insights', authorizedRoots: ['/fictional/records'], realpathSync };
  await assert.rejects(discoverWorkflowSavedProject(fixture([{ data: [] }]), options), /HOST_PROJECT_NOT_FOUND/);
  await assert.rejects(discoverWorkflowSavedProject(fixture([{ data: [project('one'), project('two')] }]), options), /HOST_PROJECT_NAME_AMBIGUOUS/);
  await assert.rejects(discoverWorkflowSavedProject(fixture([{ data: [project('one', undefined, ['/fictional/code'])] }]), options), /HOST_PROJECT_SCOPE_MISMATCH/);
});
test('filesystem failures do not become verified root evidence', async () => {
  await assert.rejects(readNativeProjectCatalog(fixture(), { realpathSync: () => { throw new Error('absent'); } }), /HOST_PROJECT_ROOT_UNAVAILABLE/);
});
test('canonical authorized subfolders pass but sibling-prefix paths do not', async () => {
  assert.equal(projectRootContains('/fictional/records', '/fictional/records/period'), true);
  assert.equal(projectRootContains('/fictional/records', '/fictional/records-other'), false);
  assert.equal(projectRootContains('/fictional/records', '/fictional/outside'), false);
  assert.equal(projectRootContains('relative', '/fictional/records'), false);
  const options = { logicalProjectId: 'fictional-financial-insights', authorizedRoots: ['/fictional/records/period'], realpathSync };
  assert.equal((await discoverWorkflowSavedProject(fixture(), options)).id, 'one');
  await assert.rejects(discoverWorkflowSavedProject(fixture(), { ...options, authorizedRoots: ['/fictional/records-other'] }), /HOST_PROJECT_SCOPE_MISMATCH/);
});
test('unrelated unusable roots do not block selected discovery or scoped catalog', async () => {
  const pages = [{ data: [project('unrelated', 'unrelated', ['relative']), project('one')] }];
  const client = fixture(pages);
  assert.equal((await discoverWorkflowSavedProject(client, { logicalProjectId: 'fictional-financial-insights', authorizedRoots: ['/fictional/records'], realpathSync })).id, 'one');
  assert.deepEqual(client.calls.filter(call => call.method === 'project/read').map(call => call.params.projectId), ['one']);
  const catalog = await readNativeProjectCatalog(fixture(pages), { selectedProjectIds: ['one'], realpathSync });
  assert.deepEqual(catalog[0], { id: 'unrelated', name: 'unrelated', rootsComplete: false });
  assert.equal(catalog[1].rootsComplete, true);
});
