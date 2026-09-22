#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHumanEntryRuntime,
  validateEndpointResult,
} from './workflow-router.mjs';

const scope = {
  profileId: 'profile-a',
  workflowId: 'example',
  logicalProjectId: 'profile-a-example',
  runtimeScopeId: 'scope-a',
};

function definition(overrides = {}) {
  return {
    source: 'example.workflow.md',
    scope,
    initialStage: 'drafting',
    capabilityOwners: {
      drafting: 'writer',
      review: 'reviewer',
      release: 'release-coordinator',
    },
    stages: {
      drafting: {
        role: 'writer',
        capability: 'drafting',
        transitions: { review_ready: { to: 'review', requiredReferenceKinds: ['revision'] } },
      },
      review: {
        role: 'reviewer',
        capability: 'review',
        transitions: { accepted: { to: 'release', requiredReferenceKinds: ['review'] } },
      },
      release: { role: 'release-coordinator', capability: 'release', transitions: {} },
    },
    ...overrides,
  };
}

function endpoint(role, instanceId = `task-${role}`) {
  return { ...scope, role, instanceId };
}

test('a directly addressed owner becomes the entry endpoint without another dispatch', async () => {
  let dispatched = false;
  const entry = await createHumanEntryRuntime(definition(), { ...scope, routerRuntimeId: 'router-a' }, {
    scope,
    capability: 'review',
    correlationId: 'corr-review-a',
    recipient: endpoint('reviewer'),
    references: [{ kind: 'revision', ref: 'article://revision-a' }],
  }, {
    async resolveRole() { throw new Error('must not resolve another endpoint'); },
    async dispatch() { dispatched = true; },
  });

  assert.equal(entry.disposition, 'accepted-by-recipient');
  assert.equal(entry.snapshot.currentStage, 'review');
  assert.equal(entry.snapshot.assignedRole, 'reviewer');
  assert.equal(entry.snapshot.assignedInstanceId, 'task-reviewer');
  assert.equal(dispatched, false);

  const result = validateEndpointResult({
    correlationId: entry.correlationId,
    stage: entry.snapshot.currentStage,
    role: entry.snapshot.assignedRole,
  }, {
    acknowledgement: 'COPY THAT',
    correlationId: 'corr-review-a',
    stage: 'review',
    role: 'reviewer',
    event: 'accepted',
    references: [{ kind: 'review', ref: 'review://accepted-a' }],
  });
  assert.equal(result.event, 'accepted');

  const continuation = [];
  const advanced = await entry.runtime.route({
    scope,
    type: result.event,
    expectedStage: result.stage,
    references: result.references,
  }, {
    async resolveRole({ role }) { return endpoint(role); },
    async dispatch(packet) { continuation.push(packet); },
  });
  assert.equal(advanced.currentStage, 'release');
  assert.equal(advanced.assignedRole, 'release-coordinator');
  assert.equal(continuation[0].targetInstanceId, 'task-release-coordinator');
});

test('an addressed non-owner is routed only to the workflow-declared capability owner', async () => {
  const dispatched = [];
  const adapter = {
    async resolveRole({ scope: resolvedScope, role }) {
      assert.deepEqual(resolvedScope, scope);
      return endpoint(role);
    },
    async dispatch(packet) { dispatched.push(packet); },
  };
  const entry = await createHumanEntryRuntime(definition(), { ...scope, routerRuntimeId: 'router-b' }, {
    scope,
    capability: 'drafting',
    correlationId: 'corr-draft-a',
    recipient: endpoint('reviewer'),
    references: [{ kind: 'request', ref: 'request://draft-a' }],
  }, adapter);

  assert.equal(entry.disposition, 'routed-to-owner');
  assert.equal(entry.snapshot.currentStage, 'drafting');
  assert.equal(entry.snapshot.assignedRole, 'writer');
  assert.equal(entry.snapshot.assignedInstanceId, 'task-writer');
  assert.deepEqual(dispatched, [{
    targetInstanceId: 'task-writer',
    requiredExecutionRole: 'writer',
    correlationId: 'corr-draft-a',
    stage: 'drafting',
    references: [{ kind: 'request', ref: 'request://draft-a' }],
    scope,
  }]);
});

test('human entry fails closed for undeclared and ambiguous capabilities', async () => {
  const input = {
    scope,
    capability: 'unknown',
    correlationId: 'corr-unknown-a',
    recipient: endpoint('writer'),
    references: [],
  };
  await assert.rejects(
    createHumanEntryRuntime(definition(), { ...scope, routerRuntimeId: 'router-c' }, input),
    ({ code }) => code === 'BLOCKED_ROUTER_ENTRY_CAPABILITY',
  );

  const ambiguous = definition({
    stages: {
      ...definition().stages,
      redraft: { role: 'writer', capability: 'drafting', transitions: {} },
    },
  });
  await assert.rejects(
    createHumanEntryRuntime(ambiguous, { ...scope, routerRuntimeId: 'router-d' }, {
      ...input,
      capability: 'drafting',
    }),
    ({ code }) => code === 'BLOCKED_ROUTER_ENTRY_AMBIGUOUS',
  );
});

test('the same entry mechanism works for a different workflow definition', async () => {
  const devScope = { ...scope, workflowId: 'dev', logicalProjectId: 'profile-a-dev' };
  const devDefinition = {
    source: 'dev.workflow.md',
    scope: devScope,
    initialStage: 'implementation',
    capabilityOwners: { implementation: 'coder', design_review: 'designer-reviewer' },
    stages: {
      implementation: { role: 'coder', capability: 'implementation', transitions: {} },
      design_review: { role: 'designer-reviewer', capability: 'design_review', transitions: {} },
    },
  };
  const entry = await createHumanEntryRuntime(devDefinition, {
    ...devScope,
    routerRuntimeId: 'router-dev',
  }, {
    scope: devScope,
    capability: 'implementation',
    correlationId: 'corr-dev-a',
    recipient: { ...devScope, role: 'coder', instanceId: 'task-coder' },
    references: [{ kind: 'request', ref: 'ticket://example-1' }],
  });

  assert.equal(entry.disposition, 'accepted-by-recipient');
  assert.equal(entry.snapshot.assignedRole, 'coder');
});
