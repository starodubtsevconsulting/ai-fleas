import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('./workflow-router-dispatch-worker.mjs', import.meta.url));

function fixture({
  exitStatus = 0,
  stderr = '',
  initialReceipt = { deliveryStatus: 'pending' },
  missingExecutable = false,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-dispatch-worker-'));
  const receiptFile = path.join(root, 'receipt.json');
  const jobFile = path.join(root, 'job.json');
  const fakeCodex = path.join(root, 'fake-codex');
  const invocationFile = path.join(root, 'invocation.json');
  fs.writeFileSync(receiptFile, `${JSON.stringify(initialReceipt)}\n`);
  fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(invocationFile)}, JSON.stringify(process.argv.slice(2)));
if (${JSON.stringify(stderr)}) process.stderr.write(${JSON.stringify(stderr)});
process.exit(${exitStatus});
`);
  fs.chmodSync(fakeCodex, 0o755);
  fs.writeFileSync(jobFile, JSON.stringify({
    packet: { correlationId: 'correlation-1' },
    receiptFile,
    targetSessionId: 'writer-task',
    codexBin: missingExecutable ? path.join(root, 'missing-codex') : fakeCodex,
  }));
  return { jobFile, receiptFile, invocationFile };
}

test('queues the packet through the existing host task without resuming a competing writer', () => {
  const { jobFile, receiptFile, invocationFile } = fixture({
    initialReceipt: { deliveryStatus: 'failed', deliveryError: 'active writer conflict' },
  });
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const invocation = JSON.parse(fs.readFileSync(invocationFile, 'utf8'));
  assert.deepEqual(invocation.slice(0, 4), [
    'queue', '--thread', 'writer-task', '--message',
  ]);
  assert.match(invocation[4], /^WORKFLOW_ROUTER_DISPATCH\n/);
  assert.match(invocation[4], /"correlationId":"correlation-1"/);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'queued');
  assert.equal(receipt.deliveryError, null);
  assert.ok(receipt.queuedAt);
});

test('records a queue rejection without claiming delivery', () => {
  const { jobFile, receiptFile } = fixture({ exitStatus: 1, stderr: 'queue rejected' });
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'failed');
  assert.equal(receipt.deliveryError, 'queue rejected');
});

test('records a process launch failure once without obscuring its cause', () => {
  const { jobFile, receiptFile } = fixture({ missingExecutable: true });
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'failed');
  assert.match(receipt.deliveryError, /ENOENT/);
});
