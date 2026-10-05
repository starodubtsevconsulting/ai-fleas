#!/usr/bin/env node
/**
 * Runs or preflights the frozen Hermes context-capacity benchmark.
 * Caller: the benchmark coordinator from the visible ai-fleas checkout.
 * Invocation: node run-context-capacity.mjs preflight|run --manifest PATH [--arm A|B|C]
 *   [--phase exploratory|confirmation] [--sequence-position N] [--run-id ID].
 * Inputs: a git-ignored local manifest plus frozen tracked packet/fixture artifacts.
 * Output: JSON status on stdout and, for run, a sanitized evidence JSON file below the
 * ignored local benchmark runs directory. Effects in run mode: stages an ignored fixture
 * copy, invokes only manifest-declared commands, delivers the packet through one fresh
 * resumable Hermes session, runs the external verifier after each turn is stopped, and
 * restores the captured baseline. Preflight mode performs no runtime mutation.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, '../../../..');
const packetManifestPath = path.join(scriptDir, 'packet-manifest.json');
const taskPacketPath = path.join(scriptDir, 'integration-task-packet.json');
const acceptancePath = path.join(scriptDir, 'acceptance.json');
const manifestSchemaPath = path.join(scriptDir, 'manifest.schema.json');
const evidenceSchemaPath = path.join(scriptDir, 'evidence.schema.json');
const fixtureRoot = path.join(repoRoot, 'notes/benchmarks/local-models/fixtures/hermes-context-capacity-integration');
const generatedChunksRoot = path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity-packet');
const runsRoot = path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity');

const sha256 = data => createHash('sha256').update(data).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = message => { throw new Error(message); };
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

function validateSchema(value, schema, root = schema, label = '$') {
  if (schema.$ref) {
    const parts = schema.$ref.replace(/^#\//, '').split('/').map(x => x.replaceAll('~1', '/').replaceAll('~0', '~'));
    let target = root;
    for (const part of parts) target = target?.[part];
    if (!target) fail(`${label}: unresolved schema reference ${schema.$ref}`);
    validateSchema(value, target, root, label);
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) fail(`${label}: expected constant ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) fail(`${label}: value is not in enum`);
  if (schema.oneOf) {
    let matches = 0;
    for (const option of schema.oneOf) { try { validateSchema(value, option, root, label); matches += 1; } catch {} }
    if (matches !== 1) fail(`${label}: expected exactly one oneOf match`);
  }
  if (schema.allOf) for (const part of schema.allOf) validateSchema(value, part, root, label);
  if (schema.if) {
    let matched = true;
    try { validateSchema(value, schema.if, root, label); } catch { matched = false; }
    if (matched && schema.then) validateSchema(value, schema.then, root, label);
    if (!matched && schema.else) validateSchema(value, schema.else, root, label);
  }
  const types = schema.type === undefined ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (types.length) {
    const typeMatches = type => type === 'null' ? value === null : type === 'array' ? Array.isArray(value) : type === 'object' ? isObject(value) : type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === type;
    if (!types.some(typeMatches)) fail(`${label}: type mismatch`);
  }
  if (isObject(value)) {
    for (const key of schema.required || []) if (!(key in value)) fail(`${label}.${key}: required`);
    const properties = schema.properties || {};
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in properties)) fail(`${label}.${key}: additional property`);
    for (const [key, child] of Object.entries(properties)) if (key in value) validateSchema(value[key], child, root, `${label}.${key}`);
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) fail(`${label}: too few properties`);
    if (schema.propertyNames) for (const key of Object.keys(value)) validateSchema(key, schema.propertyNames, root, `${label} property name`);
    if (isObject(schema.additionalProperties)) for (const [key, child] of Object.entries(value)) if (!(key in properties)) validateSchema(child, schema.additionalProperties, root, `${label}.${key}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(`${label}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(`${label}: too many items`);
    if (schema.uniqueItems && new Set(value.map(x => JSON.stringify(x))).size !== value.length) fail(`${label}: duplicate items`);
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, root, `${label}[${index}]`));
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(`${label}: too short`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) fail(`${label}: pattern mismatch`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail(`${label}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`${label}: above maximum`);
  }
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['preflight', 'run'].includes(mode)) fail('usage: run-context-capacity.mjs preflight|run --manifest PATH [options]');
  const args = { mode };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    if (!key?.startsWith('--') || rest[i + 1] === undefined) fail(`invalid argument ${key || ''}`);
    args[key.slice(2).replaceAll('-', '_')] = rest[i + 1];
  }
  if (!args.manifest) fail('--manifest is required');
  return args;
}

function assertKeys(value, required, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  for (const key of required) if (!(key in value)) fail(`${label}.${key} is required`);
}

function validateCommand(command, id, expectedContract) {
  assertKeys(command, ['argv', 'timeout_ms', 'output_contract'], `commands.${id}`);
  if (!Array.isArray(command.argv) || command.argv.length === 0 || command.argv.some(v => typeof v !== 'string' || !v)) fail(`commands.${id}.argv`);
  if (!Number.isInteger(command.timeout_ms) || command.timeout_ms < 1 || command.timeout_ms > 600000) fail(`commands.${id}.timeout_ms`);
  if (command.output_contract?.format !== 'json' || command.output_contract?.contract_id !== expectedContract) fail(`commands.${id}.output_contract`);
}

function validateManifest(manifest) {
  assertKeys(manifest, ['schema_version', 'experiment_id', 'expected_model', 'hermes_profile', 'secret_environment', 'commands', 'arms', 'snapshot_restore', 'telemetry'], 'manifest');
  if (manifest.schema_version !== '1.0.0' || manifest.experiment_id !== 'qwen3-coder-next-q5km-context-capacity') fail('manifest identity mismatch');
  assertKeys(manifest.expected_model, ['model_id', 'quant', 'runtime_build'], 'expected_model');
  if (manifest.expected_model.model_id !== 'Qwen3-Coder-Next' || manifest.expected_model.quant !== 'Q5_K_M') fail('frozen model/quant mismatch');
  assertKeys(manifest.hermes_profile, ['identifier', 'profile_path', 'provider_id', 'endpoint_identifier'], 'hermes_profile');
  if (!path.isAbsolute(manifest.hermes_profile.profile_path)) fail('hermes_profile.profile_path must be absolute');
  const contracts = {
    discover_model: 'model_identity_v1', discover_hermes: 'hermes_identity_v1', execute_turn: 'hermes_turn_v1',
    tokenize: 'token_ids_v1', query_server_context: 'context_tokens_v1', query_hermes_context: 'context_tokens_v1',
    query_compression: 'compression_v1', snapshot: 'snapshot_v1', configure_arm: 'action_result_v1',
    start: 'action_result_v1', stop: 'action_result_v1', restart: 'action_result_v1', health: 'health_v1',
    telemetry: 'telemetry_v1', restore: 'restore_result_v1', verify_restore: 'restore_verification_v1',
  };
  for (const [id, contract] of Object.entries(contracts)) validateCommand(manifest.commands?.[id], id, contract);
  for (const [id, tokens] of Object.entries({ A: 65536, B: 131072, C: 262144 })) {
    const arm = manifest.arms?.[id];
    assertKeys(arm, ['id', 'server_context_tokens', 'hermes_context_tokens', 'compression'], `arms.${id}`);
    if (arm.id !== id || arm.server_context_tokens !== tokens || arm.hermes_context_tokens !== tokens) fail(`arms.${id} mismatch`);
  }
  return manifest;
}

function verifyFrozenArtifacts(packet, taskPacket) {
  if (taskPacket.artifact_path_base !== 'repository-root') fail('unsupported artifact_path_base');
  for (const [id, item] of Object.entries(taskPacket.artifacts)) {
    const file = path.resolve(repoRoot, item.path);
    if (!fs.existsSync(file)) fail(`missing artifact ${id}: ${item.path}`);
    if (sha256(fs.readFileSync(file)) !== item.sha256) fail(`artifact hash drift: ${id}`);
  }
  if (sha256(fs.readFileSync(packetManifestPath)) !== taskPacket.packet.manifest_sha256) fail('packet-manifest hash drift');
  if (packet.packet.sha256 !== taskPacket.packet.packet_sha256 || packet.packet.total_tokens !== 205080 || packet.delivery.chunk_count !== 53) fail('packet identity mismatch');
  let reconstructed = Buffer.alloc(0);
  for (const chunk of packet.delivery.chunks) {
    const file = path.join(generatedChunksRoot, chunk.filename);
    if (!fs.existsSync(file)) fail(`missing generated chunk ${chunk.filename}; run render-context-packet.mjs first`);
    const body = fs.readFileSync(file);
    if (sha256(body) !== chunk.sha256) fail(`chunk hash drift: ${chunk.filename}`);
    reconstructed = Buffer.concat([reconstructed, body]);
  }
  if (sha256(reconstructed) !== packet.packet.sha256) fail('reconstructed packet hash drift');
}

function commandEnv(command, extra) {
  const env = { ...process.env, ...extra };
  for (const [logical, variable] of Object.entries(command.env || {})) {
    if (!(variable in process.env)) fail(`missing environment variable ${variable} for ${logical}`);
    env[variable] = process.env[variable];
  }
  return env;
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function processGroupExists(pid) {
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function terminateProcessGroup(pid) {
  const signal = name => {
    try { process.kill(process.platform === 'win32' ? pid : -pid, name); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  signal('SIGTERM');
  for (let attempt = 0; attempt < 50 && processGroupExists(pid); attempt += 1) await delay(100);
  if (processGroupExists(pid)) signal('SIGKILL');
  for (let attempt = 0; attempt < 20 && processGroupExists(pid); attempt += 1) await delay(100);
  if (processGroupExists(pid)) fail(`timed-out process group ${pid} could not be contained`);
}

async function runCommand(command, id, extraEnv = {}) {
  const started = Date.now();
  return await new Promise((resolve, reject) => {
    const child = spawn(command.argv[0], command.argv.slice(1), {
      cwd: command.cwd || repoRoot, env: commandEnv(command, extraEnv), stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '', stderr = '', timedOut = false, terminationPromise = null;
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    const timer = setTimeout(() => {
      timedOut = true;
      terminationPromise = terminateProcessGroup(child.pid);
    }, command.timeout_ms);
    child.on('error', reject);
    child.on('close', async code => {
      clearTimeout(timer);
      if (timedOut) {
        try { await terminationPromise; }
        catch (error) { return reject(error); }
        return reject(new Error(`${id} timed out after ${command.timeout_ms}ms`));
      }
      if (code !== 0) {
        const error = new Error(`${id} exited ${code}: ${stderr.trim()}`);
        Object.assign(error, { exitCode: code, stdout, stderr });
        return reject(error);
      }
      let value;
      try { value = JSON.parse(stdout); } catch { return reject(new Error(`${id} returned invalid JSON`)); }
      resolve({ value, wallTimeMs: Date.now() - started, stderr });
    });
  });
}

function validateOutput(id, value) {
  const required = {
    discover_model: ['model_id', 'quant', 'runtime_build'], discover_hermes: ['identifier', 'provider_id', 'endpoint_identifier'],
    query_server_context: ['context_tokens'], query_hermes_context: ['context_tokens'], query_compression: ['enabled', 'trigger_tokens'],
    snapshot: ['snapshot_id', 'targets'], configure_arm: ['ok'], start: ['ok'], stop: ['ok'], restart: ['ok'], health: ['healthy'],
    telemetry: ['latency_ms', 'peak_memory_bytes', 'swap_bytes', 'tool_call_count', 'system_total_memory_bytes', 'system_peak_used_memory_bytes', 'system_minimum_available_memory_bytes', 'model_server_peak_rss_bytes', 'hermes_peak_rss_bytes', 'model_call_count'], restore: ['ok', 'snapshot_id'],
    verify_restore: ['ok', 'targets'], execute_turn: ['session_id', 'requested_session_id', 'fresh_session', 'resumed', 'lineage_continuous', 'response', 'confirmed_stopped', 'input_tokens', 'model_calls', 'tool_calls', 'compaction_count', 'compaction_time_ms', 'unexpected_truncation_detected'],
  }[id];
  assertKeys(value, required, `${id} output`);
  return value;
}

async function invoke(manifest, id, env = {}) {
  const value = validateOutput(id, (await runCommand(manifest.commands[id], id, env)).value);
  const contractId = manifest.commands[id].output_contract.contract_id;
  const outputSchema = manifestSchema?.$defs?.output_shapes?.properties?.[contractId];
  if (!outputSchema) fail(`missing output schema for ${contractId}`);
  validateSchema(value, outputSchema, manifestSchema, `${id} output`);
  return value;
}

function identityEqual(expected, observed) {
  return expected.model_id === observed.model_id && expected.quant === observed.quant && expected.runtime_build === observed.runtime_build;
}

function stageWorkspace(runId) {
  if (!/^[a-z0-9][a-z0-9._-]{0,95}$/i.test(runId)) fail('run_id must be a safe 1-96 character name');
  const runRoot = path.join(runsRoot, runId);
  if (!runRoot.startsWith(`${runsRoot}${path.sep}`)) fail('run_id escapes runs root');
  const workspace = path.join(runRoot, 'workspace');
  if (fs.existsSync(runRoot)) fail(`run directory already exists: ${runRoot}`);
  fs.mkdirSync(path.join(workspace, 'recognizers'), { recursive: true });
  fs.copyFileSync(path.join(fixtureRoot, 'starter/recognizers/change-approval-recognizer.mjs'), path.join(workspace, 'recognizers/change-approval-recognizer.mjs'));
  return { runRoot, workspace };
}

function workspaceHashes(workspace) {
  const found = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else found.push({ path: path.relative(workspace, absolute), sha256: sha256(fs.readFileSync(absolute)) });
    }
  };
  walk(workspace);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function stageDeliveryQuery(runRoot, packet, chunk) {
  const final = chunk.index === packet.delivery.chunk_count;
  const template = final ? packet.delivery.final_instruction_template : packet.delivery.context_instruction_template;
  if (typeof template !== 'string' || !template.includes('{{payload}}')) fail('frozen delivery template is invalid');
  const payload = fs.readFileSync(path.join(generatedChunksRoot, chunk.filename), 'utf8');
  const body = template
    .replaceAll('{{chunk_index}}', String(chunk.index))
    .replaceAll('{{chunk_count}}', String(packet.delivery.chunk_count))
    .replace('{{payload}}', payload);
  const directory = path.join(runRoot, 'delivery');
  fs.mkdirSync(directory, { recursive: true });
  const queryFile = path.join(directory, chunk.filename);
  fs.writeFileSync(queryFile, body);
  return queryFile;
}

async function runVerifier(workspace) {
  const command = { argv: [process.execPath, path.join(fixtureRoot, 'verify.mjs'), workspace], timeout_ms: 60000, output_contract: { format: 'json', contract_id: 'fixture_verification_v1' } };
  try {
    const result = await runCommand(command, 'external_verify');
    return { exitCode: 0, report: result.value };
  } catch (error) {
    if (!Number.isInteger(error.exitCode)) throw error;
    try { return { exitCode: error.exitCode, report: JSON.parse(error.stdout) }; }
    catch { throw new Error('external verifier returned invalid JSON'); }
  }
}

async function waitForHealthy(manifest, env, label, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  do {
    if ((await invoke(manifest, 'health', env)).healthy) return;
    if (Date.now() >= deadline) break;
    await delay(2000);
  } while (true);
  fail(`${label} remained unhealthy for ${timeoutMs}ms`);
}

async function preflight(manifest, packet, taskPacket) {
  verifyFrozenArtifacts(packet, taskPacket);
  const observedModel = await invoke(manifest, 'discover_model');
  if (!identityEqual(manifest.expected_model, observedModel)) fail(`model drift: ${JSON.stringify(observedModel)}`);
  const observedHermes = await invoke(manifest, 'discover_hermes');
  for (const key of ['identifier', 'provider_id', 'endpoint_identifier']) if (observedHermes[key] !== manifest.hermes_profile[key]) fail(`Hermes drift: ${key}`);
  return { observedModel, observedHermes };
}

function validateFrozenLimits(manifest, taskPacket, acceptance) {
  const turnTimeout = manifest.commands.execute_turn.timeout_ms;
  if (turnTimeout > taskPacket.execution.task_process_deadline_ms || turnTimeout > taskPacket.correction.deadline_ms) fail('execute-turn timeout exceeds frozen task/correction deadlines');
  if (acceptance.maximum_task_wall_time_ms < turnTimeout || acceptance.maximum_correction_wall_time_ms !== taskPacket.correction.deadline_ms) fail('acceptance deadlines differ from frozen execution limits');
}

async function executeRun(args, manifest, packet, taskPacket, acceptance, evidenceSchema) {
  const armId = args.arm;
  if (!['A', 'B', 'C'].includes(armId)) fail('--arm A|B|C is required in run mode');
  const phase = args.phase || 'exploratory';
  if (!['exploratory', 'confirmation'].includes(phase)) fail('invalid --phase');
  const sequencePosition = Number(args.sequence_position || 1);
  if (!Number.isInteger(sequencePosition) || sequencePosition < 1) fail('invalid --sequence-position');
  const runId = args.run_id || `${phase}-${armId}-${Date.now()}`;
  const pre = await preflight(manifest, packet, taskPacket);
  const baselineServer = await invoke(manifest, 'query_server_context');
  const baselineHermes = await invoke(manifest, 'query_hermes_context');
  const baselineCompression = await invoke(manifest, 'query_compression');
  const { runRoot, workspace } = stageWorkspace(runId);
  const initialHashes = workspaceHashes(workspace);
  let snapshot, restoration = { attempted: false, verified: false, snapshot_id: '', target_hashes_match: false };
  let failure;
  try {
    snapshot = await invoke(manifest, 'snapshot');
    const declaredSnapshotTargets = [...manifest.snapshot_restore.snapshot_targets].sort();
    const observedSnapshotTargets = snapshot.targets.map(item => item.path).sort();
    if (JSON.stringify(observedSnapshotTargets) !== JSON.stringify(declaredSnapshotTargets)) fail('snapshot targets differ from manifest declaration');
    const arm = manifest.arms[armId];
    const armEnv = {
      CONTEXT_CAPACITY_ARM_ID: armId,
      CONTEXT_CAPACITY_SERVER_TOKENS: String(arm.server_context_tokens),
      CONTEXT_CAPACITY_HERMES_TOKENS: String(arm.hermes_context_tokens),
      CONTEXT_CAPACITY_COMPRESSION_ENABLED: String(arm.compression.enabled),
      CONTEXT_CAPACITY_COMPRESSION_TRIGGER_TOKENS: String(arm.compression.trigger_tokens),
      CONTEXT_CAPACITY_SNAPSHOT_ID: snapshot.snapshot_id,
    };
    if (!(await invoke(manifest, 'configure_arm', armEnv)).ok) fail('configure_arm returned ok=false');
    if (!(await invoke(manifest, 'restart', armEnv)).ok) fail('restart returned ok=false');
    await waitForHealthy(manifest, armEnv, 'configured runtime');
    const server = await invoke(manifest, 'query_server_context', armEnv);
    const hermes = await invoke(manifest, 'query_hermes_context', armEnv);
    const compression = await invoke(manifest, 'query_compression', armEnv);
    if (server.context_tokens !== arm.server_context_tokens || hermes.context_tokens !== arm.hermes_context_tokens) fail('observed context differs from configured arm');
    if (compression.enabled !== arm.compression.enabled || compression.trigger_tokens !== arm.compression.trigger_tokens) fail('observed compression differs from configured arm');

    let sessionId = null, largestInput = 0, finalInput = 0, finalResponse = '', modelCalls = 0, toolCalls = 0, compactionCount = 0, compactionTimeMs = 0, evictionEvidence = null;
    const turnRecords = [];
    for (const chunk of packet.delivery.chunks) {
      const queryFile = stageDeliveryQuery(runRoot, packet, chunk);
      const result = await invoke(manifest, 'execute_turn', {
        ...armEnv,
        CONTEXT_CAPACITY_QUERY_FILE: queryFile,
        CONTEXT_CAPACITY_WORKSPACE: workspace,
        CONTEXT_CAPACITY_EXPECTED_ACK: packet.delivery.acknowledgement,
        CONTEXT_CAPACITY_CHUNK_INDEX: String(chunk.index),
        CONTEXT_CAPACITY_SESSION_ID: sessionId || '',
      });
      if (!result.confirmed_stopped) fail(`chunk ${chunk.index} process not confirmed stopped`);
      if (result.unexpected_truncation_detected) fail(`chunk ${chunk.index} reported unexpected truncation`);
      if (chunk.index === 1) {
        if (result.requested_session_id !== null || !result.fresh_session || result.resumed) fail('chunk 1 did not create one fresh session');
        sessionId = result.session_id;
      } else if (result.requested_session_id !== sessionId || result.fresh_session || !result.resumed || !result.lineage_continuous) fail(`chunk ${chunk.index} did not resume the exact logical session lineage`);
      sessionId = result.session_id;
      if (chunk.index < packet.delivery.chunk_count && result.response.trim() !== packet.delivery.acknowledgement) fail(`chunk ${chunk.index} acknowledgement mismatch`);
      if (result.input_tokens + packet.targets.reserved_output_headroom_tokens > arm.server_context_tokens) fail(`chunk ${chunk.index} violated output headroom`);
      largestInput = Math.max(largestInput, result.input_tokens);
      finalInput = result.input_tokens;
      finalResponse = result.response;
      modelCalls += result.model_calls; toolCalls += result.tool_calls;
      compactionCount += result.compaction_count;
      if (result.compaction_count > 0 && result.compaction_time_ms === null) compactionTimeMs = null;
      else if (compactionTimeMs !== null) compactionTimeMs += result.compaction_time_ms || 0;
      if (result.eviction_evidence) evictionEvidence = result.eviction_evidence;
      turnRecords.push({ chunk: chunk.index, session_id: result.session_id, input_tokens: result.input_tokens, response_sha256: sha256(result.response), confirmed_stopped: true });
    }
    if (armId === 'B' && largestInput <= 65536) fail('arm B eligibility not observed');
    if (armId === 'C' && largestInput <= 131072) fail('arm C eligibility not observed');

    const verification = await runVerifier(workspace);
    const finalHashes = workspaceHashes(workspace);
    const unexpectedPaths = finalHashes.map(x => x.path).filter(p => p !== 'recognizers/change-approval-recognizer.mjs');
    let telemetry = await invoke(manifest, 'telemetry', armEnv);
    const requiredIds = Object.values(taskPacket.required_groups).flat();
    const observedAssertionIds = verification.report.assertions.map(x => x.id);
    if (JSON.stringify(observedAssertionIds) !== JSON.stringify(requiredIds)) fail('verifier assertion IDs/order drifted from frozen task packet');
    for (const [group, ids] of Object.entries(taskPacket.required_groups)) {
      const score = verification.report.groups?.[group];
      if (!score || score.total !== ids.length) fail(`verifier group ${group} count drifted`);
    }
    const passedIds = verification.report.assertions.filter(x => x.passed).map(x => x.id);
    const changedPaths = finalHashes.filter(x => initialHashes.find(y => y.path === x.path)?.sha256 !== x.sha256).map(x => x.path);
    const completionMatches = finalResponse.trim().length > 0 && changedPaths.length === 1 && changedPaths[0] === 'recognizers/change-approval-recognizer.mjs' && !/(?:unable|could(?: not|n't)|did not|no changes|failed to)/i.test(finalResponse);
    const retentionRate = passedIds.length / requiredIds.length;
    const firstPassAccepted = verification.exitCode === 0 && unexpectedPaths.length === 0 && completionMatches && retentionRate >= acceptance.minimum_requirement_retention_rate;
    const safetyReasons = current => {
      const reasons = [];
      const utilization = current.system_total_memory_bytes > 0 ? current.system_peak_used_memory_bytes / current.system_total_memory_bytes : 1;
      if (current.swap_bytes > acceptance.maximum_swap_growth_bytes_per_run) reasons.push('swap_growth');
      if (current.system_minimum_available_memory_bytes < acceptance.minimum_system_available_memory_bytes) reasons.push('minimum_available_memory');
      if (utilization > acceptance.maximum_system_memory_utilization_rate) reasons.push('memory_utilization');
      if (current.latency_ms > acceptance.maximum_task_wall_time_ms) reasons.push('task_wall_time');
      return reasons;
    };
    let invalidReasons = safetyReasons(telemetry);
    let correction = null;
    if (!firstPassAccepted && invalidReasons.length === 0) {
      const correctionText = taskPacket.correction.template
        .replace('{{failed_assertion_ids}}', JSON.stringify(requiredIds.filter(id => !passedIds.includes(id))))
        .replace('{{unexpected_paths}}', JSON.stringify(unexpectedPaths));
      const correctionFile = path.join(runRoot, 'correction-prompt.txt');
      fs.writeFileSync(correctionFile, `${correctionText}\n`);
      const correctionStarted = Date.now();
      const correctedTurn = await invoke(manifest, 'execute_turn', {
        ...armEnv, CONTEXT_CAPACITY_QUERY_FILE: correctionFile, CONTEXT_CAPACITY_WORKSPACE: workspace,
        CONTEXT_CAPACITY_EXPECTED_ACK: '', CONTEXT_CAPACITY_CHUNK_INDEX: '54', CONTEXT_CAPACITY_SESSION_ID: '',
      });
      if (!correctedTurn.confirmed_stopped || correctedTurn.requested_session_id !== null || !correctedTurn.fresh_session || correctedTurn.resumed || !correctedTurn.lineage_continuous) fail('diagnostic correction did not use one fresh stopped session');
      const correctedVerification = await runVerifier(workspace);
      fs.writeFileSync(path.join(runRoot, 'correction-verification.json'), `${JSON.stringify(correctedVerification, null, 2)}\n`);
      correction = { attempted: true, accepted: correctedVerification.exitCode === 0, wall_time_ms: Date.now() - correctionStarted };
      telemetry = await invoke(manifest, 'telemetry', armEnv);
      invalidReasons = safetyReasons(telemetry);
    }
    if (correction && correction.wall_time_ms > acceptance.maximum_correction_wall_time_ms) invalidReasons.push('correction_wall_time');
    const validRun = invalidReasons.length === 0;
    const evidence = {
      schema_version: '1.0.0', experiment_id: taskPacket.experiment_id, run_id: runId, fixture_id: taskPacket.fixture_id,
      packet_layout: 'fixed-distributed-205080', phase, arm: armId, sequence_position: sequencePosition,
      artifact_hashes: Object.fromEntries(Object.entries(taskPacket.artifacts).map(([k, v]) => [k, v.sha256])),
      expected_identity: { ...manifest.expected_model, hermes_profile: manifest.hermes_profile.identifier, provider_id: manifest.hermes_profile.provider_id, endpoint_identifier: manifest.hermes_profile.endpoint_identifier },
      observed_identity: { ...pre.observedModel, hermes_profile: pre.observedHermes.identifier, provider_id: pre.observedHermes.provider_id, endpoint_identifier: pre.observedHermes.endpoint_identifier },
      context: { configured_server_tokens: arm.server_context_tokens, observed_server_tokens: server.context_tokens, configured_hermes_tokens: arm.hermes_context_tokens, observed_hermes_tokens: hermes.context_tokens, cumulative_delivered_tokens: packet.packet.total_tokens, largest_model_input_tokens: largestInput, final_model_input_tokens: finalInput, headroom_tokens: packet.targets.reserved_output_headroom_tokens, observed_effective_context_tokens: largestInput, compression_enabled: compression.enabled, compression_trigger_tokens: compression.trigger_tokens, compaction_count: compactionCount, compaction_time_ms: compactionTimeMs, eviction_evidence: evictionEvidence, zone_offsets: { EARLY: 20000, MIDDLE: 90000, LATE: 150000, TASK: 205000 }, rendered_packet_sha256: packet.packet.sha256, chunk_count: packet.delivery.chunk_count, chunks_verified: true, tokenizer_id: packet.tokenizer.id, tokenizer_version: packet.tokenizer.version, unexpected_truncation_detected: false },
      process: { exit_code: 0, confirmed_stopped: true, timed_out: false, crashed: false, oom: false },
      retention: { required_ids: requiredIds, observed_ids: passedIds, rate: retentionRate, groups: verification.report.groups },
      verification: { command_id: 'integration-fixture-verify', exit_code: verification.exitCode, assertion_ids: requiredIds, passed_assertion_ids: passedIds, assertion_results: verification.report.assertions.map(({ id, passed, detail }) => ({ id, passed, detail })), verified_files: finalHashes },
      completion: { prose: finalResponse, matches_file_state: completionMatches },
      scope: { changed_paths: changedPaths, unexpected_paths: unexpectedPaths },
      telemetry: { wall_time_ms: telemetry.latency_ms, system_total_memory_bytes: telemetry.system_total_memory_bytes, system_peak_used_memory_bytes: telemetry.system_peak_used_memory_bytes, system_minimum_available_memory_bytes: telemetry.system_minimum_available_memory_bytes, model_server_peak_rss_bytes: telemetry.model_server_peak_rss_bytes, hermes_peak_rss_bytes: telemetry.hermes_peak_rss_bytes, swap_growth_bytes: telemetry.swap_bytes, tool_call_count: toolCalls || telemetry.tool_call_count, model_call_count: modelCalls },
      restoration, first_pass_accepted: firstPassAccepted, valid_run: validRun, correction, invalid_reason: invalidReasons.length ? invalidReasons.join(',') : null,
    };
    fs.writeFileSync(path.join(runRoot, 'turns.json'), `${JSON.stringify(turnRecords, null, 2)}\n`);
    fs.writeFileSync(path.join(runRoot, 'evidence.pending-restoration.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    return { evidence, runRoot };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (snapshot) {
      restoration.attempted = true; restoration.snapshot_id = snapshot.snapshot_id;
      try {
        const env = { CONTEXT_CAPACITY_SNAPSHOT_ID: snapshot.snapshot_id };
        const restored = await invoke(manifest, 'restore', env);
        if (!(await invoke(manifest, 'restart', env)).ok) fail('restart after restore returned ok=false');
        await waitForHealthy(manifest, env, 'restored runtime');
        const restoredServer = await invoke(manifest, 'query_server_context', env);
        const restoredHermes = await invoke(manifest, 'query_hermes_context', env);
        const restoredCompression = await invoke(manifest, 'query_compression', env);
        if (restoredServer.context_tokens !== baselineServer.context_tokens || restoredHermes.context_tokens !== baselineHermes.context_tokens || restoredCompression.enabled !== baselineCompression.enabled || restoredCompression.trigger_tokens !== baselineCompression.trigger_tokens) fail('active runtime values differ from captured baseline after restore');
        const verified = await invoke(manifest, 'verify_restore', env);
        restoration.verified = restored.ok && verified.ok;
        restoration.target_hashes_match = verified.targets.every(x => x.matches && x.expected_sha256 === x.observed_sha256);
        if (!restoration.verified || !restoration.target_hashes_match) fail('baseline restoration verification failed');
      } catch (restoreError) {
        if (failure) failure.message += `; RESTORE FAILED: ${restoreError.message}`;
        else throw restoreError;
      }
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const manifestSchema = readJson(manifestSchemaPath);
const manifest = validateManifest(readJson(path.resolve(args.manifest)));
validateSchema(manifest, manifestSchema);
const packet = readJson(packetManifestPath);
const taskPacket = readJson(taskPacketPath);
const acceptance = readJson(acceptancePath);
const evidenceSchema = readJson(evidenceSchemaPath);

try {
  validateFrozenLimits(manifest, taskPacket, acceptance);
  if (args.mode === 'preflight') {
    const result = await preflight(manifest, packet, taskPacket);
    console.log(JSON.stringify({ status: 'PREFLIGHT_OK', ...result }, null, 2));
  } else {
    const result = await executeRun(args, manifest, packet, taskPacket, acceptance, evidenceSchema);
    result.evidence.restoration = { ...result.evidence.restoration };
    validateSchema(result.evidence, evidenceSchema);
    fs.writeFileSync(path.join(result.runRoot, 'evidence.json'), `${JSON.stringify(result.evidence, null, 2)}\n`);
    console.log(JSON.stringify({ status: result.evidence.valid_run ? 'RUN_RECORDED' : 'RUN_INVALID', first_pass_accepted: result.evidence.first_pass_accepted, run_id: result.evidence.run_id, evidence: path.join(result.runRoot, 'evidence.json') }, null, 2));
    if (!result.evidence.valid_run) process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'BLOCKED', error: error.message }, null, 2));
  process.exitCode = 1;
}
