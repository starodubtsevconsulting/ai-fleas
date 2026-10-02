/**
 * Purpose: verify GPT independent-role checks and exact Admin-only selection.
 * Caller: developers/verification agents run this file with node.
 * Effects: reads public fixtures and runs the selector CLI as a child process;
 * creates no chats, bindings, or schedules. This checks preflight, not live initialization.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { selectIndependentRole, selectLifecycleRole, selectLifecycleRoster } from './select-role-initialization.mjs';
import { loadRegistry } from '../../dispatch-plan.mjs';
import { execFileSync } from 'node:child_process';

const manifest = parse(fs.readFileSync(fileURLToPath(new URL('../../../ai-workflows/dev/agents.yml', import.meta.url)), 'utf8'));
const adapter = parse(fs.readFileSync(fileURLToPath(new URL('../workflows/dev/agents.yml', import.meta.url)), 'utf8'));

const smoke = selectIndependentRole(manifest, adapter, 'smoke-tester');
assert.equal(smoke.readinessToken, 'SMOKE_TESTER_READY');
assert.equal(smoke.endpoint.role, 'smoke-tester');
assert.equal(smoke.schedule.every, '24h');
assert.throws(() => selectIndependentRole(manifest, adapter, 'manager'), /ROLE_NOT_INDEPENDENT/);
assert.throws(() => selectIndependentRole(manifest, adapter, 'coder'), /ROLE_NOT_INDEPENDENT/);
assert.throws(() => selectIndependentRole(manifest, adapter, 'unknown'), /ROLE_NOT_INDEPENDENT/);
assert.throws(() => selectIndependentRole(manifest, { ...adapter, role_endpoints: [] }, 'smoke-tester'), /ROLE_ENDPOINT_MISMATCH/);
console.log('Independent GPT role selection: PASS');
const registry = loadRegistry(new URL('../../registry.yml', import.meta.url));
const profile = { agent_platforms: { default: 'gpt-agents', available: ['gpt-agents', 'hermes'] } };
const admin = selectLifecycleRole(profile, { agent_overrides: { coder: { agent_platform: 'hermes' } } }, registry, manifest, adapter, 'admin');
assert.equal(admin.agentId, 'admin');
assert.equal(admin.platformId, 'gpt-agents');
assert.equal(admin.readinessToken, 'ADMIN_READY');
assert.throws(() => selectLifecycleRole(profile, { agent_platform: 'hermes' }, registry, manifest, adapter, 'admin'), /ADAPTER_MISMATCH/);
console.log('GPT Admin-only lifecycle selection: PASS');
const cli = execFileSync(process.execPath, [fileURLToPath(new URL('./select-role-initialization.mjs', import.meta.url)),
  fileURLToPath(new URL('../../../ai-workflows/dev/agents.yml', import.meta.url)),
  fileURLToPath(new URL('../workflows/dev/agents.yml', import.meta.url)), 'admin',
  fileURLToPath(new URL('../../../ai-profile/example/example-work-profile.yml', import.meta.url)), 'dev',
  fileURLToPath(new URL('../../registry.yml', import.meta.url))], { encoding: 'utf8' });
assert.equal(JSON.parse(cli).agentId, 'admin');
assert.equal(JSON.parse(cli).platformId, 'gpt-agents');
assert.equal(selectLifecycleRoster(profile, {}, registry, manifest, adapter).agents.length,
  manifest.agents.length + 1);
assert.throws(() => selectLifecycleRoster(profile, { agent_overrides: { coder: { agent_platform: 'hermes' } } }, registry, manifest, adapter), /MIXED_PLATFORM/);
assert.throws(() => selectLifecycleRoster(profile, { agent_platform: 'hermes' }, registry, manifest, adapter), /ADAPTER_MISMATCH/);
const rosterCli = execFileSync(process.execPath, [fileURLToPath(new URL('./select-role-initialization.mjs', import.meta.url)),
  fileURLToPath(new URL('../../../ai-workflows/dev/agents.yml', import.meta.url)),
  fileURLToPath(new URL('../workflows/dev/agents.yml', import.meta.url)), 'full-roster',
  fileURLToPath(new URL('../../../ai-profile/example/example-work-profile.yml', import.meta.url)), 'dev',
  fileURLToPath(new URL('../../registry.yml', import.meta.url))], { encoding: 'utf8' });
assert.equal(JSON.parse(rosterCli).operation, 'full-roster');
assert.equal(JSON.parse(rosterCli).agents.length, manifest.agents.length + 1);
