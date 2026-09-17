#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const profileFile = path.resolve(process.argv[2]);
const profileDir = path.dirname(profileFile);
const profile = parse(fs.readFileSync(profileFile, 'utf8'));
const requiredPlatforms = ['gpt-agents', 'hermes', 'sc'];

assert.equal(profile.version, 3, `${profile.name}: profile version`);
assert.equal(profile.agent_platforms.default, 'gpt-agents', `${profile.name}: default platform`);
assert.deepEqual(profile.agent_platforms.available, requiredPlatforms, `${profile.name}: available platforms`);
assert.equal(profile.system_agent.scope, 'system', `${profile.name}: System scope`);
assert.equal(profile.system_agent.cardinality, 'one-per-platform', `${profile.name}: System cardinality`);
assert.equal(profile.system_agent.schedule.every, '10m', `${profile.name}: System interval`);
assert.equal(profile.system_agent.platform_bindings['gpt-agents'].readiness_token, 'SYSTEM_READY');

const enabledWorkflowIds = new Set((profile.workflows ?? []).map(({ path: workflowPath }) => workflowPath.replace(/\.workflow\.md$/, '')));
const profileCommandIds = new Set((profile.commands ?? []).map(({ id }) => id));

const profileAgentIds = new Set();
for (const profileAgent of profile.profile_agents ?? []) {
  assert.ok(profileAgent.id, `${profile.name}: profile agent id`);
  assert.equal(profileAgent.scope, 'profile', `${profile.name}/${profileAgent.id}: profile agent scope`);
  assert.ok(!profileAgentIds.has(profileAgent.id), `${profile.name}: duplicate profile agent ${profileAgent.id}`);
  profileAgentIds.add(profileAgent.id);

  const configPath = path.resolve(profileDir, profileAgent.config);
  assert.ok(fs.existsSync(configPath), `${profile.name}/${profileAgent.id}: profile agent config does not exist`);
  const binding = parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(binding.scope, 'profile', `${profile.name}/${profileAgent.id}: binding scope`);
  assert.equal(binding.profile?.id, profile.name, `${profile.name}/${profileAgent.id}: binding profile`);
  assert.equal(binding.agentId, profileAgent.id, `${profile.name}/${profileAgent.id}: binding agent id`);
  assert.equal(binding.platformBindings, undefined, `${profile.name}/${profileAgent.id}: platform realization belongs to platform role overlays`);

  for (const workflowId of binding.workflows ?? []) {
    assert.ok(enabledWorkflowIds.has(workflowId), `${profile.name}/${profileAgent.id}: workflow ${workflowId} is outside the profile binding`);
  }
  for (const commandId of binding.commands ?? []) {
    assert.ok(profileCommandIds.has(commandId), `${profile.name}/${profileAgent.id}: command ${commandId} is not profile-authorized`);
  }
  for (const goal of binding.goals ?? []) {
    for (const workflowId of goal.workflows ?? []) {
      assert.ok((binding.workflows ?? []).includes(workflowId), `${profile.name}/${profileAgent.id}/${goal.id}: goal workflow ${workflowId} is outside Governor scope`);
    }
  }
}

const gptCommand = profile.commands.find(({ id }) => id === 'gpt-agents');
assert.ok(gptCommand, `${profile.name}: gpt-agents command binding`);
const gptConfig = parse(fs.readFileSync(path.resolve(profileDir, gptCommand.config), 'utf8'));
assert.deepEqual(gptConfig.binding_state, {
  owner: 'profile',
  path: '.local/gpt-agents/bindings.yml',
  schema_version: 'gpt-agents-binding-state.v1',
}, `${profile.name}: binding-state contract`);

