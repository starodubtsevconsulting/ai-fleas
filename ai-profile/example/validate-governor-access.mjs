#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));

function readYaml(name) {
  return YAML.parse(fs.readFileSync(path.join(here, name), 'utf8'));
}

function stable(value) {
  return JSON.stringify(value);
}

function normalizeProfiles(profiles) {
  assert.ok(Array.isArray(profiles), 'profile authorization must be a list');
  return profiles.map((profile) => {
    assert.equal(typeof profile?.id, 'string', 'every authorized profile must have an id');
    assert.notEqual(profile.id, '*', 'profile wildcard authorization is forbidden');
    return profile;
  });
}

function normalizeWorkflows(workflows) {
  assert.ok(Array.isArray(workflows), 'workflow authorization must be a list');
  return workflows.map((workflow) => {
    assert.equal(typeof workflow?.profile, 'string', 'every workflow must be profile-qualified');
    assert.equal(typeof workflow?.id, 'string', 'every workflow must have an id');
    assert.equal(typeof workflow?.path, 'string', 'every workflow must have a path');
    assert.notEqual(workflow.profile, '*', 'profile wildcards are forbidden');
    assert.notEqual(workflow.id, '*', 'workflow wildcards are forbidden');
    assert.equal(workflow.path, `${workflow.id}.workflow.md`, `workflow path must match id: ${workflow.id}`);
    return workflow;
  });
}

const human = readYaml('profile-human.example.yml');
const governor = readYaml('profile-governor.example.yml');
const workProfile = readYaml('example-work-profile.yml');

assert.equal(human.schemaVersion, 'human-profile.v1');
assert.equal(human.governor?.config, 'profile-governor.example.yml');

const humanProfiles = normalizeProfiles(human.authorizedProfiles);
const governorProfiles = normalizeProfiles(governor.profiles);
assert.equal(stable(governorProfiles), stable(humanProfiles), 'Governor profiles must mirror the human allowlist');

const humanWorkflows = normalizeWorkflows(human.authorizedWorkflows);
const governorWorkflows = normalizeWorkflows(governor.workflows);
assert.equal(stable(governorWorkflows), stable(humanWorkflows), 'Governor workflows must mirror the human allowlist');

const authorizedProfileIds = new Set(humanProfiles.map(({ id }) => id));
for (const workflow of humanWorkflows) {
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
const authorizedExampleWorkflows = humanWorkflows.filter(({ profile }) => profile === workProfile.name);
assert.equal(
  stable(authorizedExampleWorkflows),
  stable(configuredExampleWorkflows),
  'the example profile workflow allowlist must enumerate every configured example workflow',
);

assert.ok(
  humanProfiles.some(({ id }) => id === 'example-client') &&
    humanWorkflows.every(({ profile }) => profile !== 'example-client'),
  'the example must demonstrate that profile access does not imply workflow access',
);

console.log('Governor profile and workflow access example: PASS');
