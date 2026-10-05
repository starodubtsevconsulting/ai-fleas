#!/usr/bin/env node
/**
 * Normalizes machine-specific Hermes/GX10 operations for the context-capacity runner.
 * Caller: only manifest-declared commands in run-context-capacity.mjs.
 * Invocation: node runtime-adapter.mjs COMMAND --profile NAME --ssh-host HOST
 *   --service SERVICE --remote-url URL --remote-dropin PATH --model-id ID --quant QUANT.
 * Inputs/outputs: command arguments plus CONTEXT_CAPACITY_* environment variables;
 * emits exactly one JSON contract on stdout. Effects vary by COMMAND: discovery/query
 * commands are read-only; snapshot writes ignored local recovery evidence; configure-arm
 * updates the named Hermes profile and exact remote systemd drop-in; lifecycle commands
 * control only the named service; execute-turn runs one stopped Hermes CLI turn; restore
 * restores the captured local/remote bytes. It never selects targets implicitly.
 */
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const command = args.shift();
const options = {};
for (let index = 0; index < args.length; index += 2) {
  if (!args[index]?.startsWith('--') || args[index + 1] === undefined) throw new Error(`invalid argument ${args[index] || ''}`);
  options[args[index].slice(2)] = args[index + 1];
}
const required = (...keys) => keys.forEach(key => { if (!options[key]) throw new Error(`--${key} is required`); });
const output = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const snapshotsRoot = path.join(repoRoot, 'notes/benchmarks/local-models/runs/context-capacity-runtime-snapshots');

