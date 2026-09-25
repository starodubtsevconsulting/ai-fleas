import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [sessionId, bindingFile, promptFile] = process.argv.slice(2);
if (!process.env.PLUGIN_DATA || !sessionId || !bindingFile || !promptFile) {
  fail('usage: PLUGIN_DATA=<dir> node queue-agent-initialization.mjs <session-id> <binding.json> <prompt.txt>');
}

const registryPath = path.join(process.env.PLUGIN_DATA, 'agent-bindings.json');
const previousRegistry = fs.existsSync(registryPath)
  ? fs.readFileSync(registryPath, 'utf8')
  : null;

const registerScript = fileURLToPath(new URL('./register-agent-initialization.mjs', import.meta.url));
const registration = spawnSync(process.execPath, [registerScript, sessionId, bindingFile, promptFile], {
  env: process.env,
  encoding: 'utf8',
});
if (registration.status !== 0) fail(registration.stderr.trim() || 'agent initialization registration failed');

const prompt = fs.readFileSync(promptFile, 'utf8').trimEnd();
const promptSha256 = createHash('sha256').update(prompt).digest('hex');
let delivery;
if (process.env.AGENT_BOOTSTRAP_QUEUE_LOG) {
  fs.appendFileSync(process.env.AGENT_BOOTSTRAP_QUEUE_LOG, `${JSON.stringify({ thread: sessionId, message: prompt })}\n`);
  delivery = { status: 0, stdout: 'test queue accepted', stderr: '' };
} else {
  delivery = spawnSync(process.env.CODEX_BIN ?? 'codex', [
    'queue',
    '--thread', sessionId,
    '--message', prompt,
  ], { env: process.env, encoding: 'utf8' });
}

if (delivery.error || delivery.status !== 0) {
  const currentRegistry = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    : null;
  const registeredBinding = currentRegistry?.instances?.[sessionId];
  const safeToRollback = registeredBinding?.status === 'pending' &&
    registeredBinding?.initialization?.promptSha256 === promptSha256;
  if (safeToRollback) {
    if (previousRegistry === null) {
      fs.rmSync(registryPath, { force: true });
    } else {
      const temporary = `${registryPath}.${process.pid}.rollback.tmp`;
      fs.writeFileSync(temporary, previousRegistry, { mode: 0o600 });
      fs.renameSync(temporary, registryPath);
    }
  }
  const reason = delivery.error?.message || delivery.stderr?.trim() || delivery.stdout?.trim()
    || `queue exited ${delivery.status}`;
  fail(safeToRollback ? reason : `${reason}; pending receipt changed concurrently and was not rolled back`);
}

process.stdout.write(`${JSON.stringify({ sessionId, deliveryStatus: 'queued' })}\n`);
