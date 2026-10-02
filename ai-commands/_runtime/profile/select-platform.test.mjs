/**
 * Purpose: test workflow-context command platform activation without filesystem fixtures.
 * Caller: node ai-commands/_runtime/profile/select-platform.test.mjs.
 * Effects: in-memory assertions only; proves selection boundaries, not command effects
 * or host task identity. No agent role is inferred from an instance label.
 */
import assert from 'node:assert/strict';
import { selectPlatform } from './select-platform.mjs';
const registry = ['codex-app', 'codex-cli', 'hermes-app', 'hermes-cli'].map(id => ({ id, contract: id + '/platform.yml' }));
const base = { platforms: { default: 'codex-app', available: registry.map(p => p.id) }, workflows: [{ path: 'dev.workflow.md' }] };
const select = (profile = base, expected) => selectPlatform(profile, 'dev.workflow.md', registry, expected);
assert.equal(select(), 'codex-app');
const overridden = { ...base, workflows: [{ path: 'dev.workflow.md', platform: 'hermes-app' }] };
assert.equal(select(overridden, 'hermes-app'), 'hermes-app');
assert.throws(() => select(overridden, 'codex-app'), /REQUEST_MISMATCH/);
assert.throws(() => select({ ...base, agent_platforms: {} }), /ALIAS_CONFLICT/);
assert.throws(() => select({ ...base, workflows: [{ path: 'dev.workflow.md', agent_overrides: { coder: { platform: 'hermes-cli' } } }] }), /AGENT_IDENTITY_REQUIRED/);
assert.equal(select({ ...base, workflows: [{ path: 'dev.workflow.md', agent_overrides: { coder: { platform: 'codex-app', model: 'example-model' } } }] }), 'codex-app');
assert.throws(() => select({ ...base, workflows: [{ path: 'dev.workflow.md', platform: 'hermes' }] }), /UNSUPPORTED/);
console.log('Workflow-context platform activation: PASS');