function run(argv, { input, allow = [0] } = {}) {
  const result = spawnSync(argv[0], argv.slice(1), { input, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (!allow.includes(result.status)) throw new Error(`${argv[0]} exited ${result.status}: ${(result.stderr || '').trim()}`);
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}
const ssh = (script, input) => run(['ssh', options['ssh-host'], 'bash', '-s'], { input: `${script}\n${input || ''}` }).stdout;
const sshDirect = (argv, input) => run(['ssh', options['ssh-host'], ...argv], { input }).stdout;
const hermes = (...rest) => run([options['hermes-bin'] || 'hermes', '-p', options.profile, ...rest]).stdout.trim();
const configPath = () => hermes('config', 'path');
const snapshotDirectory = id => path.join(snapshotsRoot, id);

function readRemoteFile(remotePath) {
  const encoded = ssh(`p=${JSON.stringify(remotePath)}; if [[ -f "$p" ]]; then printf '1\\n'; base64 -w0 "$p"; else printf '0\\n'; fi`);
  const [exists, body = ''] = encoded.split('\n');
  return { exists: exists === '1', bytes: exists === '1' ? Buffer.from(body.trim(), 'base64') : Buffer.alloc(0) };
}

function writeRemoteFile(remotePath, bytes) {
  const encoded = bytes.toString('base64');
  ssh(`set -e; p=${JSON.stringify(remotePath)}; mkdir -p "$(dirname "$p")"; base64 -d > "$p"`, encoded);
}

function serviceExecStart() {
  required('ssh-host', 'service');
  const text = ssh(`systemctl --user cat ${JSON.stringify(options.service)}`);
  const matches = [...text.matchAll(/^ExecStart=(.+)$/gm)];
  if (!matches.length) throw new Error('service has no ExecStart');
  return matches.at(-1)[1];
}

function metricsPath(snapshotId) { return path.join(snapshotDirectory(snapshotId), 'metrics.json'); }
function readMetrics(snapshotId) {
  const file = metricsPath(snapshotId);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { systemPeakUsed: 0, systemMinimumAvailable: Number.MAX_SAFE_INTEGER, modelPeakRss: 0, hermesPeakRss: 0, swapStart: 0, swapPeak: 0, wallTimeMs: 0 };
}
function writeMetrics(snapshotId, value) { fs.writeFileSync(metricsPath(snapshotId), `${JSON.stringify(value, null, 2)}\n`); }

function remoteMemorySample() {
  required('ssh-host');
  const raw = ssh(`set -e
read total used free shared buff available < <(free -b | awk '/^Mem:/ {print $2,$3,$4,$5,$6,$7}')
swap=$(free -b | awk '/^Swap:/ {print $3}')
rss=$(ps -C llama-server -o rss= | awk '{s+=$1} END {printf "%.0f",s*1024}')
printf '%s %s %s %s\\n' "$total" "$used" "$available" "\${rss:-0}"; printf '%s\\n' "\${swap:-0}"`);
  const numbers = raw.trim().split(/\s+/).map(Number);
  return { total: numbers[0], used: numbers[1], available: numbers[2], modelRss: numbers[3], swap: numbers[4] };
}

function sqliteScalar(db, sql) {
  const value = run(['sqlite3', db, sql]).stdout.trim();
  return Number(value || 0);
}

function logicalSessionStats(sessionId) {
  if (!sessionId) return { apiCalls: 0, compacted: 0 };
  const db = path.join(path.dirname(configPath()), 'state.db');
  const safe = sessionId.replaceAll("'", "''");
  const lineage = `WITH RECURSIVE
ancestors(id,parent_session_id) AS (
  SELECT id,parent_session_id FROM sessions WHERE id='${safe}'
  UNION ALL
  SELECT s.id,s.parent_session_id FROM sessions s JOIN ancestors a ON a.parent_session_id=s.id
),
lineage(id) AS (
  SELECT id FROM ancestors
  UNION
  SELECT s.id FROM sessions s JOIN lineage l ON s.parent_session_id=l.id
)`;
  return {
    apiCalls: sqliteScalar(db, `${lineage} SELECT COALESCE(SUM(api_call_count),0) FROM sessions WHERE id IN lineage;`),
    compacted: sqliteScalar(db, `${lineage} SELECT COUNT(*) FROM messages WHERE session_id IN lineage AND compacted=1;`),
  };
}

function isContinuousLineage(requestedSessionId, resultingSessionId) {
  if (!requestedSessionId) return Boolean(resultingSessionId);
  if (!resultingSessionId) return false;
  const db = path.join(path.dirname(configPath()), 'state.db');
  const requested = requestedSessionId.replaceAll("'", "''");
  const resulting = resultingSessionId.replaceAll("'", "''");
  const sql = `WITH RECURSIVE ancestors(id,parent_session_id) AS (
    SELECT id,parent_session_id FROM sessions WHERE id='${resulting}'
    UNION ALL
    SELECT s.id,s.parent_session_id FROM sessions s JOIN ancestors a ON a.parent_session_id=s.id
  ) SELECT COUNT(*) FROM ancestors WHERE id='${requested}';`;
  return sqliteScalar(db, sql) > 0;
}

async function executeTurn() {
  required('profile');
  const queryFile = process.env.CONTEXT_CAPACITY_QUERY_FILE;
  const workspace = process.env.CONTEXT_CAPACITY_WORKSPACE;
  const requested = process.env.CONTEXT_CAPACITY_SESSION_ID || null;
  const snapshotId = process.env.CONTEXT_CAPACITY_SNAPSHOT_ID;
  if (!queryFile || !workspace || !snapshotId) throw new Error('execute-turn environment is incomplete');
  const before = logicalSessionStats(requested);
  const argv = ['-p', options.profile, 'chat', '--query-file', queryFile, '--oneshot', '--format', 'stream-json', '--source', 'tool', '--in', workspace, '-t', 'file', '--max-turns', options['max-turns'] || '20', '--run-budget', options['run-budget'] || '180'];
  if (requested) argv.push('--resume', requested, '--no-restore-cwd');
  const started = Date.now();
  const child = spawn(options['hermes-bin'] || 'hermes', argv, {
    cwd: workspace, env: { ...process.env, HERMES_WRITE_SAFE_ROOT: workspace }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', hermesPeakRss = 0;
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const metrics = readMetrics(snapshotId);
  const sample = () => {
    try {
      const local = run(['ps', '-o', 'rss=', '-p', String(child.pid)]).stdout.trim();
      hermesPeakRss = Math.max(hermesPeakRss, Number(local || 0) * 1024);
      const remote = remoteMemorySample();
      metrics.systemPeakUsed = Math.max(metrics.systemPeakUsed, remote.used);
      metrics.systemMinimumAvailable = Math.min(metrics.systemMinimumAvailable, remote.available);
      metrics.modelPeakRss = Math.max(metrics.modelPeakRss, remote.modelRss);
      metrics.swapPeak = Math.max(metrics.swapPeak, remote.swap);
    } catch {}
  };
  sample();
  const interval = setInterval(sample, 500);
  const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  clearInterval(interval); sample();
  metrics.hermesPeakRss = Math.max(metrics.hermesPeakRss, hermesPeakRss);
  metrics.wallTimeMs += Date.now() - started;
  writeMetrics(snapshotId, metrics);
  const events = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '').trim();
    if (!line || !line.startsWith('{')) continue;
    try { events.push(JSON.parse(line)); }
    catch (error) { throw new Error(`Hermes emitted malformed stream JSON: ${error.message}`); }
  }
  const result = events.findLast(event => event.type === 'result');
  if (!result || exitCode !== 0 || result.exit_code !== 0) throw new Error(`Hermes turn failed (${exitCode}): ${stderr.trim()}`);
  const sessionId = result.session_id;
  const after = logicalSessionStats(sessionId);
  output({
    session_id: sessionId, requested_session_id: requested, fresh_session: !requested, resumed: Boolean(requested),
    lineage_continuous: isContinuousLineage(requested, sessionId),
    response: result.text || '', confirmed_stopped: true, input_tokens: result.tokens?.input || 0,
    model_calls: Math.max(0, after.apiCalls - before.apiCalls),
    tool_calls: events.filter(event => event.type === 'tool_use').length,
    compaction_count: Math.max(0, after.compacted - before.compacted), compaction_time_ms: after.compacted > before.compacted ? null : 0,
    eviction_evidence: after.compacted > before.compacted ? `compacted_messages:${after.compacted - before.compacted}` : null,
    unexpected_truncation_detected: /truncat|context length exceeded|too many tokens/i.test(stderr),
  });
}

async function main() {
  if (command === 'discover-model') {
    required('ssh-host', 'remote-url', 'model-id');
    const models = JSON.parse(ssh(`curl -fsS ${JSON.stringify(`${options['remote-url']}/v1/models`)}`));
    const model = models.data?.find(item => item.id === options['model-id']);
    if (!model) throw new Error('expected model absent');
    const observed = ssh(`pid=$(pgrep -n -x llama-server); printf '%s\\n' "$(tr '\\0' ' ' < /proc/$pid/cmdline)"; exe=$(readlink -f /proc/$pid/exe); "$exe" --version 2>&1 | head -1`).trim().split('\n');
    const commandLine = observed[0] || ''; const version = observed.at(-1) || '';
    if (!/Qwen3-Coder-Next-Q5_K_M/i.test(commandLine) || model.meta?.ftype !== 'Q5_K - Medium') throw new Error('active model artifact/quantization could not be verified as Qwen3-Coder-Next Q5_K_M');
    output({ model_id: 'Qwen3-Coder-Next', quant: 'Q5_K_M', runtime_build: version });
  } else if (command === 'discover-hermes') {
    required('profile');
    const observedConfig = configPath();
    output({
      identifier: path.basename(path.dirname(observedConfig)),
      provider_id: hermes('config', 'get', 'model.provider'),
      endpoint_identifier: hermes('config', 'get', 'model.base_url'),
    });
  } else if (command === 'query-server-context') {
    required('remote-url', 'model-id');
    const models = JSON.parse(ssh(`curl -fsS ${JSON.stringify(`${options['remote-url']}/v1/models`)}`));
    const model = models.data?.find(item => item.id === options['model-id']);
    output({ context_tokens: Number(model?.meta?.n_ctx || 0) });
  } else if (command === 'query-hermes-context') {
    required('profile'); output({ context_tokens: Number(hermes('config', 'get', 'model.context_length')) });
  } else if (command === 'query-compression') {
    required('profile');
    const threshold = Number(hermes('config', 'get', 'compression.threshold'));
    const context = Number(hermes('config', 'get', 'model.context_length'));
    output({ enabled: threshold > 0, trigger_tokens: Math.round(threshold * context) });
  } else if (command === 'snapshot') {
    required('profile', 'ssh-host', 'remote-dropin');
    const id = `snapshot-${Date.now()}-${randomUUID()}`;
    const directory = snapshotDirectory(id); fs.mkdirSync(directory, { recursive: true });
    const localPath = configPath(); const localBytes = fs.readFileSync(localPath); const remote = readRemoteFile(options['remote-dropin']);
    fs.writeFileSync(path.join(directory, 'hermes-config.yaml'), localBytes);
    fs.writeFileSync(path.join(directory, 'remote-dropin.bin'), remote.bytes);
    fs.writeFileSync(path.join(directory, 'metadata.json'), `${JSON.stringify({ localPath, remotePath: options['remote-dropin'], remoteExisted: remote.exists }, null, 2)}\n`);
    const memory = remoteMemorySample(); writeMetrics(id, { systemPeakUsed: memory.used, systemMinimumAvailable: memory.available, modelPeakRss: memory.modelRss, hermesPeakRss: 0, swapStart: memory.swap, swapPeak: memory.swap, wallTimeMs: 0 });
    output({ snapshot_id: id, targets: [{ path: localPath, sha256: sha256(localBytes) }, { path: `/ssh/${options['ssh-host']}${options['remote-dropin']}`, sha256: sha256(remote.bytes) }] });
  } else if (command === 'configure-arm') {
    required('profile', 'ssh-host', 'service', 'remote-dropin');
    const tokens = Number(process.env.CONTEXT_CAPACITY_SERVER_TOKENS);
    const hermesTokens = Number(process.env.CONTEXT_CAPACITY_HERMES_TOKENS);
    const trigger = Number(process.env.CONTEXT_CAPACITY_COMPRESSION_TRIGGER_TOKENS);
    const threshold = trigger / hermesTokens;
    if (![65536, 131072, 262144].includes(tokens) || tokens !== hermesTokens || !(threshold > 0 && threshold < 1)) throw new Error('invalid arm environment');
    hermes('config', 'set', 'model.context_length', String(hermesTokens));
    hermes('config', 'set', 'compression.threshold', String(threshold));
    const exec = serviceExecStart();
    if (!/--ctx-size\s+\d+/.test(exec)) throw new Error('service ExecStart lacks --ctx-size');
    const override = `[Service]\nExecStart=\nExecStart=${exec.replace(/--ctx-size\s+\d+/, `--ctx-size ${tokens}`)}\n`;
    writeRemoteFile(options['remote-dropin'], Buffer.from(override));
    ssh('systemctl --user daemon-reload'); output({ ok: true });
  } else if (['start', 'stop', 'restart'].includes(command)) {
    required('ssh-host', 'service'); ssh(`systemctl --user ${command} ${JSON.stringify(options.service)}`); output({ ok: true });
  } else if (command === 'health') {
    required('remote-url');
    try { const value = JSON.parse(ssh(`curl -fsS --max-time 10 ${JSON.stringify(`${options['remote-url']}/health`)}`)); output({ healthy: value.status === 'ok' }); }
    catch { output({ healthy: false }); }
  } else if (command === 'execute-turn') await executeTurn();
  else if (command === 'telemetry') {
    const id = process.env.CONTEXT_CAPACITY_SNAPSHOT_ID; if (!id) throw new Error('snapshot id missing');
    const metrics = readMetrics(id); const memory = remoteMemorySample();
    output({ latency_ms: metrics.wallTimeMs, peak_memory_bytes: metrics.systemPeakUsed, swap_bytes: Math.max(0, metrics.swapPeak - metrics.swapStart), tool_call_count: 0, system_total_memory_bytes: memory.total, system_peak_used_memory_bytes: metrics.systemPeakUsed, system_minimum_available_memory_bytes: metrics.systemMinimumAvailable, model_server_peak_rss_bytes: metrics.modelPeakRss, hermes_peak_rss_bytes: metrics.hermesPeakRss, model_call_count: 0 });
  } else if (command === 'restore') {
    required('ssh-host');
    const id = process.env.CONTEXT_CAPACITY_SNAPSHOT_ID; const directory = snapshotDirectory(id); const meta = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json')));
    fs.writeFileSync(meta.localPath, fs.readFileSync(path.join(directory, 'hermes-config.yaml')));
    if (meta.remoteExisted) writeRemoteFile(meta.remotePath, fs.readFileSync(path.join(directory, 'remote-dropin.bin')));
    else ssh(`p=${JSON.stringify(meta.remotePath)}; [[ ! -e "$p" ]] || rm -- "$p"`);
    ssh('systemctl --user daemon-reload'); output({ ok: true, snapshot_id: id });
  } else if (command === 'verify-restore') {
    const id = process.env.CONTEXT_CAPACITY_SNAPSHOT_ID; const directory = snapshotDirectory(id); const meta = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json')));
    const expectedLocal = fs.readFileSync(path.join(directory, 'hermes-config.yaml')); const observedLocal = fs.readFileSync(meta.localPath);
    const expectedRemote = fs.readFileSync(path.join(directory, 'remote-dropin.bin')); const observedRemote = readRemoteFile(meta.remotePath);
    const remoteExistenceMatches = observedRemote.exists === meta.remoteExisted;
    const targets = [
      { path: meta.localPath, expected_sha256: sha256(expectedLocal), observed_sha256: sha256(observedLocal), matches: sha256(expectedLocal) === sha256(observedLocal) },
      { path: `/ssh/${options['ssh-host']}${meta.remotePath}`, expected_sha256: sha256(expectedRemote), observed_sha256: sha256(observedRemote.bytes), matches: remoteExistenceMatches && sha256(expectedRemote) === sha256(observedRemote.bytes) },
    ];
    output({ ok: targets.every(item => item.matches), targets });
  } else if (command === 'tokenize') {
    required('remote-url');
    let input = ''; for await (const chunk of process.stdin) input += chunk;
    const result = sshDirect(['curl', '-fsS', '-H', 'Content-Type:application/json', '--data-binary', '@-', `${options['remote-url']}/tokenize`], input);
    const parsed = JSON.parse(result); output({ tokens: parsed.tokens || [] });
  } else throw new Error(`unknown command ${command}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
