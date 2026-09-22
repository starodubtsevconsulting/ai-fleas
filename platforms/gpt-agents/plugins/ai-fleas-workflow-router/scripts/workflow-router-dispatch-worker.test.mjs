import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('./workflow-router-dispatch-worker.mjs', import.meta.url));

function fixture(fakeEvents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-dispatch-worker-'));
  const receiptFile = path.join(root, 'receipt.json');
  const jobFile = path.join(root, 'job.json');
  const fakeCodex = path.join(root, 'fake-codex');
  fs.writeFileSync(receiptFile, `${JSON.stringify({ deliveryStatus: 'pending' })}\n`);
  fs.writeFileSync(fakeCodex, `#!/usr/bin/env node\n${fakeEvents.map((event) =>
    `process.stdout.write(${JSON.stringify(`${JSON.stringify(event)}\n`)});`).join('\n')}\n`);
  fs.chmodSync(fakeCodex, 0o755);
  fs.writeFileSync(jobFile, JSON.stringify({
    packet: { correlationId: 'correlation-1' },
    receiptFile,
    targetSessionId: 'writer-task',
    message: 'WORKFLOW_ROUTER_DISPATCH',
    codexBin: fakeCodex,
  }));
  return { jobFile, receiptFile };
}

test('records delivery only after the exact resumed task emits turn.started', () => {
  const { jobFile, receiptFile } = fixture([
    { type: 'thread.started', thread_id: 'writer-task' },
    { type: 'turn.started' },
    { type: 'turn.completed' },
  ]);
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'completed');
  assert.equal(receipt.observedThreadId, 'writer-task');
  assert.ok(receipt.deliveredAt);
  assert.ok(receipt.completedAt);
});

test('does not claim delivery when turn.started belongs to no verified target', () => {
  const { jobFile, receiptFile } = fixture([
    { type: 'thread.started', thread_id: 'different-task' },
    { type: 'turn.started' },
  ]);
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'failed');
  assert.match(receipt.deliveryError, /before turn.started/);
});
