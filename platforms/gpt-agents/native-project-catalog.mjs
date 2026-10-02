/** Read complete saved-project scopes through supported project/list and project/read RPCs.
 * Called by the native Admin lifecycle controller, not automatically by Markdown.
 * Inputs: an injected client.request(method, params), optional realpathSync, and an
 * exact logical-project name/authorized roots. GptNativeCatalog owns those injected
 * dependencies; named function exports remain compatibility wrappers. Returns
 * verified canonical roots. Construction performs no RPC or filesystem reads.
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

/** Read-only catalog service. No cache: every lookup observes fresh host evidence. */
export class GptNativeCatalog {
  #client;
  #realpathSync;

  constructor(client, { realpathSync = fs.realpathSync } = {}) {
    this.#client = client;
    this.#realpathSync = realpathSync;
  }

  /** Exhaust all pages before trusting uniqueness; never mutate host projects. */
  async list() {
    const client = this.#client;
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

  /** Require unchanged immutable identity and every attached canonical root. */
  async read(entry) {
    const client = this.#client, realpathSync = this.#realpathSync;
    if (typeof client?.request !== 'function') fail('HOST_PROJECT_RPC_UNSUPPORTED');
    if (!nonempty(entry?.id) || !nonempty(entry?.name)) fail('HOST_PROJECT_CATALOG_INVALID');
    const response = await client.request('project/read', { projectId: entry.id });
    const project = response?.project;
    if (project?.id !== entry.id || project?.name !== entry.name) fail('HOST_PROJECT_IDENTITY_MISMATCH');
    if (!Array.isArray(project.roots) || project.roots.length === 0) fail('HOST_PROJECT_ROOTS_INCOMPLETE');
    const roots = [...new Set(project.roots.map(root => canonicalRoot(root?.path, realpathSync)))];
    return { id: project.id, name: project.name, rootsComplete: true, roots };
  }

  /** Unselected entries remain explicitly incomplete; do not inspect their roots. */
  async readCatalog({ selectedProjectIds } = {}) {
    const listed = await this.list();
    if (selectedProjectIds !== undefined && (!Array.isArray(selectedProjectIds) ||
        selectedProjectIds.some(id => !nonempty(id)) || new Set(selectedProjectIds).size !== selectedProjectIds.length))
      fail('HOST_PROJECT_SELECTION_INVALID');
    if (selectedProjectIds?.some(id => !listed.some(project => project.id === id))) fail('HOST_PROJECT_NOT_FOUND');
    const projects = [];
    for (const entry of listed) {
      projects.push(selectedProjectIds === undefined || selectedProjectIds.includes(entry.id)
        ? await this.read(entry)
        : { id: entry.id, name: entry.name, rootsComplete: false });
    }
    return projects;
  }

  /** Names discover one candidate, then identity and root containment verify scope. */
  async discoverWorkflowSavedProject({ logicalProjectId, authorizedRoots } = {}) {
    if (!nonempty(logicalProjectId)) fail('LOGICAL_PROJECT_ID_REQUIRED');
    if (!Array.isArray(authorizedRoots) || authorizedRoots.length === 0) fail('AUTHORIZED_PROJECT_ROOTS_REQUIRED');
    const required = authorizedRoots.map(root => canonicalRoot(root, this.#realpathSync));
    const catalog = await this.list();
    const matches = catalog.filter(project => project.name === logicalProjectId);
    if (matches.length !== 1) fail(matches.length ? 'HOST_PROJECT_NAME_AMBIGUOUS' : 'HOST_PROJECT_NOT_FOUND');
    const selected = await this.read(matches[0]);
    if (required.some(root => !selected.roots.some(attached => projectRootContains(attached, root)))) fail('HOST_PROJECT_SCOPE_MISMATCH');
    return selected;
  }
}

// Compatibility entry points retain their original argument shapes and effects.
export async function listNativeProjects(client) {
  return new GptNativeCatalog(client).list();
}
export async function readNativeProject(client, entry, options = {}) {
  return new GptNativeCatalog(client, options).read(entry);
}
export async function readNativeProjectCatalog(client, options = {}) {
  return new GptNativeCatalog(client, options).readCatalog(options);
}
export async function discoverWorkflowSavedProject(client, options = {}) {
  return new GptNativeCatalog(client, options).discoverWorkflowSavedProject(options);
}
