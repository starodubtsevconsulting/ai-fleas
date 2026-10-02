/**
 * Purpose: regression checks for lifecycle platform precedence and dispatch boundaries.
 * Caller: developers/verification agents run node platforms/dispatch-plan.test.mjs.
 * Effects: reads the public registry/contracts and uses in-memory configuration;
 * creates no agents or runtime state. A pass proves selection checks, not live dispatch.
 */
import assert from 'node:assert/strict';
import { resolveDispatchPlan, requireAdapter, loadRegistry } from './dispatch-plan.mjs';
import fs from 'node:fs';
import { parse } from 'yaml';
const registry = loadRegistry(new URL('./registry.yml', import.meta.url));
for (const [id, harness, interfaceKind] of [['codex-app', 'codex', 'app'], ['codex-cli', 'codex', 'cli'], ['hermes-app', 'hermes', 'app'], ['hermes-cli', 'hermes', 'cli'], ['pi-cli', 'pi', 'cli']]) {
  const entry = registry.find(p => p.id === id);
  const contract = parse(fs.readFileSync(new URL(entry.contract, new URL('./', import.meta.url)), 'utf8'));
  assert.equal(contract.harness, harness);
  assert.equal(contract.interface, interfaceKind);
}
assert.ok(registry.some(p => p.id === 'hermes-app'));
const base = { platforms: { default: 'codex-app', available: ['codex-app', 'hermes-cli', 'sc'] } };
for (const old of ['gpt', 'hermes', 'gpt-agents']) {
  assert.throws(() => resolveDispatchPlan({ platforms: { default: old, available: [old] } }, {}, registry, { operation: 'single-agent', requestedAgentId: 'admin', declaredAgentIds: ['admin'] }), /UNSUPPORTED/);
}
const single = { operation: 'single-agent', requestedAgentId: 'admin', declaredAgentIds: ['admin', 'coder'] };
const run = (p = base, w = {}, r = single) => resolveDispatchPlan(p, w, registry, r);
const piProfile = { platforms: { default: 'pi-cli', available: ['pi-cli', 'codex-app'] } };
assert.equal(run(piProfile, { model: 'example-openai-model', provider: 'example-openai-provider' }).agents[0].platformId, 'pi-cli');
assert.equal(run(piProfile, { platform: 'codex-app' }).agents[0].platformId, 'codex-app');
const piEntry = registry.find(p => p.id === 'pi-cli');
const piContract = parse(fs.readFileSync(new URL(piEntry.contract, new URL('./', import.meta.url)), 'utf8'));
assert.equal(piContract.initialization, undefined);
assert.equal(piContract.role_overlays, undefined);
assert.ok(!piContract.capabilities.includes('persistent-identity'));
assert.deepEqual(run().agents, [{ agentId: 'admin', platformId: 'codex-app', contract: 'gpt-agents/platform.yml', source: 'profile' }]);
assert.equal(run(base, { platform: 'hermes-cli' }).agents[0].source, 'workflow');
assert.equal(run(base, { platform: 'hermes-cli', agent_overrides: { admin: { platform: 'sc' } } }).agents[0].platformId, 'sc');
assert.equal(run(base, { model: 'example-model', provider: 'example-provider', local_ai: { model: 'other-model', provider: 'other-provider' } }).agents[0].platformId, 'codex-app');
for (const legacy of [{ harness: 'hermes-cli' }, { agent_platform: 'codex-app' }, { agent_platforms: { default: 'codex-app' } }]) {
  assert.throws(() => run({ ...base, ...legacy }), /ALIAS_CONFLICT/);
  assert.throws(() => run(base, legacy), /ALIAS_CONFLICT/);
  assert.throws(() => run(base, { agent_overrides: { admin: legacy } }), /ALIAS_CONFLICT/);
}
assert.throws(() => run({ platforms: { default: 'gpt-agents', available: ['gpt-agents'] } }), /UNREGISTERED|UNKNOWN|UNSUPPORTED/);
assert.equal(run(base, { agent_overrides: { coder: { platform: 'hermes-cli' } } }).agents.length, 1);
assert.throws(() => run({}, {}), /CONFIG_INVALID/);
assert.throws(() => run({ platforms: { available: ['hermes-cli'] } }), /SELECTION_MISSING/);
assert.throws(() => run({ platforms: { default: 'unknown', available: ['hermes-cli'] } }), /UNSUPPORTED/);
assert.throws(() => run({ platforms: { default: 'codex-app', available: ['hermes-cli'] } }), /UNAVAILABLE/);
assert.throws(() => run(base, { platform: 'unknown', agent_overrides: { admin: { platform: 'hermes-cli' } } }), /UNSUPPORTED/);
assert.throws(() => run(base, { agent_overrides: { coder: { platform: '' } } }), /SELECTION_MISSING/);
assert.throws(() => run({ ...base, platform: 'hermes-cli' }), /ALIAS_CONFLICT/);
assert.throws(() => run(base, {}, { ...single, requestedAgentId: 'unknown' }), /UNDECLARED/);
assert.throws(() => run(base, { agent_overrides: { coder: { platform: 'hermes-cli' } } }, { operation: 'full-roster', declaredAgentIds: single.declaredAgentIds }), /MIXED_PLATFORM/);
assert.equal(run(base, {}, { operation: 'full-roster', declaredAgentIds: single.declaredAgentIds }).agents.length, 2);
assert.throws(() => requireAdapter(run(), 'hermes-cli'), /ADAPTER_MISMATCH/);
assert.equal(requireAdapter(run(), 'codex-app').agents.length, 1);
assert.throws(() => run(base, { platforms: { default: 'hermes-cli' } }), /ALIAS_CONFLICT/);
assert.equal(run(base, { agent_overrides: { admin: { platform: 'hermes-cli', model: 'example-model', provider: 'example-provider' } } }).agents[0].platformId, 'hermes-cli');
assert.throws(() => resolveDispatchPlan(base, {}, [...registry, registry[0]], single), /REGISTRY_INVALID/);
assert.throws(() => resolveDispatchPlan(base, {}, [{ id: 'codex-app', contract: '../escape.yml' }], single), /REGISTRY_INVALID/);
for (const contract of ['/absolute/platform.yml', 'gpt-agents\\platform.yml', '']) {
  assert.throws(() => resolveDispatchPlan(base, {}, [{ id: 'codex-app', contract }], single), /REGISTRY_INVALID/);
}
assert.throws(() => run(base, { agent_overrides: [] }), /CONFIG_INVALID/);
assert.throws(() => run(base, { agent_overrides: { unknown: {} } }), /UNKNOWN_AGENT_OVERRIDE/);
assert.throws(() => run(base, {}, { declaredAgentIds: ['admin'] }), /OPERATION_REQUIRED/);
assert.throws(() => run({ platforms: { default: 'codex-app', available: [] } }), /AVAILABLE_INVALID/);
const example = parse(fs.readFileSync(new URL('../ai-profile/example/example-work-profile.yml', import.meta.url), 'utf8'));
const financial = example.workflows.find(w => w.path === 'financial-insights.workflow.md');
const financialManifest = parse(fs.readFileSync(new URL('../ai-workflows/financial-insights/agents.yml', import.meta.url), 'utf8'));
const financialPlan = resolveDispatchPlan(example, financial, registry, {
  operation: 'full-roster', declaredAgentIds: [financialManifest.initializer, ...financialManifest.agents].filter(Boolean).map(r => r.agentId),
});
assert.ok(financialPlan.agents.every(a => a.platformId === 'hermes-app' && a.source === 'workflow'));
requireAdapter(financialPlan, 'hermes-app');
console.log('Lifecycle platform resolution and dispatch: PASS');
