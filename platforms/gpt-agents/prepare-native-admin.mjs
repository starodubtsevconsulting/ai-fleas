/** Native Admin preparation, explicitly invoked by the lifecycle controller.
 * Inputs: canonical profile/workflow/project selection and direct-human approval;
 * output: canonical plan with native saved-project ID and verified attached roots.
 * Effects: reads profile sources and native project RPCs only. No task creation,
 * binding writes, plugin installation, or readiness claim occurs in this helper.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { buildAdminInitialization, resolveProjectRoot } from './admin-initialization.mjs';
import { discoverWorkflowSavedProject } from './native-project-catalog.mjs';

export async function prepareNativeAdmin(request, client, {io = fs} = {}) {
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
  const saved = await discoverWorkflowSavedProject(client, { logicalProjectId, authorizedRoots: selected.map(p => p.root), realpathSync: value => io.realpathSync(value) });
  const plan = buildAdminInitialization({ ...request, profilePath, projectIds, logicalProjectId,
    runtimeScope: request.runtimeScope || logicalProjectId, generation: request.generation || 1,
    savedProjectId: saved.id,
    savedProjects: selected.map(p => ({ projectId: p.id, savedProjectId: saved.id })) }, {fs:io});
  return { plan, savedProject: saved };
}
