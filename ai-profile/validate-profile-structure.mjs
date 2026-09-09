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
