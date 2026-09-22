import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function updateReceipt(job, update) {
  const current = fs.existsSync(job.receiptFile)
    ? JSON.parse(fs.readFileSync(job.receiptFile, 'utf8'))
    : job.packet;
  atomicWrite(job.receiptFile, { ...current, ...update });
}

const [jobFile] = process.argv.slice(2);
if (!jobFile || !fs.existsSync(jobFile)) process.exit(2);
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const child = spawn(job.codexBin ?? 'codex', [
  'exec', 'resume', job.targetSessionId, '--json', '-',
], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
let observedThreadId = null;
let turnStarted = false;

function consumeLines() {
  const lines = stdout.split('\n');
  stdout = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'thread.started') observedThreadId = event.thread_id;
      if (event.type === 'turn.started' && observedThreadId === job.targetSessionId && !turnStarted) {
        turnStarted = true;
        updateReceipt(job, {
          deliveryStatus: 'started',
          observedThreadId,
          deliveredAt: new Date().toISOString(),
        });
      }
    } catch {
      // Non-JSON diagnostics do not establish delivery.
    }
  }
}

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
  consumeLines();
});
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
child.on('error', (error) => {
  updateReceipt(job, { deliveryStatus: 'failed', deliveryError: error.message });
});
child.on('close', (status) => {
  consumeLines();
  if (!turnStarted) {
    updateReceipt(job, {
      deliveryStatus: 'failed',
      deliveryError: stderr.trim() || `resume exited ${status ?? 'without status'} before turn.started`,
    });
  } else {
    updateReceipt(job, { deliveryStatus: 'completed', completedAt: new Date().toISOString() });
  }
});

child.stdin.end(job.message);
