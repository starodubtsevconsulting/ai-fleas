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
  assert.ok(primaryRecord.id && path.isAbsolute(primaryRecord.repo_path), `${profile.name}/${workflow.path}: invalid primary project`);
}

console.log(`${profile.name} profile structure: PASS`);
