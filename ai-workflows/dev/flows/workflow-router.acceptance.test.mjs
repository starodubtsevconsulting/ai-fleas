#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { createWorkflowRuntime } from '../../_common/runtime/workflow-router.mjs';

const workflowRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.resolve(workflowRoot, '../..');
const manifest = parse(fs.readFileSync(path.join(workflowRoot, 'agents.yml'), 'utf8'));
const gptOverlay = parse(fs.readFileSync(path.join(publicRoot, 'platforms/gpt-agents/workflows/dev/agents.yml'), 'utf8'));
const gptPlatform = parse(fs.readFileSync(path.join(publicRoot, 'platforms/gpt-agents/platform.yml'), 'utf8'));
assert.equal(manifest.policy.communicationMatrix, undefined);
assert.equal(manifest.policy.workflowRuntime, '../_common/runtime/workflow-router.md');
assert.equal(manifest.dependencies, undefined);
assert.ok(!fs.existsSync(path.join(workflowRoot, 'agents/role-communication-matrix.csv')));
assert.ok(manifest.agents.filter(({ agentId }) => !['designer-reviewer', 'judge'].includes(agentId))
  .every(({ communicationMode }) => communicationMode === 'router-runtime-only'));
assert.equal(gptOverlay.schema_version, 'gpt-agents-workflow-runtime.v2');
assert.equal(gptOverlay.workflow_runtime.visibility, 'hidden');
assert.equal(gptOverlay.runtime_semantics.peer_delivery, 'prohibited');
assert.deepEqual(gptOverlay.role_endpoints.map(({ role }) => role),
  ['admin', 'designer-reviewer', 'judge', 'manager', 'coder', 'command-runner', 'ui-acceptance-tester']);
assert.ok(!gptPlatform.capabilities.includes('peer-messaging'));
assert.ok(gptPlatform.capabilities.includes('workflow-runtime-dispatch'));

const scope = {
  profileId: 'example-profile-a',
  workflowId: 'dev',
  logicalProjectId: 'example-profile-a-dev',
  runtimeScopeId: 'runtime-a',
};
const definition = {
  source: '../dev.workflow.md',
  scope,
  initialStage: 'planning',
  capabilityOwners: {
    requirements: 'designer-reviewer',
    implementation: 'coder',
    technical_review: 'designer-reviewer',
    staffing_and_continuity: 'manager',
    final_acceptance: 'designer-reviewer',
  },
  stages: {
    planning: { role: 'designer-reviewer', capability: 'requirements', transitions: { accepted: { to: 'implementation', requiredReferenceKinds: ['plan'] } } },
    implementation: { role: 'coder', capability: 'implementation', transitions: { implemented: { to: 'verification', requiredReferenceKinds: ['revision'] } } },
    verification: { role: 'designer-reviewer', capability: 'technical_review', transitions: { accepted: { to: 'complete', terminal: true, requiredReferenceKinds: ['evidence'] } } },
    exception: { role: 'manager', capability: 'staffing_and_continuity', transitions: {} },
    complete: { role: 'designer-reviewer', capability: 'final_acceptance', transitions: {} },
  },
  exceptionTransitions: {
    blocked: { to: 'exception' },
    depleted: { to: 'exception' },
    unclear: { to: 'exception' },
  },
};
const dispatched = [];
const adapter = {
  async resolveRole({ scope: resolvedScope, role }) {
    return { ...resolvedScope, role, instanceId: `instance:${role}` };
  },
  async dispatch(packet) {
    dispatched.push(packet);
  },
};

const router = createWorkflowRuntime(definition, { ...scope, routerRuntimeId: 'router-a' });
let state = router.transition({
  scope, type: 'accepted', expectedStage: 'planning', references: [{ kind: 'plan', ref: 'plan://42' }],
});
assert.equal(state.currentStage, 'implementation');
assert.equal(state.assignedRole, 'coder');
assert.deepEqual(state.references, [{ kind: 'plan', ref: 'plan://42' }]);

const happyPath = createWorkflowRuntime(definition, { ...scope, routerRuntimeId: 'router-happy' });
await happyPath.route({
  scope, type: 'accepted', expectedStage: 'planning', references: [{ kind: 'plan', ref: 'plan://happy' }],
}, adapter);
await happyPath.route({
  scope, type: 'implemented', expectedStage: 'implementation',
  references: [{ kind: 'revision', ref: 'git://revision-1' }],
}, adapter);
const completed = await happyPath.route({
  scope, type: 'accepted', expectedStage: 'verification',
  references: [{ kind: 'evidence', ref: 'test://run-1' }],
}, adapter);
assert.equal(completed.currentStage, 'complete');
assert.equal(completed.status, 'completed');
assert.deepEqual(completed.history.map(({ fromRole, toRole }) => ({ fromRole, toRole })), [
  { fromRole: 'designer-reviewer', toRole: 'coder' },
  { fromRole: 'coder', toRole: 'designer-reviewer' },
  { fromRole: 'designer-reviewer', toRole: 'designer-reviewer' },
]);
assert.deepEqual(dispatched.map(({ requiredExecutionRole, targetInstanceId }) =>
  ({ requiredExecutionRole, targetInstanceId })), [
  { requiredExecutionRole: 'coder', targetInstanceId: 'instance:coder' },
  { requiredExecutionRole: 'designer-reviewer', targetInstanceId: 'instance:designer-reviewer' },
  { requiredExecutionRole: 'designer-reviewer', targetInstanceId: 'instance:designer-reviewer' },
]);

state = router.transition({
  scope, type: 'blocked', expectedStage: 'implementation', references: [{ kind: 'blocker', ref: 'issue://7' }],
});
assert.equal(state.currentStage, 'exception');
assert.equal(state.assignedRole, 'manager');
assert.equal(state.resumeStage, 'implementation');
assert.deepEqual(state.history.map(({ event, fromStage, toStage, exception }) =>
  ({ event, fromStage, toStage, exception })), [
  { event: 'accepted', fromStage: 'planning', toStage: 'implementation', exception: false },
  { event: 'blocked', fromStage: 'implementation', toStage: 'exception', exception: true },
]);

const isolated = createWorkflowRuntime(definition, { ...scope, routerRuntimeId: 'router-b' });
const before = isolated.snapshot();
assert.throws(() => isolated.transition({
  scope: { ...scope, profileId: 'example-profile-b' },
  type: 'accepted', expectedStage: 'planning', references: [{ kind: 'plan', ref: 'plan://foreign' }],
}), ({ code }) => code === 'BLOCKED_ROUTER_SCOPE');
assert.deepEqual(isolated.snapshot(), before);

const failedDelivery = createWorkflowRuntime(definition, { ...scope, routerRuntimeId: 'router-failed-delivery' });
const beforeFailure = failedDelivery.snapshot();
await assert.rejects(() => failedDelivery.route({
  scope, type: 'accepted', expectedStage: 'planning', references: [{ kind: 'plan', ref: 'plan://42' }],
}, {
  resolveRole: adapter.resolveRole,
  async dispatch() { throw new Error('delivery failed'); },
}), /delivery failed/);
assert.deepEqual(failedDelivery.snapshot(), beforeFailure);

assert.throws(() => isolated.transition({
  scope, type: 'accepted', expectedStage: 'planning',
  references: [{ kind: 'plan', ref: 'plan://42' }], body: 'full artifact must not enter Router state',
}), ({ code }) => code === 'BLOCKED_ROUTER_ARTIFACT_BODY');
assert.deepEqual(isolated.snapshot(), before);

console.log('Workflow Router acceptance: PASS');
