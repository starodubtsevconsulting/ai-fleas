#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const profileRoot = path.dirname(fileURLToPath(import.meta.url));

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

function stable(value) {
  return JSON.stringify(value);
}

const human = readYaml(path.join(profileRoot, 'humans/jonathan-example/profile.yml'));
const governor = readYaml(path.join(profileRoot, 'humans/jonathan-example/governor.yml'));
const legacyExampleGovernor = readYaml(path.join(profileRoot, 'example/profile-governor.example.yml'));
const workProfile = readYaml(path.join(profileRoot, 'example/example-work-profile.yml'));

assert.equal(human.schemaVersion, 'human-profile.v1');
assert.equal(human.governor?.config, 'governor.yml');
assert.ok(Array.isArray(human.authorizedProfiles), 'human profile authorization must be a list');
assert.ok(Array.isArray(human.authorizedWorkflows), 'human workflow authorization must be a list');

const authorizedProfileIds = new Set();
for (const profile of human.authorizedProfiles) {
  assert.equal(typeof profile?.id, 'string', 'every authorized profile must have an id');
  assert.notEqual(profile.id, '*', 'profile wildcard authorization is forbidden');
  authorizedProfileIds.add(profile.id);
}

for (const workflow of human.authorizedWorkflows) {
  assert.equal(typeof workflow?.profile, 'string', 'every workflow must be profile-qualified');
  assert.equal(typeof workflow?.id, 'string', 'every workflow must have an id');
  assert.equal(typeof workflow?.path, 'string', 'every workflow must have a path');
  assert.notEqual(workflow.profile, '*', 'profile wildcards are forbidden');
  assert.notEqual(workflow.id, '*', 'workflow wildcards are forbidden');
  assert.equal(workflow.path, `${workflow.id}.workflow.md`, `workflow path must match id: ${workflow.id}`);
  assert.ok(
    authorizedProfileIds.has(workflow.profile),
    `workflow ${workflow.profile}/${workflow.id} references an unauthorized profile`,
  );
}

const configuredExampleWorkflows = workProfile.workflows.map(({ path: workflowPath }) => ({
  profile: workProfile.name,
  id: workflowPath.replace(/\.workflow\.md$/, ''),
  path: workflowPath,
}));
const authorizedExampleWorkflows = human.authorizedWorkflows.filter(
  ({ profile }) => profile === workProfile.name,
);
assert.equal(
  stable(authorizedExampleWorkflows),
  stable(configuredExampleWorkflows),
  'the human allowlist must enumerate every configured example workflow',
);

assert.ok(
  human.authorizedProfiles.some(({ id }) => id === 'example-client') &&
    human.authorizedWorkflows.every(({ profile }) => profile !== 'example-client'),
  'the example must demonstrate that profile access does not imply workflow access',
);

for (const binding of [governor, legacyExampleGovernor]) {
  assert.equal(binding.profiles, undefined, 'Governor binding must not own profile authorization');
  assert.equal(binding.workflows, undefined, 'Governor binding must not own workflow authorization');
}

console.log('Human-owned profile and workflow access example: PASS');
