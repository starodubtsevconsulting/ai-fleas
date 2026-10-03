/**
 * Run with node --test personal-governor-onboarding.test.mjs.
 * Passing verifies prompt routing and receipt selection with in-memory data,
 * not host task creation, binding activation, or installed plugin behavior.
 * Effects: none.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { PersonalGovernorOnboarding, personalGovernorInitRequest } from './personal-governor-onboarding.mjs';

function onboarding(receipts) {
  return new PersonalGovernorOnboarding({
    loadAgentBindings: () => ({ loadStatus: 'loaded', agentBindings: {} }),
    findPersonalGovernorReceipts: () => receipts,
  });
}

test('recognizes named Governor initialization from any source chat', () => {
  assert.deepEqual(personalGovernorInitRequest('Initialize Personal Governor for example-human'),
    { humanProfileId: 'example-human' });
  assert.deepEqual(personalGovernorInitRequest('Personal Governor INIT'),
    { humanProfileId: null });
  assert.deepEqual(personalGovernorInitRequest('Please init of Personal Governor for example-human.'),
    { humanProfileId: 'example-human' });
  assert.deepEqual(personalGovernorInitRequest('Initialize Personal Governor for example-human using the GPT Agents controller.'),
    { humanProfileId: 'example-human' });
  assert.equal(onboarding([]).isOnboardingRequest({
    hook_event_name: 'UserPromptSubmit', prompt: 'Initialize Personal Governor for example-human',
  }), true);
});

test('selects the expired pending receipt before an active predecessor', () => {
  const instructions = onboarding([
    { taskId: 'old', status: 'active', humanProfileId: 'example-human', generation: 1 },
    { taskId: 'new', status: 'pending', humanProfileId: 'example-human', generation: 2,
      expiresAt: '2020-01-01T00:00:00Z' },
  ]).buildOnboardingInstructions({ isExplicitInit: true, humanProfileId: 'example-human' });
  assert.match(instructions, /state=pending/);
  assert.match(instructions, /taskId=new/);
  assert.match(instructions, /even if its permit expired/);
  assert.doesNotMatch(instructions, /state=explicit-init-successor/);
});

test('asks only for the human ID when receipts span several humans', () => {
  const instructions = onboarding([
    { taskId: 'one', status: 'active', humanProfileId: 'first', generation: 1 },
    { taskId: 'two', status: 'active', humanProfileId: 'second', generation: 1 },
  ]).buildOnboardingInstructions({ isExplicitInit: true });
  assert.match(instructions, /state=needs-human-profile-id/);
  assert.match(instructions, /Ask only for the exact human profile ID/);
});
