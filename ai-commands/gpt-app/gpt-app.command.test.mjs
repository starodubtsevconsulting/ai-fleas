#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const commandDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(commandDir, '../..');
const portable = parse(fs.readFileSync(path.join(root, 'ai-workflows/dev/agents.yml'), 'utf8'));
const adapter = parse(fs.readFileSync(path.join(root, 'platforms/gpt-app/workflows/dev/agents.yml'), 'utf8'));
const contract = fs.readFileSync(path.join(commandDir, 'gpt-app.command.md'), 'utf8');
const exampleConfig = parse(fs.readFileSync(path.join(root, 'ai-profile/example/commands-config/gpt-app/config.yml'), 'utf8'));

const portableRoles = [portable.initializer.agentId, ...portable.agents.map((agent) => agent.agentId)];
const adapterRoles = adapter.agents.map((agent) => agent.role);
assert.equal(new Set(portableRoles).size, portableRoles.length, 'portable roles must be unique');
assert.equal(new Set(adapterRoles).size, adapterRoles.length, 'GPT bindings must be unique');
assert.deepEqual([...adapterRoles].sort(), [...portableRoles].sort(), 'portable and GPT roles must map one-to-one');
assert.equal(exampleConfig.schema_version, 'gpt-app-command-config.v1');
assert.equal(exampleConfig.grouping.section_name_template, '{profile}-{workflow}{suffix}');
assert.equal(exampleConfig.grouping.reuse_requires_recorded_section_id, true);
assert.deepEqual(Object.keys(exampleConfig.role_overrides).sort(), [...portableRoles].sort(), 'example overrides must reference only known roles');

const nonAdmin = portable.agents.map((agent) => agent.agentId);
assert.deepEqual(nonAdmin, [
  'designer-reviewer', 'judge', 'manager', 'coder', 'command-runner', 'ui-acceptance-tester',
]);
for (const role of portableRoles) {
  const portableAgent = role === portable.initializer.agentId
    ? portable.initializer
    : portable.agents.find((agent) => agent.agentId === role);
  const binding = adapter.agents.find((agent) => agent.role === role);
  assert.equal(binding.readiness_token, portableAgent.readinessToken, `${role} readiness token must agree`);
  assert.ok(binding.title && binding.model && binding.reasoning && binding.lifecycle, `${role} binding is incomplete`);
  assert.ok(adapter.role_contracts[role], `${role} role contract is missing`);
}

assert.match(contract, /Bind the authorized calling task as `admin`; do not create a second Admin/);
assert.match(contract, /Manager creates exactly one task for each remaining selected role/);
assert.match(contract, /Changes to that list must come from\s+the portable workflow manifest/);
assert.match(contract, /public GPT role-binding defaults, then supported profile-owned `role_overrides`/);
assert.match(contract, /direct-human-only role such as Judge receives its own binding/);
assert.match(contract, /matching sidebar-section name as identity/);
console.log('gpt-app command mapping: PASS');
