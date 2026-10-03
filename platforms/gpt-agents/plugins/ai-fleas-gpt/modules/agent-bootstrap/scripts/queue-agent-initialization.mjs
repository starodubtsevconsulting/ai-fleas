/** Explicit controller queue transaction for an exact initialized task.
 * Caller: lifecycle controller CLI with PLUGIN_DATA, task ID, binding and prompt files.
 * Effects: registers one pending receipt, queues its exact prompt, and rolls back only
 * that unchanged receipt if delivery fails. It does not create or recover a task.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { registerAgentInitialization, rollbackAgentInitialization } from './register-agent-initialization.mjs';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [sessionId, bindingFile, promptFile] = process.argv.slice(2);
if (!process.env.PLUGIN_DATA || !sessionId || !bindingFile || !promptFile) {
  fail('usage: PLUGIN_DATA=<dir> node queue-agent-initialization.mjs <session-id> <binding.json> <prompt.txt>');
}

const prompt = fs.readFileSync(promptFile, 'utf8').trimEnd();
let registration;
try {
  registration = registerAgentInitialization({
    sessionId, binding: JSON.parse(fs.readFileSync(bindingFile, 'utf8')),
    prompt, dataRoot: process.env.PLUGIN_DATA,
  });
} catch (error) { fail(error.message); }
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
  let safeToRollback = false;
  try { safeToRollback = rollbackAgentInitialization(registration.rollbackReceipt); }
  catch (error) { fail(`queue delivery failed and rollback could not be verified: ${error.message}`); }
  const reason = delivery.error?.message || delivery.stderr?.trim() || delivery.stdout?.trim()
    || `queue exited ${delivery.status}`;
  fail(safeToRollback ? reason : `${reason}; pending receipt changed concurrently and was not rolled back`);
}

process.stdout.write(`${JSON.stringify({ sessionId, deliveryStatus: 'queued' })}\n`);
