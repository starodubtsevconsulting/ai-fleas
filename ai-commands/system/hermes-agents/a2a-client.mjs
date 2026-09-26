#!/usr/bin/env node
import { randomUUID } from 'node:crypto';

// Handles local A2A HTTP requests and validates JSON-RPC responses.
class A2aTransport {
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
class HermesCoderA2aClient {
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
      task = await this.transport.call('GetTask', { id: previousId },
        Math.min(10_000, this.#remaining(deadline)));
      if (task?.id !== previousId) throw new Error('A2A GetTask returned a different task ID');
    }
    return this.#completedResult(task);
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

async function assignmentFromStdin() {
  let assignment = '';
  for await (const chunk of process.stdin) assignment += chunk;
  return assignment;
}

const [action, endpoint, expectedName] = process.argv.slice(2);
if (!['check', 'run'].includes(action) || !endpoint || !expectedName || process.argv.length !== 5) {
  console.error('Usage: a2a-client.mjs <check|run> <local-endpoint> <agent-name>');
  process.exit(1);
}

try {
  const client = new HermesCoderA2aClient(new A2aTransport(endpoint), expectedName);
  const result = action === 'check' ? await client.check() : await client.run(await assignmentFromStdin());
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(`A2A ${action} failed: ${error.message}`);
  process.exitCode = 1;
}
