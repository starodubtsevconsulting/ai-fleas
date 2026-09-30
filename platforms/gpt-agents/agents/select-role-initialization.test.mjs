import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { selectIndependentRole } from './select-role-initialization.mjs';

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
