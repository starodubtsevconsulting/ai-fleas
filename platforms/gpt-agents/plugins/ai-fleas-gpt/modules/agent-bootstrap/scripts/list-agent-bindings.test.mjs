import assert from 'node:assert/strict';
import { listAgentBindingCandidates } from './list-agent-bindings.mjs';

const registry = {
  instances: {
    'task-dev': {
      agentId: 'coder', generation: 2, status: 'active',
      scope: { profileId: 'example', workflowId: 'dev', logicalProjectId: 'example-dev' },
      initialization: { sources: [{ id: 'private', ref: '/private/path' }] },
    },
    'task-governor': {
      agentId: 'personal-governor', generation: 1, status: 'active',
      scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    },
  },
};

assert.deepEqual(listAgentBindingCandidates(registry, 'profile', 'example'), [{
  taskId: 'task-dev', agentId: 'coder', generation: 2, statusClaim: 'active',
  scope: { profileId: 'example', workflowId: 'dev', logicalProjectId: 'example-dev' },
}]);
assert.deepEqual(listAgentBindingCandidates(registry, 'human', 'example-human').map(({ taskId }) => taskId),
  ['task-governor']);
assert.throws(() => listAgentBindingCandidates(registry, 'profile', '../example'), /FILTER_REQUIRED/);
assert.throws(() => listAgentBindingCandidates({}, 'profile', 'example'), /INVALID_HOST_BINDINGS/);
