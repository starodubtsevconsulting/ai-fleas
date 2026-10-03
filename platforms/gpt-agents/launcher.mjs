#!/usr/bin/env node
/** GPT host launcher, invoked by setup scripts or the human/controller CLI.
 * Inputs: setup/doctor/launch/initialize-governor/preflight-admin arguments and declared configuration.
 * Output: diagnostics or launch status. Effects: may install/update host components,
 * change desktop preferences, launch the app, ask for an exact human ID, create one
 * projectless Governor task when needed, or invoke its binding transaction.
 * The platform ID is codex-app; gpt-agents remains the command/directory name.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureQueuedFollowUps } from './desktop-preferences.mjs';
import { connectNativeAppServer } from './native-app-server.mjs';
import { hostTaskState } from './initialize-governor.mjs';
import { withGovernorRegistryLock } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/governor-registry-lock.mjs';
import { ensurePersonalGovernor, readGovernorRegistry, resolveGovernorHumanDir,
  selectGovernorHuman } from './governor-launch.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = fs.realpathSync(path.resolve(scriptDir, '../..'));
const marketplaceName = 'ai-fleas';
const requiredPlugins = ['ai-fleas-gpt'];
const legacyPlugins = ['ai-fleas-agent-bootstrap', 'ai-fleas-workflow-router'];
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const openBin = process.env.AI_FLEAS_OPEN_BIN || 'open';
const osascriptBin = process.env.AI_FLEAS_OSASCRIPT_BIN || 'osascript';
const platform = process.env.AI_FLEAS_OS || process.platform;
const agentStatusPrompt = [
  'Check AI Fleas status now.',
  'Read-only: verify plugin and platform health, my Personal Governor binding, authorized profiles and workflows,',
  'and each receipt-backed agent roster. Report ready, degraded, or blocked with safe next actions.',
  'Do not create, reinitialize, archive, or otherwise mutate agents.',
].join(' ');

function launchLogFile() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'ai-fleas', 'gpt-agents', 'launcher.log');
}

function launchEvent(event, details = {}) {
  try {
    const file = launchLogFile();
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const descriptor = fs.openSync(file, 'a', 0o600);
    try {
      fs.fchmodSync(descriptor, 0o600);
      fs.writeSync(descriptor, `${JSON.stringify({ at: new Date().toISOString(), pid: process.pid,
        event, ...details })}\n`);
    } finally { fs.closeSync(descriptor); }
  } catch (error) {
    process.stderr.write(`AI_FLEAS_GPT_LOG_WARNING: ${error.message}\n`);
  }
}

function fail(message) {
  launchEvent('blocked', { message: String(message).slice(0, 1000) });
  process.stderr.write(`AI_FLEAS_GPT_BLOCKED: ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    fail(`${command} ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout;
}

function json(command, args) {
  const output = run(command, args);
  try {
    return JSON.parse(output);
  } catch {
    fail(`${command} returned invalid JSON`);
  }
}

function chatGptApp() {
  const configured = process.env.AI_FLEAS_CHATGPT_APP;
  const candidates = configured
    ? [configured]
    : ['/Applications/ChatGPT.app', path.join(os.homedir(), 'Applications/ChatGPT.app')];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function codexExecutable() {
  if (process.env.AI_FLEAS_CODEX_BIN) return process.env.AI_FLEAS_CODEX_BIN;
  const appCandidates = [
    process.env.AI_FLEAS_CHATGPT_APP,
    '/Applications/ChatGPT.app',
    path.join(os.homedir(), 'Applications/ChatGPT.app'),
  ].filter(Boolean);
  const candidates = [
    ...appCandidates.map(app => path.join(app, 'Contents', 'Resources', 'codex-cli', 'bin', 'codex')),
    ...appCandidates.map(app => path.join(app, 'Contents', 'Resources', 'codex-cli', 'CodexCLI.app', 'Contents', 'MacOS', 'codex')),
    ...appCandidates.map(app => path.join(app, 'Contents', 'Resources', 'codex')),
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, 'codex')),
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
  ];
  return candidates.find(candidate => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }) || 'codex';
}

const codexBin = codexExecutable();

function prerequisites() {
  if (platform !== 'darwin') fail('the launcher currently supports macOS only');
  run(codexBin, ['--version']);
  const app = chatGptApp();
  if (!app) fail('ChatGPT.app is not installed in /Applications or ~/Applications');
  return app;
}

function marketplaceState() {
  const state = json(codexBin, ['plugin', 'marketplace', 'list', '--json']);
  return state.marketplaces?.find(item => item.name === marketplaceName) || null;
}

function marketplaceRootMismatch(marketplace = marketplaceState()) {
  if (!marketplace) return null;
  const configured = marketplace.marketplaceSource?.source || marketplace.root;
  if (!configured) return { configured: null, expected: repoRoot };
  let resolved = path.resolve(configured);
  try {
    resolved = fs.realpathSync(resolved);
  } catch {
    // Preserve the normalized path so a deleted temporary checkout is still diagnosable.
  }
  return resolved === repoRoot ? null : { configured: resolved, expected: repoRoot };
}

function installedPlugins() {
  const state = json(codexBin, ['plugin', 'list', '--json']);
  return (state.installed || []).filter(item => item.enabled);
}

function conflictingPlugins(installed = installedPlugins()) {
  return installed
    .map(item => item.pluginId)
    .filter(pluginId => {
      const [name, marketplace] = pluginId.split('@');
      return legacyPlugins.includes(name) || (requiredPlugins.includes(name) && marketplace !== marketplaceName);
    });
}

function missingPlugins() {
  const installed = new Set(installedPlugins().map(item => item.pluginId));
  return requiredPlugins.filter(name => !installed.has(`${name}@${marketplaceName}`));
}

function pluginDataDirectory(pluginId) {
  return path.join(codexHome, 'plugins', 'data', pluginId.replace('@', '-'));
}

function mergePluginData(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      mergePluginData(from, to);
    } else if (!fs.existsSync(to)) {
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    } else if (!fs.readFileSync(from).equals(fs.readFileSync(to))) {
      fail(`cannot migrate plugin data because ${to} conflicts with ${from}`);
    }
  }
}

function migratePluginData(pluginIds) {
  const destination = pluginDataDirectory(`ai-fleas-gpt@${marketplaceName}`);
  const dataRoot = path.join(codexHome, 'plugins', 'data');
  const sources = new Set(pluginIds.map(pluginDataDirectory));
  if (fs.existsSync(dataRoot)) {
    for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && legacyPlugins.some(name => entry.name.startsWith(`${name}-`))) {
        sources.add(path.join(dataRoot, entry.name));
      }
    }
  }
  for (const source of sources) mergePluginData(source, destination);
}

class AgentStatusNavigator {
  constructor(agentBindingsFile) {
    this.agentBindingsFile = agentBindingsFile;
  }

  async open(taskId) {
    run(openBin, ['-a', 'ChatGPT']);
    if (!taskId) return this.#openOnboarding();

    let client;
    let observed;
    try {
      client = await connectNativeAppServer({
        socketPath: path.join(codexHome, 'app-server-control/app-server-control.sock'),
      });
      observed = await hostTaskState(client, taskId);
    } catch (error) {
      process.stderr.write(`AI_FLEAS_GPT_STATUS_WARNING: Governor host catalog could not be verified: ${error.message}.\n`);
      return this.#openOnboarding();
    } finally {
      client?.close();
    }
    if (!observed || observed.archived) {
      this.#recordUnavailableGovernor(taskId, observed?.archived ? 'archived' : 'missing');
      return this.#openOnboarding();
    }

    let queueResult;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      queueResult = spawnSync(codexBin, [
        'queue',
        '--thread', taskId,
        '--message', agentStatusPrompt,
      ], { encoding: 'utf8' });
      if (!queueResult.error && queueResult.status === 0) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }

    if (queueResult?.error || queueResult?.status !== 0) {
      const detail = queueResult?.error?.message || queueResult?.stderr?.trim() || queueResult?.stdout?.trim() || '';
      process.stderr.write('AI_FLEAS_GPT_STATUS_WARNING: The recorded Governor is unavailable; opening Personal Governor onboarding.\n');
      return this.#openOnboarding();
    }

    run(openBin, [`codex://threads/${taskId}`]);
    return { destination: 'personal-governor', taskId };
  }

  #openOnboarding() {
    run(openBin, ['codex://threads/new']);
    return { destination: 'plugin-onboarding' };
  }

  #recordUnavailableGovernor(taskId, status) {
    withGovernorRegistryLock(this.agentBindingsFile, () => {
      let registry;
      try { registry = JSON.parse(fs.readFileSync(this.agentBindingsFile, 'utf8')); }
      catch { return; }
      const binding = registry?.instances?.[taskId];
      if (binding?.status !== 'active') return;
      binding.status = status;
      binding.unavailableAt = new Date().toISOString();
      binding.unavailableObservedBy = 'launcher-host-catalog';
      const temporary = `${this.agentBindingsFile}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporary, this.agentBindingsFile);
    });
  }

}

function humanCatalogConfigFile() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'ai-fleas', 'gpt-agents', 'humans-dir');
}

function configuredHumansDir() {
  if (process.env.AI_FLEAS_HUMANS_DIR) return process.env.AI_FLEAS_HUMANS_DIR;
  const file = humanCatalogConfigFile();
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

function saveHumansDir(directory) {
  if (!directory) return null;
  const resolved = fs.realpathSync(directory);
  if (!fs.statSync(resolved).isDirectory()) fail(`human profile catalog is not a directory: ${directory}`);
  const file = humanCatalogConfigFile();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${resolved}\n`, { mode: 0o600 });
  return resolved;
}

function askHumanProfileId() {
  const result = spawnSync(osascriptBin, ['-e',
    'text returned of (display dialog "Which human profile should own the Personal Governor? Enter its exact ID." default answer "" buttons {"Cancel", "Initialize"} default button "Initialize")',
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    if (/User canceled|(-128)/i.test(result.stderr ?? '')) return null;
    throw new Error(result.error?.message || result.stderr?.trim() || 'GOVERNOR_HUMAN_SELECTION_FAILED');
  }
  return result.stdout.trim();
}

function openLocalGovernor(taskId) {
  // Target the installed desktop app and local host explicitly. An untargeted
  // codex:// URL can be handled by a different app/window registration.
  const app = chatGptApp();
  if (!app) fail('ChatGPT.app is unavailable for Governor navigation');
  launchEvent('navigation-request', { taskId });
  run(openBin, ['-a', app, `codex://threads/${taskId}?hostId=local`]);
  launchEvent('navigation-sent', { taskId });
}

function saveProfile(profileArg) {
  if (!profileArg) return null;
  const resolved = fs.realpathSync(profileArg);
  if (!fs.statSync(resolved).isFile()) fail(`profile is not a file: ${profileArg}`);
  const configRoot = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const targetDir = path.join(configRoot, 'ai-fleas', 'gpt-agents');
  fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(targetDir, 'profile'), `${resolved}\n`, { mode: 0o600 });
  return resolved;
}

function setup(profileArg, migrate, humansDirArg) {
  prerequisites();
  const conflicts = conflictingPlugins();
  let marketplace = marketplaceState();
  const rootMismatch = marketplaceRootMismatch(marketplace);
  if (conflicts.length && !migrate) {
    fail(`legacy or duplicate AI Fleas plugins are enabled: ${conflicts.join(', ')}; rerun setup with --migrate to replace them`);
  }
  if (rootMismatch && !migrate) {
    fail(`marketplace ${marketplaceName} points to ${rootMismatch.configured || 'an unknown path'}, expected ${rootMismatch.expected}; rerun setup with --migrate to relocate it`);
  }
  if (rootMismatch) {
    run(codexBin, ['plugin', 'marketplace', 'remove', marketplaceName]);
    marketplace = null;
  }
  if (!marketplace) {
    run(codexBin, ['plugin', 'marketplace', 'add', repoRoot]);
  }
  for (const plugin of requiredPlugins) {
    run(codexBin, ['plugin', 'add', `${plugin}@${marketplaceName}`]);
  }
  const missing = missingPlugins();
  if (missing.length) fail(`required plugins are not enabled: ${missing.join(', ')}`);
  if (migrate) migratePluginData(conflicts);
  for (const pluginId of conflicts) {
    run(codexBin, ['plugin', 'remove', pluginId]);
  }
  const profile = saveProfile(profileArg);
  const humansDir = saveHumansDir(humansDirArg);
  process.stdout.write([
    'AI Fleas GPT is installed as one user-facing plugin.',
    profile ? `Selected profile: ${profile}` : 'No private profile selected yet.',
    humansDir ? `Selected human profile catalog: ${humansDir}` : 'Human profile catalog unchanged.',
    'If ChatGPT is running, quit it completely so it releases its cached plugin snapshot.',
    'Run the daily launcher, review and trust the AI Fleas GPT hooks, then start a new Codex task.',
  ].join('\n') + '\n');
}

function doctor() {
  const app = prerequisites();
  const marketplace = marketplaceState();
  const rootMismatch = marketplaceRootMismatch(marketplace);
  const missing = marketplace ? missingPlugins() : requiredPlugins;
  const conflicts = conflictingPlugins();
  const result = {
    status: conflicts.length || rootMismatch ? 'migration-required' : marketplace && missing.length === 0 ? 'ready' : 'setup-required',
    platform: 'codex-app',
    operatingSystem: 'macOS',
    chatGptApp: app,
    marketplace: marketplace ? marketplaceName : null,
    marketplaceRoot: marketplace?.marketplaceSource?.source || marketplace?.root || null,
    expectedMarketplaceRoot: repoRoot,
    marketplaceRootMismatch: rootMismatch,
    missingPlugins: missing,
    conflictingPlugins: conflicts,
    hookTrust: 'verify-in-chatgpt',
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'ready') process.exitCode = 2;
}

async function launch() {
  launchEvent('launch-start');
  const app = prerequisites();
  const conflicts = conflictingPlugins();
  if (conflicts.length) {
    fail(`legacy or duplicate AI Fleas plugins are enabled: ${conflicts.join(', ')}; run setup --migrate first`);
  }
  const marketplace = marketplaceState();
  const rootMismatch = marketplaceRootMismatch(marketplace);
  if (rootMismatch) {
    fail(`marketplace ${marketplaceName} points to ${rootMismatch.configured || 'an unknown path'}, expected ${rootMismatch.expected}; run setup --migrate first`);
  }
  if (!marketplace || missingPlugins().length) {
    fail(`setup is incomplete; run ${path.join(scriptDir, 'launcher.mjs')} setup first`);
  }
  const followUps = ensureQueuedFollowUps(path.join(codexHome, 'config.toml'));
  const registryFile = path.join(
    pluginDataDirectory(`ai-fleas-gpt@${marketplaceName}`),
    'agent-bindings.json',
  );
  run(openBin, ['-a', 'ChatGPT']);
  const registry = readGovernorRegistry(registryFile);
  launchEvent('registry-read', { governorReceipts: Object.values(registry.instances).filter(item =>
    item?.agentId === 'personal-governor').length });
  let selectedHuman;
  try { selectedHuman = selectGovernorHuman(registry, human, askHumanProfileId); }
  catch (error) {
    if (error.message === 'GOVERNOR_HUMAN_ID_REQUIRED') {
      process.stdout.write('Personal Governor initialization canceled; no task was created.\n');
      return;
    }
    throw error;
  }
  const humanDirectory = resolveGovernorHumanDir(registry, selectedHuman,
    { humansDir: configuredHumansDir() });
  const client = await connectNativeAppServer({
    socketPath: path.join(codexHome, 'app-server-control/app-server-control.sock'),
    maxFrameBytes: 64 * 1024 * 1024,
  });
  const tracedClient = { ...client, async request(method, params) {
    try { return await client.request(method, params); }
    catch (error) {
      launchEvent('host-request-failed', { method, message: error.message.slice(0, 500) });
      throw error;
    }
  } };
  let result;
  try {
    result = await ensurePersonalGovernor({ client: tracedClient, registryFile, humanId: selectedHuman,
      humanDir: humanDirectory,
      openTask: openLocalGovernor });
  } finally { client.close(); }
  launchEvent('governor-resolved', { taskId: result.taskId, status: result.status,
    welcomeStatus: result.welcomeStatus, welcomeReason: result.welcomeReason });
  if (result.status === 'existing' && (!result.welcomeStatus || result.welcomeStatus === 'completed')) {
    openLocalGovernor(result.taskId);
  }
  const destination = result.welcomeStatus === 'blocked'
    ? `Personal Governor is active, but its welcome INIT is blocked: ${result.welcomeReason}. No duplicate turn was sent.`
    : result.welcomeStatus === 'pending'
      ? `Personal Governor is active; its welcome INIT is still pending (${result.welcomeReason}). Run the launcher again to verify completion.`
      : result.status === 'existing'
    ? 'Navigation to the trusted Personal Governor was requested; no initialization or platform-health check was queued.'
    : result.status === 'ready'
      ? 'Personal Governor activation and welcome INIT completed; the verified task is pinned.'
      : 'Personal Governor initialization is still pending; the task will not be opened until a later launcher run verifies readiness.';
  process.stdout.write(`AI Fleas GPT is ready. Follow-up behavior: Queue${followUps.changed ? ' (updated)' : ''}. ${destination}\n`);
  launchEvent('launch-finished', { taskId: result.taskId, status: result.status,
    welcomeStatus: result.welcomeStatus });
}

const args = process.argv.slice(2);
const action = args.shift() || 'launch';
let profile = null;
let migrate = false;
let human = null;
let humanDir = null;
let humansDir = null;
let thread = null;
let requestFile = null;
while (args.length) {
  const option = args.shift();
  if (option === '--profile' && args.length) profile = args.shift();
  else if (option === '--migrate') migrate = true;
  else if (option === '--human' && args.length) human = args.shift();
  else if (option === '--human-dir' && args.length) humanDir = args.shift();
  else if (option === '--humans-dir' && args.length) humansDir = args.shift();
  else if (option === '--thread' && args.length) thread = args.shift();
  else if (option === '--request' && args.length) requestFile = args.shift();
  else fail(`unknown or incomplete option: ${option}`);
}

if (requestFile && action !== 'preflight-admin') fail('--request is only valid for preflight-admin');
if (humansDir && action !== 'setup') fail('--humans-dir is only valid for setup');
if (action === 'preflight-admin') {
  if (!requestFile || profile || migrate || human || humanDir || thread) {
    fail('usage: launcher.mjs preflight-admin --request REQUEST.json');
  }
  process.stdout.write(run(process.execPath, [path.join(scriptDir, 'admin-initialization.mjs'), requestFile]));
} else if (action === 'setup') setup(profile, migrate, humansDir);
else if (action === 'doctor') doctor();
else if (action === 'launch') launch().catch(error => fail(error.message));
else if (action === 'initialize-governor') {
  if (!human || !humanDir || !thread || profile || migrate) {
    fail('usage: launcher.mjs initialize-governor --human ID --human-dir PATH --thread TASK_ID');
  }
  process.stdout.write(run(process.execPath, [
    path.join(scriptDir, 'initialize-governor.mjs'),
    '--human', human, '--human-dir', humanDir, '--thread', thread,
  ]));
} else fail(`unknown action: ${action}; expected setup, doctor, launch, initialize-governor, or preflight-admin`);
