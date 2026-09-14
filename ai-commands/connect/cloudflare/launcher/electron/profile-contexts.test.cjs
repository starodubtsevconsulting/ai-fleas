const assert = require('node:assert/strict');
const test = require('node:test');
const profiles = require('./profile-contexts.cjs');

test('lists only workflows that bind and allow cloudflare', () => {
  const document = {
    name: 'demo',
    commands: [{ id: 'cloudflare', config: 'commands/cloudflare.env' }],
    workflows: [
      { path: 'dev.workflow.md', local_ai: { provider: 'example-model-provider' }, commands: ['cloudflare'] },
      { path: 'docs.workflow.md', commands: ['doc'] },
      { path: '../escape.workflow.md', commands: ['cloudflare'] }
    ]
  };
  assert.deepEqual(profiles.contextsFromProfile('demo', document), [{ profileId: 'demo', workflow: 'dev.workflow.md', providerId: 'example-model-provider' }]);
  assert.deepEqual(profiles.contextsFromProfile('other', document), []);
});

test('selected context replaces identity and clears stale config overrides', () => {
  const env = profiles.contextEnv({ AI_PROFILE_FILE: '/stale', AI_COMMAND_CONFIG_PATH: '/stale-config', CLOUDFLARE_COMMAND_CONF: '/stale-cloudflare', KEEP_ME: 'yes' }, { profileId: 'demo', workflow: 'dev.workflow.md' });
  assert.equal(env.AI_WORK_PROFILE_ID, 'demo');
  assert.equal(env.WORK_PROFILE_ID, 'demo');
  assert.equal(env.AI_FLOW_WORKFLOW, 'dev.workflow.md');
  assert.equal(env.AI_MODEL_PROVIDER_ID, undefined);
  assert.equal(env.KEEP_ME, 'yes');
  assert.equal(env.AI_PROFILE_FILE, undefined);
  assert.equal(env.AI_COMMAND_CONFIG_PATH, undefined);
  assert.equal(env.CLOUDFLARE_COMMAND_CONF, undefined);
});
