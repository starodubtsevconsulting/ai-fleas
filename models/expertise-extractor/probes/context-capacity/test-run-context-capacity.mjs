#!/usr/bin/env node
/**
 * Exercises the context-capacity runner with deterministic fake runtime commands.
 * Caller: a developer or CI via `node test-run-context-capacity.mjs`.
 * Inputs: the checked-in frozen packet/fixture artifacts; no live Hermes or GX10 service.
 * Output: one PASS line after a complete 53-turn Arm A simulation and evidence assertions.
 * Effects: creates and then removes one exact ignored sandbox below
 * notes/benchmarks/local-models/runs/context-capacity-runner-test. Passing verifies runner
 * orchestration and fail-closed session checks; it does not verify live model behavior,
 * actual Hermes resumption, telemetry accuracy, or remote restoration.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(self);
const repoRoot = path.resolve(scriptDir, '../../../..');
const testRoot = path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity-runner-test');
const manifestPath = path.join(testRoot, 'manifest.json');
const runId = 'offline-arm-a';

if (process.argv[2] === '--fake-command') {
  const id = process.argv[3];
  const armTokens = Number(process.env.CONTEXT_CAPACITY_SERVER_TOKENS || 65536);
  const simple = value => process.stdout.write(`${JSON.stringify(value)}\n`);
  if (id === 'discover_model') simple({ model_id: 'Qwen3-Coder-Next', quant: 'Q5_K_M', runtime_build: 'fake-build' });
  else if (id === 'discover_hermes') simple({ identifier: 'fake-profile', provider_id: 'fake-provider', endpoint_identifier: 'fake-endpoint' });
  else if (id === 'execute_turn') {
    const index = Number(process.env.CONTEXT_CAPACITY_CHUNK_INDEX);
    if (process.env.FAKE_TIMEOUT === '1' && index === 2) {
      const descendant = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"], { stdio: 'ignore' });
      fs.writeFileSync(process.env.FAKE_DESCENDANT_PID_FILE, `${descendant.pid}\n`);
      await new Promise(() => {});
    }
    const requested = process.env.CONTEXT_CAPACITY_SESSION_ID || null;
    const session = index >= 16 && index !== 54 ? 'offline-session-2' : 'offline-session-1';
    const expectedRequested = index === 1 || index === 54 ? null : (index <= 16 ? 'offline-session-1' : 'offline-session-2');
    if (requested !== expectedRequested) throw new Error(`unexpected requested session at chunk ${index}: ${requested}`);
    if ((index === 53 && process.env.FAKE_FIRST_PASS_FAIL !== '1') || index === 54) {
      const workspace = process.env.CONTEXT_CAPACITY_WORKSPACE;
      fs.copyFileSync(
        path.join(repoRoot, 'notes/benchmarks/local-models/fixtures/hermes-context-capacity-integration/reference/recognizers/change-approval-recognizer.mjs'),
        path.join(workspace, 'recognizers/change-approval-recognizer.mjs'),
      );
    }
    simple({
      session_id: index === 54 ? 'offline-correction-session' : session, requested_session_id: requested, fresh_session: index === 1 || index === 54,
      resumed: index !== 1 && index !== 54, lineage_continuous: true, response: process.env.FAKE_BAD_ACK === '1' && index === 2 ? 'WRONG' : (index < 53 ? 'CONTEXT_CHUNK_RECEIVED' : 'Implemented the requested recognizer change.'),
      confirmed_stopped: true, input_tokens: Math.min(index * 3900, armTokens - 8192), model_calls: 1,
      tool_calls: index === 53 ? 1 : 0, compaction_count: index === 16 ? 1 : 0,
      compaction_time_ms: index === 16 ? 10 : 0, eviction_evidence: index === 16 ? 'fake-compaction' : null,
      unexpected_truncation_detected: false,
    });
  } else if (['query_server_context', 'query_hermes_context'].includes(id)) simple({ context_tokens: armTokens });
  else if (id === 'query_compression') simple({ enabled: process.env.CONTEXT_CAPACITY_COMPRESSION_ENABLED ? process.env.CONTEXT_CAPACITY_COMPRESSION_ENABLED === 'true' : true, trigger_tokens: Number(process.env.CONTEXT_CAPACITY_COMPRESSION_TRIGGER_TOKENS || armTokens - 8192) });
  else if (id === 'snapshot') simple({ snapshot_id: 'fake-snapshot', targets: [{ path: '/fake/config', sha256: 'a'.repeat(64) }] });
  else if (['configure_arm', 'start', 'stop', 'restart'].includes(id)) simple({ ok: true });
  else if (id === 'health') simple({ healthy: true });
  else if (id === 'telemetry') simple({ latency_ms: 100, peak_memory_bytes: 20, swap_bytes: 0, tool_call_count: 1, system_total_memory_bytes: 128 * 1024 ** 3, system_peak_used_memory_bytes: 64 * 1024 ** 3, system_minimum_available_memory_bytes: 64 * 1024 ** 3, model_server_peak_rss_bytes: 60 * 1024 ** 3, hermes_peak_rss_bytes: 1024 ** 3, model_call_count: 53 });
  else if (id === 'restore') {
    if (process.env.FAKE_RESTORE_MARKER) fs.writeFileSync(process.env.FAKE_RESTORE_MARKER, 'restored\n');
    simple({ ok: true, snapshot_id: 'fake-snapshot' });
  }
  else if (id === 'verify_restore') simple({ ok: true, targets: [{ path: '/fake/config', expected_sha256: 'a'.repeat(64), observed_sha256: 'a'.repeat(64), matches: true }] });
  else if (id === 'tokenize') simple({ tokens: [] });
  else throw new Error(`unknown fake command ${id}`);
  process.exit(0);
}

fs.rmSync(testRoot, { recursive: true, force: true });
fs.mkdirSync(testRoot, { recursive: true });
try {
  const contract = {
    discover_model: 'model_identity_v1', discover_hermes: 'hermes_identity_v1', execute_turn: 'hermes_turn_v1', tokenize: 'token_ids_v1',
    query_server_context: 'context_tokens_v1', query_hermes_context: 'context_tokens_v1', query_compression: 'compression_v1', snapshot: 'snapshot_v1',
    configure_arm: 'action_result_v1', start: 'action_result_v1', stop: 'action_result_v1', restart: 'action_result_v1', health: 'health_v1',
    telemetry: 'telemetry_v1', restore: 'restore_result_v1', verify_restore: 'restore_verification_v1',
  };
  const commands = Object.fromEntries(Object.entries(contract).map(([id, contractId]) => [id, {
    argv: [process.execPath, self, '--fake-command', id], timeout_ms: id === 'health' ? 10000 : 60000,
    output_contract: { format: 'json', contract_id: contractId },
  }]));
  commands.execute_turn.timeout_ms = 180000;
  commands.tokenize.input_contract = 'tokenize_request_v1';
  const compression = tokens => ({ enabled: true, trigger_tokens: tokens - 8192 });
  const manifest = {
    schema_version: '1.0.0', experiment_id: 'qwen3-coder-next-q5km-context-capacity',
    expected_model: { model_id: 'Qwen3-Coder-Next', quant: 'Q5_K_M', runtime_build: 'fake-build' },
    hermes_profile: { identifier: 'fake-profile', profile_path: '/fake/profile', provider_id: 'fake-provider', endpoint_identifier: 'fake-endpoint' },
    secret_environment: {}, commands,
    arms: {
      A: { id: 'A', server_context_tokens: 65536, hermes_context_tokens: 65536, compression: compression(65536) },
      B: { id: 'B', server_context_tokens: 131072, hermes_context_tokens: 131072, compression: compression(131072) },
      C: { id: 'C', server_context_tokens: 262144, hermes_context_tokens: 262144, compression: compression(262144) },
    },
    snapshot_restore: { snapshot_targets: ['/fake/config'], hash_algorithm: 'sha256', capture_baseline: true, restore_against_captured_baseline: true, byte_for_byte_required: true },
    telemetry: { latency_ms: true, peak_memory_bytes: true, swap_bytes: true, tool_call_count: true },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'run-context-capacity.mjs'), 'run', '--manifest', manifestPath, '--arm', 'A', '--phase', 'exploratory', '--sequence-position', '1', '--run-id', runId], { cwd: repoRoot, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const evidence = JSON.parse(fs.readFileSync(path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity', runId, 'evidence.json'), 'utf8'));
  assert.equal(evidence.valid_run, true);
  assert.equal(evidence.first_pass_accepted, true);
  assert.equal(evidence.context.chunk_count, 53);
  assert.equal(evidence.context.largest_model_input_tokens, 57344);
  assert.equal(evidence.context.compaction_count, 1);
  assert.equal(evidence.restoration.verified, true);
  assert.equal(evidence.retention.rate, 1);
  const failureRunId = 'offline-bad-ack';
  const restoreMarker = path.join(testRoot, 'restore.marker');
  const failed = spawnSync(process.execPath, [path.join(scriptDir, 'run-context-capacity.mjs'), 'run', '--manifest', manifestPath, '--arm', 'A', '--phase', 'exploratory', '--sequence-position', '2', '--run-id', failureRunId], {
    cwd: repoRoot, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, FAKE_BAD_ACK: '1', FAKE_RESTORE_MARKER: restoreMarker },
  });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /acknowledgement mismatch/);
  assert.equal(fs.readFileSync(restoreMarker, 'utf8'), 'restored\n');
  commands.execute_turn.timeout_ms = 200;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const timeoutRunId = 'offline-timeout-containment';
  const descendantPidFile = path.join(testRoot, 'descendant.pid');
  const timeoutRestoreMarker = path.join(testRoot, 'timeout-restore.marker');
  const timedOut = spawnSync(process.execPath, [path.join(scriptDir, 'run-context-capacity.mjs'), 'run', '--manifest', manifestPath, '--arm', 'A', '--phase', 'exploratory', '--sequence-position', '2', '--run-id', timeoutRunId], {
    cwd: repoRoot, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, FAKE_TIMEOUT: '1', FAKE_DESCENDANT_PID_FILE: descendantPidFile, FAKE_RESTORE_MARKER: timeoutRestoreMarker },
  });
  assert.equal(timedOut.status, 1);
  assert.match(timedOut.stderr, /execute_turn timed out/);
  assert.equal(fs.readFileSync(timeoutRestoreMarker, 'utf8'), 'restored\n');
  const descendantPid = Number(fs.readFileSync(descendantPidFile, 'utf8').trim());
  assert.throws(() => process.kill(descendantPid, 0), error => error.code === 'ESRCH');
  commands.execute_turn.timeout_ms = 180000;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const correctionRunId = 'offline-correction';
  const corrected = spawnSync(process.execPath, [path.join(scriptDir, 'run-context-capacity.mjs'), 'run', '--manifest', manifestPath, '--arm', 'A', '--phase', 'exploratory', '--sequence-position', '3', '--run-id', correctionRunId], {
    cwd: repoRoot, encoding: 'utf8', timeout: 30000, env: { ...process.env, FAKE_FIRST_PASS_FAIL: '1' },
  });
  assert.equal(corrected.status, 0, `${corrected.stdout}\n${corrected.stderr}`);
  const correctedEvidence = JSON.parse(fs.readFileSync(path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity', correctionRunId, 'evidence.json'), 'utf8'));
  assert.equal(correctedEvidence.first_pass_accepted, false);
  assert.deepEqual(correctedEvidence.correction, { attempted: true, accepted: true, wall_time_ms: correctedEvidence.correction.wall_time_ms });
  console.log('PASS context-capacity runner offline 53-turn Arm A simulation');
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity', runId), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity', 'offline-bad-ack'), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity', 'offline-timeout-containment'), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity', 'offline-correction'), { recursive: true, force: true });
}
