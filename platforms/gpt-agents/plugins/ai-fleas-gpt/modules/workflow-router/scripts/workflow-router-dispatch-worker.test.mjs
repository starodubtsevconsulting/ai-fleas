import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
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
  const packet = {
    correlationId: 'correlation-1',
    profileId: 'example',
    workflowId: 'writing',
    logicalProjectId: 'project',
    runtimeScopeId: 'scope',
    from: { stage: 'drafting', role: 'Writer', event: 'review_ready' },
    to: { stage: 'review', role: 'Reviewer' },
    references: [{ kind: 'revision', ref: 'artifact://revision-1' }],
  };
  fs.writeFileSync(jobFile, JSON.stringify({
    packet,
    receiptFile,
    targetSessionId: 'writer-task',
    dataRoot: root,
    codexBin: missingExecutable ? path.join(root, 'missing-codex') : fakeCodex,
  }));
  return { root, packet, jobFile, receiptFile, invocationFile };
}

test('queues the packet through the existing host task with a prompt-bound dispatch permit', () => {
  const { root, packet, jobFile, receiptFile, invocationFile } = fixture({
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
  const prompt = invocation[4];
  const digest = createHash('sha256').update(prompt).digest('hex');
  const permitFile = path.join(root, 'workflow-dispatch-controls', 'writer-task', `${digest}.json`);
  const permit = JSON.parse(fs.readFileSync(permitFile, 'utf8'));
  assert.equal(permit.correlationId, packet.correlationId);
  assert.equal(permit.promptSha256, digest);
  assert.equal(permit.targetStage, packet.to.stage);
  assert.equal(permit.targetRole, packet.to.role);
  assert.ok(Date.parse(permit.expiresAt) > Date.parse(permit.issuedAt));
});

test('queues a route packet to its caller with exact role and project', () => {
  const { root, jobFile, invocationFile } = fixture();
  const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  job.packet.to = { stage: 'implementation', role: 'Coder' };
  job.packet.route = { id: 'bounded-coder', callerRole: 'Admin', projectId: 'example-service' };
  job.targetSessionId = 'admin-task';
  fs.writeFileSync(jobFile, JSON.stringify(job));
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const invocation = JSON.parse(fs.readFileSync(invocationFile, 'utf8'));
  assert.equal(invocation[2], 'admin-task');
  assert.match(invocation[4], /route "bounded-coder".*role "Coder".*project "example-service"/);
  const digest = createHash('sha256').update(invocation[4]).digest('hex');
  const permit = JSON.parse(fs.readFileSync(path.join(root, 'workflow-dispatch-controls', 'admin-task', `${digest}.json`), 'utf8'));
  assert.equal(permit.targetRole, 'Coder');
  assert.equal(permit.targetStage, 'implementation');
});

test('records a queue rejection without claiming delivery or retaining its permit', () => {
  const { root, jobFile, receiptFile } = fixture({ exitStatus: 1, stderr: 'queue rejected' });
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'failed');
  assert.equal(receipt.deliveryError, 'queue rejected');
  const permitDirectory = path.join(root, 'workflow-dispatch-controls', 'writer-task');
  assert.deepEqual(fs.existsSync(permitDirectory) ? fs.readdirSync(permitDirectory) : [], []);
});

test('records a process launch failure once without obscuring its cause or retaining its permit', () => {
  const { root, jobFile, receiptFile } = fixture({ missingExecutable: true });
  const result = spawnSync(process.execPath, [worker, jobFile], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.deliveryStatus, 'failed');
  assert.match(receipt.deliveryError, /ENOENT/);
  const permitDirectory = path.join(root, 'workflow-dispatch-controls', 'writer-task');
  assert.deepEqual(fs.existsSync(permitDirectory) ? fs.readdirSync(permitDirectory) : [], []);
});
