import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

const [sessionId, promptFile, expectedReadiness, action = 'initialize'] = process.argv.slice(2);
const dataRoot = process.env.PLUGIN_DATA;
if (!dataRoot || !sessionId || !promptFile || !expectedReadiness) {
  fail('usage: PLUGIN_DATA=<dir> node queue-lifecycle-control.mjs <session-id> <prompt-file> <expected-readiness> [action]');
}

const registerScript = fileURLToPath(new URL('./register-lifecycle-control.mjs', import.meta.url));
const registration = spawnSync(process.execPath, [
  registerScript,
  sessionId,
  promptFile,
  expectedReadiness,
  action,
], { env: process.env, encoding: 'utf8' });
if (registration.status !== 0) fail(registration.stderr.trim() || 'lifecycle permit registration failed');

const prompt = fs.readFileSync(promptFile, 'utf8');
const permitFile = path.join(dataRoot, 'lifecycle-controls', `${sessionId}.json`);
const receiptFile = path.join(dataRoot, 'lifecycle-deliveries', `${sessionId}.json`);
let delivery;
if (process.env.LIFECYCLE_QUEUE_LOG) {
  fs.appendFileSync(process.env.LIFECYCLE_QUEUE_LOG, `${JSON.stringify({ thread: sessionId, message: prompt })}\n`);
  delivery = { status: 0, stdout: 'test queue accepted', stderr: '' };
} else {
  delivery = spawnSync(process.env.CODEX_BIN ?? 'codex', [
    'queue',
    '--thread', sessionId,
    '--message', prompt,
  ], { env: process.env, encoding: 'utf8' });
}

if (delivery.error || delivery.status !== 0) {
  fs.rmSync(permitFile, { force: true });
  const reason = delivery.error?.message || delivery.stderr?.trim() || delivery.stdout?.trim() || `queue exited ${delivery.status}`;
  atomicWrite(receiptFile, {
    sessionId,
    action,
    expectedReadiness,
    deliveryStatus: 'failed',
    deliveryError: reason,
  });
  fail(reason);
}

atomicWrite(receiptFile, {
  sessionId,
  action,
  expectedReadiness,
  deliveryStatus: 'queued',
  deliveryError: null,
  queuedAt: new Date().toISOString(),
});
process.stdout.write(`${sessionId}\n`);
