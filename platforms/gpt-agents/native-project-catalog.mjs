/** Read complete saved-project scopes through supported project/list and project/read RPCs.
 * Called by the native Admin lifecycle controller, not automatically by Markdown.
 * Inputs: an injected client.request(method, params), optional realpathSync, and an
 * exact logical-project name/authorized roots. Returns verified canonical roots.
 * Effects: read-only host RPC and filesystem canonicalization; never creates tasks,
 * changes projects, initializes roles, or treats a primary path as complete scope.
 */
import fs from 'node:fs';
import path from 'node:path';

function fail(code) { throw new Error(code); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
/** Both arguments must already be absolute canonical roots. */
export function projectRootContains(root, selected) {
  if (!path.isAbsolute(root || '') || !path.isAbsolute(selected || '')) return false;
  const relative = path.relative(root, selected);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function canonicalRoot(value, realpathSync) {
  if (!nonempty(value) || !path.isAbsolute(value)) fail('HOST_PROJECT_ROOT_INVALID');
  let result;
  try { result = realpathSync(value); } catch { fail('HOST_PROJECT_ROOT_UNAVAILABLE'); }
  if (!nonempty(result) || !path.isAbsolute(result)) fail('HOST_PROJECT_ROOT_INVALID');
  return result;
}

export async function listNativeProjects(client) {
  if (typeof client?.request !== 'function') fail('HOST_PROJECT_RPC_UNSUPPORTED');
  const listed = [], ids = new Set(), cursors = new Set();
  let cursor;
  do {
    const page = await client.request('project/list', cursor === undefined ? {} : { cursor });
    if (!Array.isArray(page?.data)) fail('HOST_PROJECT_CATALOG_INVALID');
    for (const project of page.data) {
      if (!nonempty(project?.id) || !nonempty(project?.name)) fail('HOST_PROJECT_CATALOG_INVALID');
      if (ids.has(project.id)) fail('HOST_PROJECT_ID_AMBIGUOUS');
      ids.add(project.id); listed.push(project);
    }
    cursor = page.nextCursor;
    if (cursor === undefined || cursor === null) break;
    if (!nonempty(cursor) || cursors.has(cursor)) fail('HOST_PROJECT_CURSOR_INVALID');
    cursors.add(cursor);
  } while (true);
  return listed;
}

export async function readNativeProject(client, entry, { realpathSync = fs.realpathSync } = {}) {
  if (typeof client?.request !== 'function') fail('HOST_PROJECT_RPC_UNSUPPORTED');
  if (!nonempty(entry?.id) || !nonempty(entry?.name)) fail('HOST_PROJECT_CATALOG_INVALID');
  const response = await client.request('project/read', { projectId: entry.id });
  const project = response?.project;
  if (project?.id !== entry.id || project?.name !== entry.name) fail('HOST_PROJECT_IDENTITY_MISMATCH');
  if (!Array.isArray(project.roots) || project.roots.length === 0) fail('HOST_PROJECT_ROOTS_INCOMPLETE');
  const roots = [...new Set(project.roots.map(root => canonicalRoot(root?.path, realpathSync)))];
  return { id: project.id, name: project.name, rootsComplete: true, roots };
}

export async function readNativeProjectCatalog(client, { realpathSync = fs.realpathSync, selectedProjectIds } = {}) {
  const listed = await listNativeProjects(client);
  if (selectedProjectIds !== undefined && (!Array.isArray(selectedProjectIds) ||
      selectedProjectIds.some(id => !nonempty(id)) || new Set(selectedProjectIds).size !== selectedProjectIds.length))
    fail('HOST_PROJECT_SELECTION_INVALID');
  if (selectedProjectIds?.some(id => !listed.some(project => project.id === id))) fail('HOST_PROJECT_NOT_FOUND');
  const projects = [];
  for (const entry of listed) {
    projects.push(selectedProjectIds === undefined || selectedProjectIds.includes(entry.id)
      ? await readNativeProject(client, entry, { realpathSync })
      : { id: entry.id, name: entry.name, rootsComplete: false });
  }
  return projects;
}

export async function discoverWorkflowSavedProject(client, { logicalProjectId, authorizedRoots, realpathSync = fs.realpathSync } = {}) {
  if (!nonempty(logicalProjectId)) fail('LOGICAL_PROJECT_ID_REQUIRED');
  if (!Array.isArray(authorizedRoots) || authorizedRoots.length === 0) fail('AUTHORIZED_PROJECT_ROOTS_REQUIRED');
  const required = authorizedRoots.map(root => canonicalRoot(root, realpathSync));
  const catalog = await listNativeProjects(client);
  const matches = catalog.filter(project => project.name === logicalProjectId);
  if (matches.length !== 1) fail(matches.length ? 'HOST_PROJECT_NAME_AMBIGUOUS' : 'HOST_PROJECT_NOT_FOUND');
  const selected = await readNativeProject(client, matches[0], { realpathSync });
  if (required.some(root => !selected.roots.some(attached => projectRootContains(attached, root)))) fail('HOST_PROJECT_SCOPE_MISMATCH');
  return selected;
}
