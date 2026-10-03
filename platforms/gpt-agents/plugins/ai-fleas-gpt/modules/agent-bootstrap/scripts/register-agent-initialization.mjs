/** Explicit controller/initializer binding transaction, not an automatic task creator.
 * Called by native controllers through registerAgentInitialization or explicitly
 * by the queue CLI with session ID, binding/prompt files and PLUGIN_DATA root.
 * The imported API takes binding/prompt values without intermediary files and
 * returns diagnostics plus an in-memory rollback receipt (never printed by CLI).
 * Effects: validates and writes the exact host binding and queued initialization receipt.
 * Only the codex-app platform is accepted; command and directory names remain gpt-agents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { withGovernorRegistryLock } from './governor-registry-lock.mjs';

function fail(message) {
  throw new Error(message);
}

function atomicWrite(file, value, io) {
  io.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  io.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  io.renameSync(temporary, file);
}

function validateSource(source) {
  return source && typeof source.id === 'string' && source.id
    && typeof source.ref === 'string' && source.ref;
}

export function registerAgentInitialization({sessionId, binding, prompt: inputPrompt, dataRoot}, {fs: io = fs, now = new Date()} = {}) {
  if (!sessionId || typeof sessionId !== 'string' || !dataRoot || typeof dataRoot !== 'string') fail('sessionId and dataRoot are required');
  if (!binding || typeof inputPrompt !== 'string') fail('binding and prompt are required');
  const prompt = inputPrompt.trimEnd();
  if (!prompt) fail('initialization prompt must not be empty');
  if (binding.platformAdapter !== 'codex-app') fail('binding.platformAdapter must be codex-app');
  if (!binding.agentId || typeof binding.agentId !== 'string') fail('binding requires agentId');
  if (!Number.isInteger(binding.generation) || binding.generation < 1) fail('binding requires a positive integer generation');
  if (!binding.scope?.kind || typeof binding.scope.kind !== 'string') fail('binding.scope requires kind');
  if (!binding.initialization?.readinessToken) fail('binding.initialization requires readinessToken');
  if (!Array.isArray(binding.initialization.sources) || !binding.initialization.sources.length
    || binding.initialization.sources.some((source) => !validateSource(source))) {
    fail('binding.initialization.sources must contain at least one {id,ref} source');
  }

  const registryPath = path.join(dataRoot, 'agent-bindings.json');
  const register = () => {
    const registry = io.existsSync(registryPath)
      ? JSON.parse(io.readFileSync(registryPath, 'utf8'))
      : { schemaVersion: 1, instances: {} };
    registry.schemaVersion = 1;
    registry.instances ??= {};
    const previousBinding = Object.hasOwn(registry.instances, sessionId) ? structuredClone(registry.instances[sessionId]) : null;
    if (registry.instances[sessionId]?.status === 'active') {
      fail(`session ${sessionId} already has an active agent binding`);
    }
    if (binding.agentId === 'personal-governor') {
      const others = Object.entries(registry.instances).filter(([id, item]) =>
        id !== sessionId && item?.agentId === 'personal-governor' &&
        item.scope?.humanProfileId === binding.scope?.humanProfileId &&
        ['active', 'pending'].includes(item.status));
      const active = others.filter(([, item]) => item.status === 'active');
      const pending = others.filter(([, item]) => item.status === 'pending');
      if (pending.length || active.length > 1 ||
          (active.length === 1 && (binding.replaces?.taskId !== active[0][0] ||
            binding.replaces?.generation !== active[0][1].generation ||
            binding.replaces?.strategy !== 'successor-first')) ||
          (active.length === 0 && binding.replaces))
        fail('GOVERNOR_SINGLETON_BINDING_CONFLICT');
    }
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    registry.instances[sessionId] = {
      ...binding,
      status: 'pending',
      initialization: {
        ...binding.initialization,
        nonce: binding.initialization.delivery?.nonce || randomUUID(),
        promptSha256: createHash('sha256').update(prompt).digest('hex'),
        expiresAt,
      },
      registeredAt: now.toISOString(),
    };
    atomicWrite(registryPath, registry, io);
    return { sessionId, status: 'pending', expiresAt, rollbackReceipt: {registryPath, sessionId, previousBinding, registeredBinding: structuredClone(registry.instances[sessionId])} };
  };
  return binding.agentId === 'personal-governor'
    ? withGovernorRegistryLock(registryPath, register, { io })
    : register();
}

/** Roll back only our unchanged pending receipt, preserving other concurrent entries. */
export function rollbackAgentInitialization(receipt, {fs: io = fs} = {}) {
  if (!receipt?.registryPath || !receipt.sessionId || !receipt.registeredBinding) fail('Invalid rollback receipt');
  const rollback = () => {
    if (!io.existsSync(receipt.registryPath)) return false;
    const registry = JSON.parse(io.readFileSync(receipt.registryPath, 'utf8'));
    const current = registry.instances?.[receipt.sessionId];
    if (current?.status !== 'pending' || JSON.stringify(current) !== JSON.stringify(receipt.registeredBinding)) return false;
    if (receipt.previousBinding === null) delete registry.instances[receipt.sessionId];
    else registry.instances[receipt.sessionId] = receipt.previousBinding;
    atomicWrite(receipt.registryPath, registry, io);
    return true;
  };
  return receipt.registeredBinding.agentId === 'personal-governor'
    ? withGovernorRegistryLock(receipt.registryPath, rollback, { io })
    : rollback();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [sessionId, bindingFile, promptFile] = process.argv.slice(2);
    if (!sessionId || !bindingFile || !promptFile || !process.env.PLUGIN_DATA) fail('usage: PLUGIN_DATA=<dir> node register-agent-initialization.mjs <session-id> <binding.json> <prompt.txt>');
    const result = registerAgentInitialization({sessionId, binding: JSON.parse(fs.readFileSync(bindingFile, 'utf8')), prompt: fs.readFileSync(promptFile, 'utf8'), dataRoot: process.env.PLUGIN_DATA});
    process.stdout.write(`${JSON.stringify({sessionId: result.sessionId, status: result.status, expiresAt: result.expiresAt})}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