for (const workflow of profile.workflows) {
  assert.ok(workflow.projects?.length, `${profile.name}/${workflow.path}: primary project is missing`);
  const primary = path.resolve(profileDir, workflow.projects[0].ref);
  assert.ok(fs.existsSync(primary), `${profile.name}/${workflow.path}: primary project record does not exist`);
  const primaryRecord = parse(fs.readFileSync(primary, 'utf8'));
  const repoPath = String(primaryRecord.repo_path || '');
  const portableHomePath = repoPath === '~' || (repoPath.startsWith('~/') && !repoPath.split('/').includes('..'));
  assert.ok(primaryRecord.id && (path.isAbsolute(repoPath) || portableHomePath), `${profile.name}/${workflow.path}: invalid primary project`);

  if (workflow.path !== 'writing.workflow.md') continue;

  const scope = `${profile.name}/writing`;
  const registeredProjects = new Set(workflow.projects.map(({ ref }) => ref));
  const articleRef = workflow.article_store?.project_ref;
  assert.ok(articleRef && registeredProjects.has(articleRef), `${scope}: article store must reference a registered project`);
  assert.equal(workflow.article_store.format, 'markdown', `${scope}: article store format`);
  const articleProject = parse(fs.readFileSync(path.resolve(profileDir, articleRef), 'utf8'));
  assert.ok(articleProject.storage_path, `${scope}: article store local path`);

  if (workflow.review_preferences) {
    const review = workflow.review_preferences;
    if (review.default_template !== undefined) {
      assert.ok(typeof review.default_template === 'string' && review.default_template.length > 0,
        `${scope}: invalid review default template`);
    }
    if (review.method_emphasis !== undefined) {
      assert.ok(review.method_emphasis && typeof review.method_emphasis === 'object' &&
        !Array.isArray(review.method_emphasis) && Object.keys(review.method_emphasis).length > 0,
        `${scope}: invalid review method emphasis`);
    }
    for (const [method, emphasis] of Object.entries(review.method_emphasis ?? {})) {
      assert.ok(['high', 'normal', 'low'].includes(emphasis),
        `${scope}: invalid review emphasis for ${method}`);
    }
    if (review.listen_through !== undefined) {
      const listen = review.listen_through;
      assert.equal(typeof listen.enabled, 'boolean', `${scope}: invalid listen-through enabled value`);
      assert.equal(listen.command, 'tts', `${scope}: unsupported listen-through command`);
      assert.ok(workflow.commands?.includes(listen.command), `${scope}: listen-through command is not enabled`);
      assert.ok(profileCommandIds.has(listen.command), `${scope}: listen-through command is not profile-bound`);
      assert.ok(typeof listen.voice_profile === 'string' && listen.voice_profile.length > 0,
        `${scope}: invalid listen-through voice profile`);
      assert.match(listen.voice_profile, /^[a-z][a-z0-9-]*$/,
        `${scope}: unsafe listen-through voice profile`);
      assert.ok(fs.existsSync(path.resolve(profileDir, profile.ai_commands_root,
        'content/tts/voice-profiles', `${listen.voice_profile}.json`)),
      `${scope}: listen-through voice profile is missing`);
      assert.equal(typeof listen.autoplay, 'boolean', `${scope}: invalid listen-through autoplay value`);
      if (listen.online_synthesis !== undefined) {
        const online = listen.online_synthesis;
        assert.ok(online && typeof online === 'object' && !Array.isArray(online),
          `${scope}: invalid online synthesis preference`);
        assert.ok(typeof online.service === 'string' && /^[a-z0-9.-]+$/.test(online.service),
          `${scope}: invalid online synthesis service`);
        assert.equal(typeof online.default_for_publication_intended_articles, 'boolean',
          `${scope}: invalid online synthesis default`);
      }
    }
  }

  for (const binding of [...(workflow.editors ?? []), ...(workflow.destinations ?? [])]) {
    assert.ok(workflow.commands?.includes(binding.command), `${scope}/${binding.id}: command is not enabled`);
    const command = profile.commands.find(({ id }) => id === binding.command);
    assert.ok(command?.config && fs.existsSync(path.resolve(profileDir, command.config)), `${scope}/${binding.id}: profile command config is missing`);
    assert.ok(binding.config && fs.existsSync(path.resolve(profileDir, binding.config)), `${scope}/${binding.id}: workflow config is missing`);
    const override = parse(fs.readFileSync(path.resolve(profileDir, binding.config), 'utf8'));
    const boundArticleRef = override.vault_project_ref ?? override.archive_project_ref;
    assert.equal(boundArticleRef, articleRef, `${scope}/${binding.id}: project does not match the article store`);
    if (binding.release_policy) {
      const policy = binding.release_policy;
      assert.ok((workflow.destinations ?? []).includes(binding), `${scope}/${binding.id}: release policy belongs to a destination`);
      assert.ok(Number.isInteger(policy.max_posts_per_local_day) && policy.max_posts_per_local_day > 0,
        `${scope}/${binding.id}: release daily cap must be a positive integer`);
      assert.ok(typeof policy.time_zone === 'string' && policy.time_zone.length > 0,
        `${scope}/${binding.id}: release time zone is missing`);
      assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: policy.time_zone }),
        `${scope}/${binding.id}: invalid release time zone`);
      if (policy.target_interval_days !== undefined) {
        assert.ok(Number.isInteger(policy.target_interval_days) && policy.target_interval_days > 0,
          `${scope}/${binding.id}: release target interval must be a positive integer`);
      }
    }
    if (binding.id === 'obsidian') {
      assert.ok(override.vault_name, `${scope}/obsidian: vault name is missing`);
    }
    if (binding.id === 'medium') {
      assert.equal(binding.mode, 'draft-only', `${scope}/medium: workflow mode`);
      assert.equal(override.mode, 'draft-only', `${scope}/medium: command mode`);
      assert.match(override.account_profile_url ?? '', /^https:\/\/medium\.com\/@[^/]+$/, `${scope}/medium: account profile URL`);
    }
  }
}

console.log(`${profile.name} profile structure: PASS`);
