#!/usr/bin/env node
// Local A2A transport for the profile-bound Hermes Coder delegate.
import { randomUUID } from 'node:crypto';

const [action, endpoint, expectedName] = process.argv.slice(2);
if (!['check', 'run'].includes(action) || !endpoint || !expectedName || process.argv.length !== 5) {
  console.error('Usage: a2a-client.mjs <check|run> <local-endpoint> <agent-name>');
  process.exit(1);
}

let url;
try { url = new URL(endpoint); } catch { /* invalid endpoint */ }
if (!url || url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  console.error('A2A endpoint must be a local HTTP origin with an explicit port');
  process.exit(1);
}
const origin = url.href;
const deadline = Date.now() + 30 * 60_000;

async function jsonRequest(target, options, timeoutMs) {
  const response = await fetch(target, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Expected JSON response');
  }
  return response.json();
}

async function checkAgent() {
  const card = await jsonRequest(new URL('.well-known/agent-card.json', origin), {}, 5_000);
  if (card?.name !== expectedName || card?.url !== origin) {
    throw new Error(`Agent Card identity mismatch: expected ${expectedName} at ${origin}`);
  }
  return { ok: true, name: card.name, url: card.url };
}

async function rpc(method, params, timeoutMs) {
  const data = await jsonRequest(origin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
  }, timeoutMs);
  if (data?.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC response');
  if (data.error) throw new Error(`A2A ${method}: ${data.error.message ?? 'unknown error'}`);
  if (!('result' in data)) throw new Error(`A2A ${method}: missing result`);
  return data.result;
}

async function assignmentFromStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) throw new Error('No assignment provided on stdin');
  return text.trim();
}

function taskState(task) {
  if (!task?.id || !task.status?.state) throw new Error('A2A task has no ID or state');
  const state = task.status.state;
  if (['TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_REJECTED'].includes(state)) {
    throw new Error(`A2A task ${task.id} ${state}`);
  }
  if (state === 'TASK_STATE_COMPLETED') return true;
  if (['TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_AUTH_REQUIRED'].includes(state)) {
    throw new Error(`A2A task ${task.id} requires input: ${state}`);
  }
  if (!['TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_RUNNING'].includes(state)) {
    throw new Error(`Unknown A2A task state: ${state}`);
  }
  return false;
}

function completedResult(task) {
  const text = task.artifacts?.flatMap(a => a.parts ?? []).map(p => p.text ?? '').join('').trim();
  if (!text) throw new Error(`A2A task ${task.id} completed without text artifact`);
  return { taskId: task.id, contextId: task.contextId, status: task.status.state, text };
}

async function run() {
  await checkAgent();
  const assignment = await assignmentFromStdin();
  const sent = await rpc('SendMessage', {
    message: { messageId: randomUUID(), role: 'ROLE_USER', parts: [{ text: assignment }] },
  }, Math.max(1, deadline - Date.now()));
  let task = sent?.task;
  if (!task?.id) throw new Error('A2A SendMessage returned no task ID');
  while (!taskState(task)) {
    if (Date.now() >= deadline) throw new Error(`A2A task ${task.id} timed out`);
    await new Promise(resolve => setTimeout(resolve, 2_000));
    const previousId = task.id;
    task = await rpc('GetTask', { id: previousId }, Math.min(10_000, Math.max(1, deadline - Date.now())));
    if (task?.id !== previousId) throw new Error('A2A GetTask returned a different task ID');
  }
  return completedResult(task);
}

try {
  console.log(JSON.stringify(action === 'check' ? await checkAgent() : await run()));
} catch (error) {
  console.error(`A2A ${action} failed: ${error.message}`);
  process.exitCode = 1;
}
