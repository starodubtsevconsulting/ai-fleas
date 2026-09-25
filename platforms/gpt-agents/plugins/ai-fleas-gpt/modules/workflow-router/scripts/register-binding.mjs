import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [sessionId, bindingFile] = process.argv.slice(2);
const dataRoot = process.env.PLUGIN_DATA;
if (!sessionId || !bindingFile || !dataRoot) {
  fail('usage: PLUGIN_DATA=<dir> node register-binding.mjs <session-id> <binding.json>');
}

const binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8'));
for (const field of ['role', 'workflowSource']) {
  if (!binding[field]) fail(`binding requires ${field}`);
}
for (const field of ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScopeId']) {
  if (!binding.scope?.[field]) fail(`binding.scope requires ${field}`);
}
if (!Array.isArray(binding.capabilities)) fail('binding.capabilities must be an array');

fs.mkdirSync(dataRoot, { recursive: true });
const registryPath = path.join(dataRoot, 'bindings.json');
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  : { schemaVersion: 2, sessions: {}, workflows: {} };
registry.schemaVersion = 2;
registry.sessions ??= {};
registry.workflows ??= {};
registry.sessions[sessionId] = { ...binding, status: 'active' };

const temporary = `${registryPath}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, registryPath);
process.stdout.write(`${sessionId}\n`);
