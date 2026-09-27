import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkflowRuntime } from '../../_common/runtime/workflow-router.mjs';
import { renderWorkflowMap } from '../../_common/runtime/workflow-map.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'dev.workflow-map.json'), 'utf8'));
assert.equal(fs.readFileSync(path.join(root, 'dev.workflow-map.mmd'), 'utf8'), renderWorkflowMap(map));

const scope = { profileId: 'example', workflowId: 'dev', logicalProjectId: 'example-dev', runtimeScopeId: 'run-a' };
const definition = { ...map, scope };
const identity = { ...scope, routerRuntimeId: 'router-a' };
for (const [id, stage] of Object.entries(map.stages)) {
  assert.equal(map.capabilityOwners[stage.capability], stage.role, `owner of ${id}`);
  for (const [event, rule] of Object.entries(stage.transitions)) {
    assert.ok(rule.to === '$resumeStage' || map.stages[rule.to], `${id}/${event} target`);
  }
}

function advance(runtime, event, expectedStage) {
  const from = runtime.snapshot().currentStage;
  const rule = map.stages[from].transitions[event] ?? map.exceptionTransitions[event];
  const references = (rule.requiredReferenceKinds ?? []).map((kind) => ({ kind, ref: `artifact://${kind}` }));
  const state = runtime.transition({ scope, type: event, expectedStage: from, references });
  assert.equal(state.currentStage, expectedStage, `${from}/${event}`);
  return state;
}

const forward = createWorkflowRuntime(definition, identity);
advance(forward, 'target_ready', 'planning');
advance(forward, 'plan_ready', 'implementation');
advance(forward, 'implemented', 'verification');
advance(forward, 'checks_selected', 'test_execution');
advance(forward, 'checks_passed', 'independent_review');
advance(forward, 'ui_not_applicable', 'final_acceptance');
advance(forward, 'accepted_no_delivery', 'closure');
assert.equal(advance(forward, 'not_applicable', 'complete').status, 'completed');

const correction = createWorkflowRuntime(definition, identity, { stage: 'independent_review' });
advance(correction, 'changes_required', 'implementation');
advance(correction, 'implemented', 'verification');
advance(correction, 'checks_selected', 'test_execution');
advance(correction, 'checks_passed', 'independent_review');

const waiting = createWorkflowRuntime(definition, identity, { stage: 'planning' });
assert.equal(advance(waiting, 'human_action_required', 'planning').status, 'waiting-human');

const optional = createWorkflowRuntime(definition, identity, { stage: 'independent_review' });
advance(optional, 'ui_required', 'ui_acceptance');
advance(optional, 'ui_accepted', 'final_acceptance');
advance(optional, 'demo_required', 'demo');
assert.equal(advance(optional, 'human_action_required', 'demo').status, 'waiting-human');
advance(optional, 'demonstrated', 'final_acceptance');
advance(optional, 'delivery_authorized', 'delivery');
advance(optional, 'deployment_dispatched', 'deployment_verification');
advance(optional, 'runtime_verified', 'closure');

const blocked = createWorkflowRuntime(definition, identity, { stage: 'implementation' });
const recovery = advance(blocked, 'blocked', 'recovery');
assert.equal(recovery.resumeStage, 'implementation');
assert.equal(advance(blocked, 'resumed', 'implementation').resumeStage, null);
