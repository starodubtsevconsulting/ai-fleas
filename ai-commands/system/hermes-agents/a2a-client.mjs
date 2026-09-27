#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Handles local A2A HTTP requests and validates JSON-RPC responses.
export class A2aTransport {
  constructor(endpoint) {
    let url;
    try { url = new URL(endpoint); } catch { /* validated below */ }
    if (!url || url.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost'].includes(url.hostname) || !url.port ||
        url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('A2A endpoint must be a local HTTP origin with an explicit port');
    }
    this.origin = url.href;
  }

  async agentCard() {
    return this.#request(new URL('.well-known/agent-card.json', this.origin), {}, 5_000);
  }

  async call(method, params, timeoutMs) {
    const data = await this.#request(this.origin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
    }, timeoutMs);
    if (data?.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC response');
    if (data.error) throw new Error(`A2A ${method}: ${data.error.message ?? 'unknown error'}`);
    if (!('result' in data)) throw new Error(`A2A ${method}: missing result`);
    return data.result;
  }

  async #request(target, options, timeoutMs) {
    const response = await fetch(target, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Expected JSON response');
    }
    return response.json();
  }
}

// Verifies the Hermes Coder identity and follows an assignment to its final task result.
export class HermesCoderA2aClient {
  constructor(transport, expectedName) {
    this.transport = transport;
    this.expectedName = expectedName;
  }

  async check() {
    const card = await this.transport.agentCard();
    if (card?.name !== this.expectedName || card?.url !== this.transport.origin) {
      throw new Error(`Agent Card identity mismatch: expected ${this.expectedName} at ${this.transport.origin}`);
    }
    return { ok: true, name: card.name, url: card.url };
  }

  async run(assignment) {
    await this.check();
    if (!assignment.trim()) throw new Error('No assignment provided on stdin');
    const deadline = Date.now() + 30 * 60_000;
    const sent = await this.transport.call('SendMessage', {
      message: { messageId: randomUUID(), role: 'ROLE_USER', parts: [{ text: assignment.trim() }] },
    }, this.#remaining(deadline));
    let task = sent?.task;
    if (!task?.id) throw new Error('A2A SendMessage returned no task ID');

    while (!this.#isComplete(task)) {
      if (Date.now() >= deadline) throw new Error(`A2A task ${task.id} timed out`);
      await new Promise(resolve => setTimeout(resolve, 2_000));
      const previousId = task.id;
      task = await this.#getTask(previousId, Math.min(10_000, this.#remaining(deadline)));
      if (task?.id !== previousId) throw new Error('A2A GetTask returned a different task ID');
    }
    return this.#completedResult(task);
  }

  async getTask(id, timeoutMs = 10_000) {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Task ID is required');
    await this.check();
    return this.#getTask(id, timeoutMs);
  }

  async listTasks() {
    await this.check();
    return this.transport.call('ListTasks', {}, 10_000);
  }

  async #getTask(id, timeoutMs) {
    const task = await this.transport.call('GetTask', { id }, timeoutMs);
    if (task?.id !== id) throw new Error('A2A GetTask returned a different task ID');
    return task;
  }

  async cancelTask(id) {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Task ID is required');
    await this.check();
    const task = await this.transport.call('CancelTask', { id }, 10_000);
    if (task?.id !== id) throw new Error('A2A CancelTask returned a different task ID');
    return { task, underlyingTurnStopped: false };
  }

  #remaining(deadline) {
    return Math.max(1, deadline - Date.now());
  }

  #isComplete(task) {
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

  #completedResult(task) {
    const text = task.artifacts?.flatMap(a => a.parts ?? []).map(p => p.text ?? '').join('').trim();
    if (!text) throw new Error(`A2A task ${task.id} completed without text artifact`);
    return { taskId: task.id, contextId: task.contextId, status: task.status.state, text };
  }
}

// Gateway lifecycle is scoped to a named Hermes profile, never --all.
export class HermesGatewayLifecycle {
  constructor(profile, command = 'hermes') {
    if (typeof profile !== 'string' || !/^[a-z0-9][a-z0-9-]*-coder$/.test(profile)) {
      throw new Error('An exact Hermes Coder profile ID is required');
    }
    this.profile = profile;
    this.command = command;
  }

  async status() { return this.#invoke('status'); }
  async start() { return this.#invoke('start'); }
  async stop() { return this.#invoke('stop'); }

  #invoke(action) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, ['-p', this.profile, 'gateway', action], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) resolve({ profile: this.profile, action, stdout: stdout.trim(), stderr: stderr.trim() });
        else reject(new Error(`Hermes gateway ${action} failed (${code}): ${stderr.trim()}`));
      });
    });
  }
}

async function assignmentFromStdin() {
  let assignment = '';
  for await (const chunk of process.stdin) assignment += chunk;
  return assignment;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [action, endpoint, expectedName] = process.argv.slice(2);
  if (!['check', 'run', 'list', 'status', 'cancel', 'gateway-status', 'gateway-start', 'gateway-stop'].includes(action)) {
    console.error('Usage: a2a-client.mjs <check|run|list|status|cancel> <local-endpoint> <agent-name> [task-id] | <gateway-status|gateway-start|gateway-stop> <coder-profile>');
    process.exitCode = 1;
  } else {
    try {
      let result;
      if (action.startsWith('gateway-')) {
        if (!endpoint || process.argv.length !== 4) throw new Error('Exact Coder profile ID required');
        const gateway = new HermesGatewayLifecycle(endpoint);
        result = await gateway[action.slice('gateway-'.length)]();
      } else {
        const expectedCount = ['status', 'cancel'].includes(action) ? 6 : 5;
        if (!endpoint || !expectedName || process.argv.length !== expectedCount) throw new Error('A2A endpoint, agent name, and applicable task ID required');
        const client = new HermesCoderA2aClient(new A2aTransport(endpoint), expectedName);
        if (action === 'check') result = await client.check();
        if (action === 'run') result = await client.run(await assignmentFromStdin());
        if (action === 'list') result = await client.listTasks();
        if (action === 'status') result = await client.getTask(process.argv[5]);
        if (action === 'cancel') result = await client.cancelTask(process.argv[5]);
      }
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`Hermes ${action} failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
