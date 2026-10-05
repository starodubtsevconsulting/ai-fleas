/** Native Admin preparation, explicitly invoked by the lifecycle controller
 * through NativeAdminPreparation.prepare or its compatible function wrapper.
 * Inputs: canonical profile/workflow/project selection and direct-human approval;
 * output: canonical plan with native saved-project ID and verified attached roots.
 * Effects: reads profile sources and native project RPCs only. No task creation,
 * binding writes, plugin installation, or readiness claim occurs in this helper.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { AdminInitializationBuilder, resolveProjectRoot } from './admin-initialization.mjs';
import { GptNativeCatalog, projectRootContains } from './native-project-catalog.mjs';

/** Composes native discovery and canonical payload validation for one controller. */
export class NativeAdminPreparation {
  #io;
  #catalog;
  #builder;

  /** Capture dependencies only; no filesystem access or RPC occurs here. */
  constructor(client, { io = fs } = {}) {
    this.#io = io;
    this.#catalog = new GptNativeCatalog(client, { realpathSync: value => io.realpathSync(value) });
    this.#builder = new AdminInitializationBuilder({ fs: io });
  }

  /**
   * Resolve the exact manual-bootstrap subset from canonical declarations and
   * the saved project's complete native root list. This is discovery only: it
   * does not attest human approval, build a binding, or initialize a task.
   */
  async discoverManualBootstrapScope(request) {
    const io = this.#io;
    const profilePath = io.realpathSync(request.profilePath);
    const profile = parse(io.readFileSync(profilePath, 'utf8'));
    if ((profile.id || profile.name) !== request.profileId) throw new Error('PROFILE_ID_MISMATCH');
    const workflows = profile.workflows?.filter(w => w.path === request.workflowId + '.workflow.md') || [];
    if (workflows.length !== 1) throw new Error('WORKFLOW_SELECTION_AMBIGUOUS');
    const projects = (workflows[0].projects || []).map(entry => {
      const source = io.realpathSync(path.resolve(path.dirname(profilePath), entry.ref));
      const config = parse(io.readFileSync(source, 'utf8'));
      return { id: config.id, root: io.realpathSync(resolveProjectRoot(config.repo_path, source)) };
    });
    if (projects.some(project => typeof project.id !== 'string' || !project.id.trim()))
      throw new Error('PROJECT_ID_INVALID');
    if (new Set(projects.map(project => project.id)).size !== projects.length)
      throw new Error('PROJECT_ID_AMBIGUOUS');
    const logicalProjectId = request.logicalProjectId || `${request.profileId}-${request.workflowId}`;
    if (!(logicalProjectId === `${request.profileId}-${request.workflowId}` ||
        logicalProjectId.startsWith(`${request.profileId}-${request.workflowId}-`)))
      throw new Error('LOGICAL_PROJECT_ID_INVALID');
    const savedProject = await this.#catalog.readNamedProject(logicalProjectId);
    const selected = projects.filter(project =>
      savedProject.roots.some(root => projectRootContains(root, project.root)));
    if (!selected.length) throw new Error('PROJECT_SUBSET_NOT_ATTACHED');
    return { profilePath, profileId: request.profileId, workflowId: request.workflowId,
      logicalProjectId, runtimeScope: request.runtimeScope || logicalProjectId,
      projectIds: selected.map(project => project.id), projects: selected, savedProject };
  }

  /** Read fresh canonical scope and native roots, then build a read-only plan. */
  async prepare(request) {
    const io = this.#io;
    const profilePath = io.realpathSync(request.profilePath);
    const profile = parse(io.readFileSync(profilePath, 'utf8'));
    if ((profile.id || profile.name) !== request.profileId) throw new Error('PROFILE_ID_MISMATCH');
    const workflows = profile.workflows?.filter(w => w.path === request.workflowId + '.workflow.md') || [];
    if (workflows.length !== 1) throw new Error('WORKFLOW_SELECTION_AMBIGUOUS');
    const projects = (workflows[0].projects || []).map(p => {
      const source = io.realpathSync(path.resolve(path.dirname(profilePath), p.ref));
      const config = parse(io.readFileSync(source, 'utf8'));
      return { id: config.id, root: io.realpathSync(resolveProjectRoot(config.repo_path, source)) };
    });
    if (new Set(projects.map(p => p.id)).size !== projects.length) throw new Error('PROJECT_ID_AMBIGUOUS');
    const projectIds = request.projectIds || (projects.length === 1 ? [projects[0].id] : null);
    if (!Array.isArray(projectIds) || !projectIds.length) throw new Error('PROJECT_SUBSET_REQUIRED');
    const selected = projectIds.map(id => {
      const p = projects.find(p => p.id === id);
      if (!p) throw new Error('PROJECT_NOT_AUTHORIZED');
      return p;
    });
    const logicalProjectId = request.logicalProjectId || `${request.profileId}-${request.workflowId}`;
    // One dependency-owned catalog, with fresh read-only discovery rather than cached scope.
    const saved = await this.#catalog.discoverWorkflowSavedProject({ logicalProjectId, authorizedRoots: selected.map(p => p.root) });
    const plan = this.#builder.build({ ...request, profilePath, projectIds, logicalProjectId,
      runtimeScope: request.runtimeScope || logicalProjectId, generation: request.generation || 1,
      savedProjectId: saved.id,
      savedProjects: selected.map(p => ({ projectId: p.id, savedProjectId: saved.id })) });
    return { plan, savedProject: saved };
  }
}

/** Compatibility entry point; lifecycle effects remain outside preparation. */
export async function prepareNativeAdmin(request, client, options = {}) {
  return new NativeAdminPreparation(client, options).prepare(request);
}

/** Read-only compatibility entry point for manual Admin scope discovery. */
export async function discoverManualAdminBootstrapScope(request, client, options = {}) {
  return new NativeAdminPreparation(client, options).discoverManualBootstrapScope(request);
}
