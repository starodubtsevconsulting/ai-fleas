import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function validateSource(source) {
  return source && typeof source.id === 'string' && source.id
    && typeof source.ref === 'string' && source.ref;
}

const [sessionId, bindingFile, promptFile] = process.argv.slice(2);
const dataRoot = process.env.PLUGIN_DATA;
if (!sessionId || !bindingFile || !promptFile || !dataRoot) {
  fail('usage: PLUGIN_DATA=<dir> node register-agent-initialization.mjs <session-id> <binding.json> <prompt.txt>');
}

const binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8'));
const prompt = fs.readFileSync(promptFile, 'utf8').trimEnd();
if (!prompt) fail('initialization prompt must not be empty');
if (binding.platformAdapter !== 'gpt-agents') fail('binding.platformAdapter must be gpt-agents');
if (!binding.agentId || typeof binding.agentId !== 'string') fail('binding requires agentId');
if (!Number.isInteger(binding.generation) || binding.generation < 1) fail('binding requires a positive integer generation');
if (!binding.scope?.kind || typeof binding.scope.kind !== 'string') fail('binding.scope requires kind');
if (!binding.initialization?.readinessToken) fail('binding.initialization requires readinessToken');
if (!Array.isArray(binding.initialization.sources) || !binding.initialization.sources.length
  || binding.initialization.sources.some((source) => !validateSource(source))) {
  fail('binding.initialization.sources must contain at least one {id,ref} source');
}

const registryPath = path.join(dataRoot, 'agent-bindings.json');
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  : { schemaVersion: 1, instances: {} };
registry.schemaVersion = 1;
registry.instances ??= {};
if (registry.instances[sessionId]?.status === 'active') {
  fail(`session ${sessionId} already has an active agent binding`);
}

const now = new Date();
const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
registry.instances[sessionId] = {
  ...binding,
  status: 'pending',
  initialization: {
    ...binding.initialization,
    promptSha256: createHash('sha256').update(prompt).digest('hex'),
    expiresAt,
  },
  registeredAt: now.toISOString(),
};
atomicWrite(registryPath, registry);
process.stdout.write(`${JSON.stringify({ sessionId, status: 'pending', expiresAt })}\n`);
