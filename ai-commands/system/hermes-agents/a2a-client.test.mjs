import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const client = fileURLToPath(new URL('./a2a-client.mjs', import.meta.url));
const task = (state, text) => ({
  id: 'task-1', contextId: 'ctx-1', status: { state },
  ...(text ? { artifacts: [{ parts: [{ text }] }] } : {}),
});

async function scenario(t, reply) {
  const seen = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const message = body ? JSON.parse(body) : null;
    seen.push(message?.method ?? 'AgentCard');
    const value = reply(message, `http://127.0.0.1:${server.address().port}/`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return {
    url: `http://127.0.0.1:${server.address().port}/`, seen,
  };
}

async function invoke(url, action, input = '') {
  const child = spawn(process.execPath, [client, action, url, 'test-agent'], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end(input);
  let stdout = '';
  let stderr = '';
  for await (const chunk of child.stdout) stdout += chunk;
  for await (const chunk of child.stderr) stderr += chunk;
  const code = await new Promise(resolve => child.on('close', resolve));
  return { code, stdout, stderr };
}

test('check verifies the Agent Card identity', async t => {
  const mock = await scenario(t, (_message, url) => ({ name: 'test-agent', url }));
  const result = await invoke(mock.url, 'check');
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ok: true, name: 'test-agent', url: mock.url });
});

test('check rejects another agent', async t => {
  const mock = await scenario(t, (_message, url) => ({ name: 'other-agent', url }));
  const result = await invoke(mock.url, 'check');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Agent Card identity mismatch/);
});

test('run returns a completed SendMessage task', async t => {
  const mock = await scenario(t, (message, url) => message
    ? { jsonrpc: '2.0', result: { task: task('TASK_STATE_COMPLETED', 'done') } }
    : { name: 'test-agent', url });
  const result = await invoke(mock.url, 'run', 'assignment');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).text, 'done');
  assert.deepEqual(mock.seen, ['AgentCard', 'SendMessage']);
});

test('run polls GetTask and rejects a failed task', async t => {
  const mock = await scenario(t, (message, url) => {
    if (!message) return { name: 'test-agent', url };
    if (message.method === 'SendMessage') return { jsonrpc: '2.0', result: { task: task('TASK_STATE_WORKING') } };
    return { jsonrpc: '2.0', result: task('TASK_STATE_FAILED') };
  });
  const result = await invoke(mock.url, 'run', 'assignment');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /TASK_STATE_FAILED/);
  assert.deepEqual(mock.seen, ['AgentCard', 'SendMessage', 'GetTask']);
});
