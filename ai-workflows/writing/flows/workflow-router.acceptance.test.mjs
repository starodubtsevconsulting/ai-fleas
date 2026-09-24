#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { createWorkflowRuntime, validateEndpointResult } from '../../_common/runtime/workflow-router.mjs';
import { renderWorkflowMap } from '../../_common/runtime/workflow-map.mjs';

const workflowRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.resolve(workflowRoot, '../..');
const manifest = parse(fs.readFileSync(path.join(workflowRoot, 'agents.yml'), 'utf8'));
const overlay = parse(fs.readFileSync(
  path.join(publicRoot, 'platforms/gpt-agents/workflows/writing/agents.yml'), 'utf8'));

assert.equal(manifest.policy.communicationMatrix, undefined);
assert.equal(manifest.policy.workflowRuntime, '../_common/runtime/workflow-router.md');
assert.equal(manifest.dependencies, undefined);
assert.ok(!fs.existsSync(path.join(workflowRoot, 'agents/role-communication-matrix.csv')));
assert.equal(overlay.schema_version, 'gpt-agents-workflow-runtime.v2');
assert.equal(overlay.workflow_runtime.visibility, 'hidden');
assert.equal(overlay.runtime_semantics.peer_delivery, 'prohibited');
assert.deepEqual(overlay.role_endpoints.map(({ role }) => role),
  ['admin', 'writer', 'reviewer', 'release-coordinator']);

const scope = {
  profileId: 'example-profile-a',
  workflowId: 'writing',
  logicalProjectId: 'example-profile-a-writing',
  runtimeScopeId: 'writing-run-a',
};
const portableDefinition = JSON.parse(fs.readFileSync(
  path.join(workflowRoot, 'writing.workflow-map.json'), 'utf8'));
const definition = { ...portableDefinition, scope };
assert.equal(portableDefinition.source, 'writing.workflow.md');
assert.equal(
  fs.readFileSync(path.join(workflowRoot, 'writing.workflow-map.mmd'), 'utf8'),
  renderWorkflowMap(portableDefinition),
  'Writing Mermaid companion must be generated from the executable workflow map',
);

const dispatched = [];
const adapter = {
  async resolveRole({ scope: resolvedScope, role }) {
    return { ...resolvedScope, role, instanceId: `writing:${role}` };
  },
  async dispatch(packet) { dispatched.push(packet); },
};
const router = createWorkflowRuntime(definition, { ...scope, routerRuntimeId: 'writing-router-a' });

await router.route({ scope, type: 'review_ready', expectedStage: 'drafting', references: [
  { kind: 'revision', ref: 'article://revision-1' },
  { kind: 'review-packet', ref: 'review://packet-1' },
] }, adapter);
await router.route({ scope, type: 'changes_required', expectedStage: 'review', references: [
  { kind: 'findings', ref: 'review://findings-1' },
] }, adapter);
await router.route({ scope, type: 'review_ready', expectedStage: 'correction', references: [
  { kind: 'revision', ref: 'article://revision-2' },
  { kind: 'review-packet', ref: 'review://packet-2' },
] }, adapter);
const waiting = await router.route({ scope, type: 'human_action_required', expectedStage: 'review', references: [
  { kind: 'human-action', ref: 'human-action://listen-through-revision-2' },
] }, adapter);
assert.equal(waiting.status, 'waiting-human');
assert.equal(waiting.currentStage, 'human_review');
assert.equal(waiting.assignedInstanceId, null);
await router.route({ scope, type: 'human_rejected', expectedStage: 'human_review', references: [
  { kind: 'findings', ref: 'human://revision-2-rejected' },
] }, adapter);
await router.route({ scope, type: 'review_ready', expectedStage: 'correction', references: [
  { kind: 'revision', ref: 'article://revision-3' },
  { kind: 'review-packet', ref: 'review://packet-3' },
] }, adapter);
await router.route({ scope, type: 'accepted', expectedStage: 'review', references: [
  { kind: 'review', ref: 'review://accepted-revision-3' },
] }, adapter);
const completed = await router.route({ scope, type: 'released', expectedStage: 'release', references: [
  { kind: 'release-record', ref: 'medium://scheduled-item-1' },
] }, adapter);

assert.equal(completed.status, 'completed');
assert.equal(completed.currentStage, 'complete');
assert.deepEqual(dispatched.map(({ requiredExecutionRole }) => requiredExecutionRole),
  ['reviewer', 'writer', 'reviewer', 'writer', 'reviewer', 'release-coordinator', 'release-coordinator']);
assert.ok(dispatched.every(({ targetInstanceId, requiredExecutionRole }) =>
  targetInstanceId === `writing:${requiredExecutionRole}`));
assert.deepEqual(completed.history.map(({ fromRole, toRole }) => `${fromRole}->${toRole}`), [
  'writer->reviewer',
  'reviewer->writer',
  'writer->reviewer',
  'reviewer->reviewer',
  'reviewer->writer',
  'writer->reviewer',
  'reviewer->release-coordinator',
  'release-coordinator->release-coordinator',
]);

const expectedResult = {
  correlationId: 'writing-run-a:review:attempt-1',
  stage: 'review',
  role: 'reviewer',
};
assert.deepEqual(validateEndpointResult(expectedResult, {
  acknowledgement: 'COPY THAT',
  ...expectedResult,
  event: 'accepted',
  references: [{ kind: 'review', ref: 'review://accepted-revision-2' }],
}), {
  acknowledgement: 'COPY THAT',
  ...expectedResult,
  event: 'accepted',
  references: [{ kind: 'review', ref: 'review://accepted-revision-2' }],
});
assert.throws(() => validateEndpointResult(expectedResult, {
  acknowledgement: 'COPY THAT',
  ...expectedResult,
  correlationId: 'writing-run-a:review',
  event: 'accepted',
  references: [],
}), ({ code }) => code === 'BLOCKED_ROUTER_RESULT_IDENTITY');
assert.throws(() => validateEndpointResult(expectedResult, {
  ...expectedResult,
  event: 'accepted',
  references: [],
}), ({ code }) => code === 'BLOCKED_ROUTER_ACKNOWLEDGEMENT');

console.log('Writing Workflow Router acceptance: PASS');
