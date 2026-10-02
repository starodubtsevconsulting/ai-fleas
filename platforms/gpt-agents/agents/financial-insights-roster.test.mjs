/**
 * Purpose: check the portable Financial Insights Admin and platform realizations.
 * Caller: verification agents run node platforms/gpt-agents/agents/financial-insights-roster.test.mjs.
 * Inputs/output: checked-in fictional/public contracts; success exits zero.
 * Effects: reads files and validates in-memory selection, with no task creation,
 * bindings, runtime state, payments, or financial record writes. Passing proves
 * declaration/preflight compatibility, not actual Admin readiness or host reuse.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadRegistry } from '../../dispatch-plan.mjs';
import { selectLifecycleRole, selectLifecycleRoster } from './select-role-initialization.mjs';

const readYaml = relative => parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const manifest = readYaml('../../../ai-workflows/financial-insights/agents.yml');
const adapter = readYaml('../workflows/financial-insights/agents.yml');
const hermes = readYaml('../../hermes/workflows/financial-insights/agents.yml');
const registry = loadRegistry(new URL('../../registry.yml', import.meta.url));
const roles = [manifest.initializer, ...manifest.agents];
assert.deepEqual(roles.map(role => role.agentId),
  ['admin', 'financial-analyst', 'records-bookkeeping', 'financial-reviewer']);
assert.equal(roles.filter(role => role.agentId === 'admin').length, 1);
assert.equal(manifest.initializer.roleDefinition, '../_common/roles/admin.md');
assert.equal(manifest.initializer.lifecycle, 'persistent-control');
assert.equal(manifest.initializer.humanFacing, 'human-owned');
assert.equal(manifest.initializer.communicationMode, 'direct-human-administration-only');
assert.equal(manifest.initializer.readinessToken, 'ADMIN_READY');
assert.equal(manifest.initializer.schedule.enabled, false);
assert.equal(manifest.platform, undefined);
assert.equal(manifest.agent_platform, undefined);
for (const role of roles) assert.equal(role.platform, undefined);
assert.equal(adapter.workflow_runtime, undefined);
assert.deepEqual(hermes.bindings.map(binding => binding.role), roles.map(role => role.agentId));
const manifestDir = new URL('../../../ai-workflows/financial-insights/', import.meta.url);
const adapterDir = new URL('../workflows/financial-insights/', import.meta.url);
for (const role of roles) {
  const portableContract = fileURLToPath(new URL(role.roleDefinition, manifestDir));
  const realizedContract = fileURLToPath(new URL(adapter.role_contracts[role.agentId], adapterDir));
  assert.equal(realizedContract, portableContract);
  assert.equal(fs.existsSync(realizedContract), true);
}
const profile = { platforms: { default: 'codex-app', available: ['codex-app', 'hermes-app'] } };
const admin = selectLifecycleRole(profile, {}, registry, manifest, adapter, 'admin');
assert.equal(admin.agentId, 'admin');
assert.equal(admin.readinessToken, 'ADMIN_READY');
assert.equal(admin.platformId, 'codex-app');
const roster = selectLifecycleRoster(profile, {}, registry, manifest, adapter);
assert.equal(roster.agents.length, 4);
assert.equal(roster.agents.filter(role => role.agentId === 'admin').length, 1);
assert.throws(() => selectLifecycleRole(profile, {}, registry,
  { ...manifest, initializer: undefined }, adapter, 'admin'), /REQUESTED_AGENT_UNDECLARED/);
assert.throws(() => selectLifecycleRole(profile, { platform: 'hermes-app' }, registry,
  manifest, adapter, 'admin'), /ADAPTER_MISMATCH/);
assert.throws(() => selectLifecycleRoster(profile, {}, registry, manifest,
  { ...adapter, role_endpoints: [...adapter.role_endpoints, adapter.role_endpoints[0]] }), /ROSTER_ADAPTER_MISMATCH/);
console.log('Financial Insights Admin declaration and roster preflight: PASS');
