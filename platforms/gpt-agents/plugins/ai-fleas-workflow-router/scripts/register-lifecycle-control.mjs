import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [sessionId, promptFile, expectedReadiness, action = 'initialize'] = process.argv.slice(2);
const dataRoot = process.env.PLUGIN_DATA;
if (!dataRoot || !sessionId || !promptFile || !expectedReadiness) {
  fail('usage: PLUGIN_DATA=<dir> node register-lifecycle-control.mjs <session-id> <prompt-file> <expected-readiness> [action]');
}
if (!/^[A-Z][A-Z0-9_]*_READY$/.test(expectedReadiness)) {
  fail('expected-readiness must be an uppercase *_READY token');
}
if (!/^[a-z][a-z0-9-]*$/.test(action)) fail('action must be lower-case hyphen-case');

const registryPath = path.join(dataRoot, 'bindings.json');
if (!fs.existsSync(registryPath)) fail('workflow Router registry does not exist');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
if (registry.sessions?.[sessionId]?.status !== 'active') fail('session does not have an active Router binding');

const prompt = fs.readFileSync(promptFile, 'utf8');
if (!prompt.trim()) fail('lifecycle prompt must not be empty');
const permit = {
  action,
  expectedReadiness,
  promptSha256: createHash('sha256').update(prompt).digest('hex'),
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
};
const permitFile = path.join(dataRoot, 'lifecycle-controls', `${sessionId}.json`);
fs.mkdirSync(path.dirname(permitFile), { recursive: true });
const temporary = `${permitFile}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(permit)}\n`, { mode: 0o600 });
fs.renameSync(temporary, permitFile);
process.stdout.write(`${sessionId}\n`);
