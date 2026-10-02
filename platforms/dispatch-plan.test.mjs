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
const base = { agent_platforms: { default: 'gpt-agents', available: ['gpt-agents', 'hermes', 'sc'] } };
const single = { operation: 'single-agent', requestedAgentId: 'admin', declaredAgentIds: ['admin', 'coder'] };
const run = (p = base, w = {}, r = single) => resolveDispatchPlan(p, w, registry, r);
assert.deepEqual(run().agents, [{ agentId: 'admin', platformId: 'gpt-agents', contract: 'gpt-agents/platform.yml', source: 'profile' }]);
assert.equal(run(base, { agent_platform: 'hermes' }).agents[0].source, 'workflow');
assert.equal(run(base, { agent_platform: 'hermes', agent_overrides: { admin: { agent_platform: 'sc' } } }).agents[0].platformId, 'sc');
assert.equal(run(base, { harness: 'hermes' }).agents[0].platformId, 'gpt-agents');
assert.equal(run(base, { agent_overrides: { coder: { agent_platform: 'hermes' } } }).agents.length, 1);
assert.throws(() => run({}, {}), /CONFIG_INVALID/);
assert.throws(() => run({ agent_platforms: { available: ['hermes'] } }), /SELECTION_MISSING/);
assert.throws(() => run({ agent_platforms: { default: 'unknown', available: ['hermes'] } }), /UNSUPPORTED/);
assert.throws(() => run({ agent_platforms: { default: 'gpt-agents', available: ['hermes'] } }), /UNAVAILABLE/);
assert.throws(() => run(base, { agent_platform: 'unknown', agent_overrides: { admin: { agent_platform: 'hermes' } } }), /UNSUPPORTED/);
assert.throws(() => run(base, { agent_overrides: { coder: { agent_platform: '' } } }), /SELECTION_MISSING/);
assert.throws(() => run(base, { platform: 'hermes' }), /ALIAS_CONFLICT/);
assert.throws(() => run(base, {}, { ...single, requestedAgentId: 'unknown' }), /UNDECLARED/);
assert.throws(() => run(base, { agent_overrides: { coder: { agent_platform: 'hermes' } } }, { operation: 'full-roster', declaredAgentIds: single.declaredAgentIds }), /MIXED_PLATFORM/);
assert.equal(run(base, {}, { operation: 'full-roster', declaredAgentIds: single.declaredAgentIds }).agents.length, 2);
assert.throws(() => requireAdapter(run(), 'hermes'), /ADAPTER_MISMATCH/);
assert.equal(requireAdapter(run(), 'gpt-agents').agents.length, 1);
assert.throws(() => run(base, { agent_platforms: { default: 'hermes' } }), /ALIAS_CONFLICT/);
assert.throws(() => run(base, { agent_overrides: { coder: { platform: 'hermes' } } }), /ALIAS_CONFLICT/);
assert.throws(() => resolveDispatchPlan(base, {}, [...registry, registry[0]], single), /REGISTRY_INVALID/);
assert.throws(() => resolveDispatchPlan(base, {}, [{ id: 'gpt-agents', contract: '../escape.yml' }], single), /REGISTRY_INVALID/);
assert.throws(() => run(base, { agent_overrides: [] }), /CONFIG_INVALID/);
assert.throws(() => run(base, { agent_overrides: { unknown: {} } }), /UNKNOWN_AGENT_OVERRIDE/);
assert.throws(() => run(base, {}, { declaredAgentIds: ['admin'] }), /OPERATION_REQUIRED/);
assert.throws(() => run({ agent_platforms: { default: 'gpt-agents', available: [] } }), /AVAILABLE_INVALID/);
const example = parse(fs.readFileSync(new URL('../ai-profile/example/example-work-profile.yml', import.meta.url), 'utf8'));
const financial = example.workflows.find(w => w.path === 'financial-insights.workflow.md');
const financialManifest = parse(fs.readFileSync(new URL('../ai-workflows/financial-insights/agents.yml', import.meta.url), 'utf8'));
const financialPlan = resolveDispatchPlan(example, financial, registry, {
  operation: 'full-roster', declaredAgentIds: [financialManifest.initializer, ...financialManifest.agents].filter(Boolean).map(r => r.agentId),
});
assert.ok(financialPlan.agents.every(a => a.platformId === 'hermes' && a.source === 'workflow'));
requireAdapter(financialPlan, 'hermes');
console.log('Lifecycle platform resolution and dispatch: PASS');
