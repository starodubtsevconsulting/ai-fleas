/** Run: node --test platforms/gpt-agents/admin-initialization.test.mjs.
 * Uses canonical checked-in roles/adapters and an in-memory fictional profile.
 * Passing verifies read-only payload preparation and safe rejection, not live host
 * creation, queue delivery, human approval authenticity or Admin readiness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAdminInitialization } from './admin-initialization.mjs';
import { initializeWorkflowAdmin } from './initialize-workflow-admin.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profilePath = path.join(root, 'fictional-profile.yml');
const projectPath = path.join(root, 'fictional-project.yml');
function fixture() {
  const profile = { name: 'fictional', platforms: { default: 'codex-app', available: ['codex-app'] },
    ai_workflows_root: 'ai-workflows', ai_platforms_root: 'platforms',
    workflows: [{ path: 'financial-insights.workflow.md', projects: [{ ref: 'fictional-project.yml' }] }] };
  const documents = new Map([[profilePath, profile], [projectPath, { id: 'fictional-records', repo_path: '.' }]]);
  const io = {
    realpathSync: value => documents.has(value) ? value : fs.realpathSync(value),
    statSync: value => documents.has(value) ? { isFile: () => true } : fs.statSync(value),
    readFileSync: (value, encoding) => documents.has(value) ? JSON.stringify(documents.get(value)) : fs.readFileSync(value, encoding),
  };
  const request = { profilePath, profileId: 'fictional', workflowId: 'financial-insights',
    projectIds: ['fictional-records'], logicalProjectId: 'fictional-financial-insights',
    savedProjectId: 'fictional-host-project', runtimeScope: 'fictional-financial-insights',
    savedProjects: [{ projectId: 'fictional-records', savedProjectId: 'fictional-host-project' }], generation: 1,
    authorization: { humanApproved: true, profileId: 'fictional', workflowId: 'financial-insights',
      projectIds: ['fictional-records'], logicalProjectId: 'fictional-financial-insights' } };
  return { request, profile, options: { fs: io } };
}
test('prepares exactly one canonical Admin payload without host effects', () => {
  const f = fixture();
  const result = buildAdminInitialization(f.request, f.options);
  assert.equal(result.bootstrapPayload.binding.agentId, 'admin');
  assert.equal(result.bootstrapPayload.binding.platformAdapter, 'codex-app');
  assert.equal(result.bootstrapPayload.binding.initialization.bootstrapAuthorization.verified, false);
  assert.equal(result.bootstrapPayload.binding.initialization.readinessToken, 'ADMIN_READY');
  assert.deepEqual(result.scope.projects, [{ id: 'fictional-records', savedProjectId: 'fictional-host-project', root }]);
  assert.match(result.bootstrapPayload.prompt, /INIT\./);
  assert.equal(result.sources.adminContract, path.join(root, 'ai-workflows/_common/roles/admin.md'));
  assert.equal(result.sources.projectManifests.length, 1);
});
test('rejects unauthorized subset and missing human approval request', () => {
  const f = fixture();
  assert.throws(() => buildAdminInitialization({ ...f.request, projectIds: ['unknown'] }, f.options), /PROJECT_NOT_AUTHORIZED/);
  assert.throws(() => buildAdminInitialization({ ...f.request, authorization: null }, f.options), /HUMAN_BOOTSTRAP_APPROVAL_REQUIRED/);
});
test('rejects wrong profile, ambiguous workflow and effective platform mismatch', () => {
  const f = fixture();
  assert.throws(() => buildAdminInitialization({ ...f.request, profileId: 'other' }, f.options), /PROFILE_ID_MISMATCH/);
  f.profile.workflows.push(f.profile.workflows[0]);
  assert.throws(() => buildAdminInitialization(f.request, f.options), /WORKFLOW_SELECTION_AMBIGUOUS/);
  f.profile.workflows.pop();
  f.profile.platforms = { default: 'hermes-app', available: ['hermes-app'] };
  assert.throws(() => buildAdminInitialization(f.request, f.options), /LIFECYCLE_ADAPTER_MISMATCH/);
});
test('requires exact usable host scope before producing a binding', () => {
  const f = fixture();
  assert.throws(() => buildAdminInitialization({ ...f.request, savedProjects: [] }, f.options), /SAVED_PROJECT_ID_REQUIRED/);
  assert.throws(() => buildAdminInitialization({ ...f.request, runtimeScope: '' }, f.options), /EXACT_SCOPE_REQUIRED/);
});
test('builder payload survives JSON transport and creates/reuses only verified Admin', async () => {
  const f = fixture();
  const input = JSON.parse(JSON.stringify(buildAdminInitialization(f.request, f.options)));
  assert.equal(input.projectDeclarations[0].declaredRef, 'fictional-project.yml');
  const catalog = { complete: true, projects: [{ id: 'fictional-host-project', root }], tasks: [], bindings: [] };
  const effects = [];
  const host = {
    catalog: async () => structuredClone(catalog),
    prerequisites: async () => true,
    verifyApproval: async ({ approval, scope, operation }) => {
      assert.equal(approval.humanApproved, true);
      assert.equal(scope.profileId, 'fictional');
      assert.equal(operation, 'initialize-admin-only');
      return true;
    },
    create: async request => {
      effects.push(['create', request.role]);
      catalog.tasks.push({ id: 'fictional-task', status: 'active', projectId: 'fictional-host-project' });
      return { taskId: 'fictional-task', status: 'created' };
    },
    initialize: async ({ taskId, payload }) => {
      effects.push(['initialize', payload.binding.agentId]);
      catalog.bindings.push({ ...payload.binding, taskId, status: 'active',
        initialization: { ...payload.binding.initialization, completedTurnId: 'fictional-turn', completedAt: '2026-01-01T00:00:00Z' } });
      return { taskId, status: 'submitted' };
    },
    wait: async ({ taskId }) => ({ taskId, status: 'complete', turnId: 'fictional-turn', token: 'ADMIN_READY' }),
  };
  const created = await initializeWorkflowAdmin(input, host);
  assert.equal(created.status, 'ready', created.reason);
  assert.equal(created.mode, 'created');
  assert.deepEqual(effects, [['create', 'admin'], ['initialize', 'admin']]);
  effects.length = 0;
  const reused = await initializeWorkflowAdmin(input, host);
  assert.equal(reused.status, 'ready', reused.reason);
  assert.equal(reused.mode, 'reused');
  assert.deepEqual(effects, []);
});
