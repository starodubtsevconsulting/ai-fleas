import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { WorkflowTransitionPacket } from './workflow-transition-packet.mjs';

/**
 * Delivers one validated Workflow Router transition packet to the exact Codex
 * task bound to the next workflow role.
 *
 * The architectural rule is the important part: use `codex queue`, which asks
 * the current desktop app-server owner to start the turn. Do not use
 * `codex exec resume`; that creates a competing thread-store writer.
 */
class WorkflowTransitionPacketDelivery {
  constructor(deliveryJob, deliveryReceipt, spawnProcess = spawn) {
    this.deliveryJob = deliveryJob;
    this.deliveryReceipt = deliveryReceipt;
    this.spawnProcess = spawnProcess;
  }

  deliverToNextRoleTask() {
    try {
      this.deliveryJob.registerDispatchPermit();
    } catch (error) {
      this.deliveryReceipt.recordQueueFailure(error.message);
      return;
    }
    // Ask the existing Codex desktop owner to enqueue this transition packet
    // for the exact task that represents the workflow's next role.
    let child;
    try {
      child = this.spawnProcess(
        this.deliveryJob.codexExecutable,
        this.deliveryJob.codexQueueArguments(),
        {
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
    } catch (error) {
      this.deliveryJob.removeDispatchPermit();
      this.deliveryReceipt.recordQueueFailure(error.message);
      return;
    }

    // Keep command output only so a rejected delivery leaves a useful receipt.
    // The packet itself is already stored in the durable dispatch job.
    let stdout = '';
    let stderr = '';
    let spawnError = null;

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => { spawnError = error; });

    // Record exactly one final delivery outcome after the Codex queue process
    // closes. A process error takes precedence over its exit status or output.
    child.once('close', (exitStatus) => {
      if (spawnError || exitStatus !== 0) {
        this.deliveryJob.removeDispatchPermit();
        this.deliveryReceipt.recordQueueFailure(
          spawnError?.message
          || stderr.trim()
          || stdout.trim()
          || `queue exited ${exitStatus ?? 'without status'}`,
        );
        return;
      }

      // Queue acceptance is not endpoint completion. The destination task's
      // lifecycle and next Router result establish completion separately.
      this.deliveryReceipt.recordQueueAcceptance();
    });
  }
}

/** Persists whether Codex accepted or rejected one transition packet. */
class WorkflowTransitionDeliveryReceipt {
  constructor(deliveryJob) {
    this.deliveryJob = deliveryJob;
  }

  recordQueueAcceptance() {
    this.update({
      deliveryStatus: 'queued',
      deliveryError: null,
      queuedAt: new Date().toISOString(),
    });
  }

  recordQueueFailure(errorMessage) {
    this.update({
      deliveryStatus: 'failed',
      deliveryError: errorMessage,
    });
  }

  update(fields) {
    const current = fs.existsSync(this.deliveryJob.receiptFile)
      ? readJson(this.deliveryJob.receiptFile)
      : this.deliveryJob.transitionPacket.toJSON();

    atomicWriteJson(this.deliveryJob.receiptFile, { ...current, ...fields });
  }
}

/**
 * The durable instruction produced by the Stop hook after it validates a role
 * result and resolves the next workflow stage, role, and exact Codex task.
 */
class WorkflowTransitionDeliveryJob {
  static load(jobFile) {
    if (!jobFile || !fs.existsSync(jobFile)) return null;
    return new WorkflowTransitionDeliveryJob(readJson(jobFile));
  }

  constructor(value) {
    this.transitionPacket = new WorkflowTransitionPacket(value.packet);
    this.receiptFile = value.receiptFile;
    this.targetTaskId = value.targetSessionId;
    this.dataRoot = value.dataRoot;
    this.codexExecutable = value.codexBin ?? 'codex';
  }

  taskMessage() {
    return this.transitionPacket.toCodexTaskMessage();
  }

  dispatchPermitFile() {
    const digest = createHash('sha256').update(this.taskMessage()).digest('hex');
    return this.dataRoot
      ? path.join(this.dataRoot, 'workflow-dispatch-controls', this.targetTaskId, `${digest}.json`)
      : null;
  }

  registerDispatchPermit() {
    const file = this.dispatchPermitFile();
    if (!file) throw new Error('dispatch job has no plugin data root');
    const issuedAt = new Date();
    atomicWriteJson(file, {
      correlationId: this.transitionPacket.toJSON().correlationId,
      promptSha256: path.basename(file, '.json'),
      targetStage: this.transitionPacket.toJSON().to?.stage,
      targetRole: this.transitionPacket.toJSON().to?.role,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 10 * 60 * 1000).toISOString(),
    });
  }

  removeDispatchPermit() {
    const file = this.dispatchPermitFile();
    if (file) fs.rmSync(file, { force: true });
  }

  codexQueueArguments() {
    return [
      'queue',
      '--thread', this.targetTaskId,
      '--message', this.taskMessage(),
    ];
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function main() {
  // The Stop hook gives this detached worker the path to one durable delivery
  // job. Missing jobs fail closed without attempting to contact any task.
  const deliveryJob = WorkflowTransitionDeliveryJob.load(process.argv[2]);
  if (!deliveryJob) process.exit(2);

  const deliveryReceipt = new WorkflowTransitionDeliveryReceipt(deliveryJob);
  const packetDelivery = new WorkflowTransitionPacketDelivery(
    deliveryJob,
    deliveryReceipt,
  );

  packetDelivery.deliverToNextRoleTask();
}

main();
