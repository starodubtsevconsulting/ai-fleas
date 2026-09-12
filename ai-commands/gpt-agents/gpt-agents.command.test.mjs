#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const commandDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(commandDir, '../..');
const portable = parse(fs.readFileSync(path.join(root, 'ai-workflows/dev/agents.yml'), 'utf8'));
const adapter = parse(fs.readFileSync(path.join(root, 'platforms/gpt-agents/workflows/dev/agents.yml'), 'utf8'));
const contract = fs.readFileSync(path.join(commandDir, 'gpt-agents.command.md'), 'utf8');
const systemRole = fs.readFileSync(path.join(root, 'ai-workflows/_common/roles/system.md'), 'utf8');
const systemSchedule = fs.readFileSync(path.join(root, 'ai-workflows/_common/agents/schedules/system-lifecycle-monitor.yml'), 'utf8');
const exampleConfig = parse(fs.readFileSync(path.join(root, 'ai-profile/example/commands-config/gpt-agents/config.yml'), 'utf8'));
const exampleProfile = parse(fs.readFileSync(path.join(root, 'ai-profile/example/example-work-profile.yml'), 'utf8'));
const exampleWorkflow = exampleProfile.workflows.find((workflow) => workflow.path === 'dev.workflow.md');

const portableRoles = [portable.initializer.agentId, ...portable.agents.map((agent) => agent.agentId)];
const adapterRoles = adapter.agents.map((agent) => agent.role);
assert.equal(new Set(portableRoles).size, portableRoles.length, 'portable roles must be unique');
assert.equal(new Set(adapterRoles).size, adapterRoles.length, 'GPT bindings must be unique');
assert.deepEqual([...adapterRoles].sort(), [...portableRoles].sort(), 'portable and GPT roles must map one-to-one');
assert.equal(exampleConfig.schema_version, 'gpt-agents-command-config.v1');
assert.equal(exampleConfig.grouping.project_name_template, '{profile}-{workflow}{suffix}');
assert.equal(exampleConfig.grouping.reuse_requires_recorded_project_id, true);
assert.deepEqual(exampleConfig.binding_state, {
  owner: 'profile',
  path: '.local/gpt-agents/bindings.yml',
  schema_version: 'gpt-agents-binding-state.v1',
});
for (const overrideRole of Object.keys(exampleConfig.role_overrides ?? {})) {
  assert.ok(portableRoles.includes(overrideRole), `unknown example override role: ${overrideRole}`);
}
assert.equal(exampleProfile.system_agent.platform_bindings['gpt-agents'].readiness_token, 'SYSTEM_READY');
assert.equal(exampleProfile.system_agent.platform_bindings['gpt-agents'].title, '⚙️ System');
assert.ok(exampleWorkflow.projects.length > 1, 'a workflow must support a multi-project scope');
assert.match(exampleWorkflow.projects[0].ref, /\/example-service\/project\.yml$/);
assert.deepEqual(exampleProfile.system_agent.schedule, {
  enabled: true,
  every: '10m',
  instruction: '_common/agents/schedules/system-lifecycle-monitor.yml',
});

const nonAdmin = portable.agents.map((agent) => agent.agentId);
assert.deepEqual(nonAdmin, [
  'designer-reviewer', 'judge', 'manager', 'coder', 'command-runner', 'ui-acceptance-tester',
]);
for (const role of portableRoles) {
  const portableAgent = role === portable.initializer.agentId
    ? portable.initializer
    : portable.agents.find((agent) => agent.agentId === role);
  const binding = adapter.agents.find((agent) => agent.role === role);
  assert.ok(binding.title && binding.model && binding.reasoning, `${role} GPT realization is incomplete`);
  assert.equal('readiness_token' in binding, false, `${role} must inherit readiness from portable manifest`);
  assert.equal('lifecycle' in binding, false, `${role} must inherit lifecycle from portable manifest`);
  assert.equal('human_facing' in binding, false, `${role} must inherit human-facing semantics from portable manifest`);
  assert.ok(portableAgent.readinessToken, `${role} portable readiness token is missing`);
  assert.ok(portableAgent.lifecycle, `${role} portable lifecycle is missing`);
  assert.notEqual(portableAgent.humanFacing, undefined, `${role} portable human-facing value is missing`);
  assert.ok(adapter.role_contracts[role], `${role} role contract is missing`);
}

assert.match(contract, /mechanical initialization controller/);
assert.match(contract, /including Admin and Manager, in one host batch/);
assert.match(contract, /Admin is a\s+compatibility role and must not bootstrap, delegate, or orchestrate initialization/);
assert.match(contract, /gpt-agents-binding-state\.v1/);
assert.match(contract, /dispatch all\s+canonical initialization messages concurrently/);
assert.match(contract, /Changes to the roster must come from the portable workflow manifest/);
assert.match(contract, /public GPT role-binding defaults, then supported profile-owned `role_overrides`/);
assert.match(contract, /direct-human-only role such as Judge receives its own binding/);
assert.match(contract, /Never emulate a logical saved project with a custom sidebar section/);
assert.match(contract, /`initialize-system`/);
assert.match(contract, /System remains outside every workflow sidebar section/);
assert.match(contract, /pin the exact System task in the global pinned section/);
assert.match(contract, /Never include System's task ID, routing address, or runtime/);
assert.match(contract, /Workflow initialization is complete.*does not wait for, locate, create, or register\s+System/s);
assert.match(contract, /`watch-system-group/);
assert.match(contract, /Scheduler ID, interval, active\/pending\s+watch scopes/);
assert.match(contract, /Pending scope is normal asynchronous state, not System initialization failure/);
assert.match(contract, /do not create the concrete scheduler on System's behalf/);
assert.match(contract, /System requests the selected platform adapter to create or reconcile exactly one scheduler/);
assert.match(contract, /include that\s+exact path plus `gpt-agents-binding-state\.v1` in both System's initialization message and scheduler prompt/);
assert.match(contract, /must not discover receipts by filename search/);
assert.match(systemRole, /## Human-facing intent map/);
assert.match(systemRole, /Immediately run the same read-only lifecycle and context-health check used by the scheduler/);
assert.match(systemRole, /If `X` is omitted and exactly one group is watched, use that group/);
assert.match(systemRole, /handles only agent\/group monitoring, health, continuity/);
assert.match(systemSchedule, /Manual requests run immediately and never wait\s+for this timer/);
assert.match(contract, /Repeat `--watch-group` for multiple groups/);
assert.match(contract, /Use one scheduler for the complete set/);
assert.match(contract, /Require one pre-existing folder-backed\s+Codex project named `<profile>-<workflow>/);
assert.match(contract, /This command does not create or edit the saved Codex project/);
assert.match(contract, /first folder is primary/);
assert.match(contract, /Logical project.*group.*synonyms/);
assert.match(contract, /Project.*one profile-registered folder inside/);
assert.match(contract, /pre-existing exact folder-backed saved Codex project named for the logical project/);
assert.match(contract, /complete ordered scoped-folder list, then\s+record that binding before any agent creation/);
console.log('gpt-agents command mapping: PASS');
