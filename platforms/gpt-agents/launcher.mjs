#!/usr/bin/env node
/** GPT host launcher, invoked by setup scripts or the human/controller CLI.
 * Inputs: setup/doctor/launch/prepare-human-profile/initialize-governor/discover-admin-scope/preflight-admin arguments and declared configuration.
 * Output: diagnostics or launch status. Effects: may install/update host components,
 * change desktop preferences, launch the app, ask for an exact human ID, scaffold
 * one missing private human profile from the minimal example contract, create one
 * projectless Governor task when needed, invoke its binding transaction, and
 * show a dismissible macOS progress window during slow initialization.
 * The platform ID is codex-app; gpt-agents remains the command/directory name.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureQueuedFollowUps } from './desktop-preferences.mjs';
import { connectNativeAppServer } from './native-app-server.mjs';
import { buildGovernorInitialization, hostTaskState } from './initialize-governor.mjs';
import { GovernorHumanResolver } from './governor-human-resolver.mjs';
import { assertHumanProfileId } from './human-profile-bootstrap.mjs';
import { HumanProfileStore } from './human-profile-store.mjs';
import { discoverManualAdminBootstrapScope } from './prepare-native-admin.mjs';
import { withGovernorRegistryLock } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/governor-registry-lock.mjs';
import { ensurePersonalGovernor, readGovernorRegistry, selectGovernorHuman } from './governor-launch.mjs';

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

function governorNotice(message) {
  if (platform !== 'darwin') return;
  // Notification delivery is best-effort; lifecycle verification never depends
  // on a macOS notification or permission granted to the launcher app.
  const script = `display notification ${JSON.stringify(message)} with title "AI Fleas GPT"`;
  const result = spawnSync(osascriptBin, ['-e', script], { encoding: 'utf8' });
  if (result.error || result.status !== 0)
    launchEvent('notification-unavailable', { message: result.error?.message || result.stderr?.trim() });
}

function governorProgressDialog(message, onHide) {
  if (platform !== 'darwin') return null;
  // The Dock launcher has no terminal. Keep one visible, dismissible window
  // while its synchronous lifecycle work is running; never block the lifecycle
  // on a user click or claim that this window is readiness evidence.
  const logo = path.join(repoRoot, 'img/ai-fleas-human-robot-logo.png');
  const icon = fs.existsSync(logo) ? ` with icon POSIX file ${JSON.stringify(logo)}` : '';
  if (!icon) launchEvent('progress-logo-unavailable', { path: logo });
  const script = `display dialog ${JSON.stringify(message)} with title "AI Fleas GPT"${icon} buttons {"Hide"} default button "Hide" giving up after 600`;
  const child = spawn(osascriptBin, ['-e', script], { stdio: 'ignore' });
  child.on('error', error => launchEvent('progress-dialog-unavailable', { message: error.message }));
  child.on('exit', (code, signal) => { if (code === 0 && !signal) onHide(); });
  return child;
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

  // Private implementation

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
  return new HumanProfileStore().configFile();
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

function askHumanProfileId(suggestedId = '') {
  let answer = suggestedId;
  for (;;) {
    const result = spawnSync(osascriptBin, ['-e',
      `text returned of (display dialog "Which human profile should own the Personal Governor? Enter its exact ID." default answer ${JSON.stringify(answer)} buttons {"Cancel", "Continue"} default button "Continue")`,
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
      if (/User canceled|(-128)/i.test(result.stderr ?? '')) return null;
      throw new Error(result.error?.message || result.stderr?.trim() || 'GOVERNOR_HUMAN_SELECTION_FAILED');
    }
    answer = result.stdout.trim();
    try { return assertHumanProfileId(answer); }
    catch {
      const alert = spawnSync(osascriptBin, ['-e',
        'display dialog "Human ID must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores. No profile was created." with title "AI Fleas GPT" buttons {"Try Again"} default button "Try Again"',
      ], { encoding: 'utf8' });
      if (alert.error || alert.status !== 0)
        throw new Error(alert.error?.message || alert.stderr?.trim() || 'GOVERNOR_HUMAN_SELECTION_FAILED');
    }
  }
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
  const humanStore = new HumanProfileStore();
  const profileLocation = humanStore.resolve();
  process.stdout.write([
    'AI Fleas GPT is installed as one user-facing plugin.',
    profile ? `Selected workflow profile: ${profile}` : 'No workflow profile selected; Personal Governor can still initialize.',
    `Human profile location: ${profileLocation}${humansDir ? ' (selected override)' :
      humanStore.explicitLocation() ? ' (existing override)' : ' (home-folder default; created on first use)'}.`,
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
  const humanStore = new HumanProfileStore();
  let humanProfileLocation = null;
  let humanProfileError = null;
  try {
    humanProfileLocation = humanStore.resolve();
    const explicit = humanStore.explicitLocation();
    if (explicit && !fs.existsSync(explicit)) humanProfileError = 'GOVERNOR_HUMAN_CATALOG_NOT_FOUND';
  } catch (error) { humanProfileError = error.message; }
  const result = {
    status: conflicts.length || rootMismatch ? 'migration-required' :
      marketplace && missing.length === 0 && !humanProfileError ? 'ready' : 'setup-required',
    platform: 'codex-app',
    operatingSystem: 'macOS',
    chatGptApp: app,
    marketplace: marketplace ? marketplaceName : null,
    marketplaceRoot: marketplace?.marketplaceSource?.source || marketplace?.root || null,
    expectedMarketplaceRoot: repoRoot,
    marketplaceRootMismatch: rootMismatch,
    missingPlugins: missing,
    conflictingPlugins: conflicts,
    humanProfileLocation,
    humanProfileError,
    hookTrust: 'verify-in-chatgpt',
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'ready') process.exitCode = 2;
}

// Presentation only: classify a controller result without host or registry effects.
export function governorLaunchReport(result) {
  if (result.status === 'blocked') {
    const task = result.taskId ? ` for task ${result.taskId}` : ' before a task ID was verified';
    return {
      platformStatus: 'AI Fleas GPT is blocked.',
      destination: `Personal Governor initialization is blocked${task}: ${result.reason || 'GOVERNOR_BLOCK_REASON_UNAVAILABLE'}${result.classification ? ` (classification: ${result.classification})` : ''}. Readiness was not verified.`,
    };
  }
  const foreignWriter = result.welcomeReason === 'GOVERNOR_WELCOME_FOREIGN_WRITER_ACTIVE';
  const destination = foreignWriter
    ? 'Personal Governor activation is verified, but its welcome INIT was not sent because another host process owns the session writer. Keep the exact Governor chat active: do not close, archive, unarchive, or replace it. Verify the writer owner and release it through a supported host action, or obtain separate authorization for an app/service restart after confirming no turn is running. Do not retry the launcher until the writer is released; no duplicate turn was sent.'
    : result.welcomeStatus === 'blocked'
    ? `Personal Governor is active, but its welcome INIT is blocked: ${result.welcomeReason}. No duplicate turn was sent.`
    : result.welcomeStatus === 'pending'
      ? `Personal Governor is active; its welcome INIT is still pending (${result.welcomeReason}). Run the launcher again to verify completion.`
      : result.status === 'existing'
        ? result.welcomeStatus === 'completed'
          ? 'Existing Personal Governor readiness and welcome completion were verified; no activation INIT was queued.'
          : 'Existing Personal Governor readiness was verified, but welcome completion was not verified.'
        : result.status === 'ready'
          ? 'Personal Governor activation and welcome INIT completed; the verified task is pinned.'
          : 'Personal Governor initialization is still pending; the task will not be opened until a later launcher run verifies readiness.';
  const platformStatus = result.status === 'pending' ||
    ['pending', 'blocked'].includes(result.welcomeStatus) ? 'AI Fleas GPT is pending.' : 'AI Fleas GPT is ready.';
  return { platformStatus, destination };
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
  try { selectedHuman = selectGovernorHuman(registry, human, askHumanProfileId,
    { chooseHuman: !human }); }
  catch (error) {
    if (error.message === 'GOVERNOR_HUMAN_ID_REQUIRED') {
      process.stdout.write('Personal Governor initialization canceled; no task was created.\n');
      return;
    }
    throw error;
  }
  const { humanDir: humanDirectory } = new GovernorHumanResolver().resolve(registry, selectedHuman);
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
  let progressDialog = null;
  let progressHidden = false;
  try {
    result = await ensurePersonalGovernor({ client: tracedClient, registryFile, humanId: selectedHuman,
      humanDir: humanDirectory,
      openTask: openLocalGovernor,
      onProgress: ({ taskId, stage }) => {
        launchEvent('governor-progress', { taskId, stage });
        if (stage === 'activation-started') {
          progressDialog = governorProgressDialog(
            'Personal Governor is initializing. This run will check activation for up to 10 minutes. The chat moves to Pinned only after verification. You may hide this window; work will continue.',
            () => { progressHidden = true; });
          governorNotice('Personal Governor initialization started. It can take several minutes; the chat will be pinned after verification.');
        } else if (stage === 'activation-pending')
          governorNotice('Personal Governor is still initializing. AI Fleas GPT is monitoring this exact task.');
        else if (stage === 'welcome-started') {
          progressDialog?.kill();
          if (!progressHidden)
            progressDialog = governorProgressDialog(
              'Personal Governor is active. Its welcome INIT is checking memory and schedules for up to 3 minutes. You may hide this window; work will continue.',
              () => { progressHidden = true; });
          governorNotice('Personal Governor activated. Preparing its welcome and memory/schedule report.');
        }
      } });
  } finally { client.close(); progressDialog?.kill(); }
  launchEvent('governor-resolved', { taskId: result.taskId, status: result.status,
    reason: result.reason, classification: result.classification,
    welcomeStatus: result.welcomeStatus, welcomeReason: result.welcomeReason });
  if (result.status === 'existing' && (!result.welcomeStatus || result.welcomeStatus === 'completed')) {
    openLocalGovernor(result.taskId);
  }
  const { platformStatus, destination } = governorLaunchReport(result);
  if (result.status === 'ready' && result.welcomeStatus === 'completed')
    governorNotice('Personal Governor is ready and pinned. Its welcome report is in the chat.');
  else if (result.welcomeReason === 'GOVERNOR_WELCOME_FOREIGN_WRITER_ACTIVE')
    governorNotice(destination);
  else if (result.status === 'pending' || result.welcomeStatus === 'pending')
    governorNotice('Personal Governor is still pending. Run AI Fleas GPT again to resume verification.');
  else if (result.status === 'blocked') governorNotice(destination);
  process.stdout.write(`${platformStatus} Follow-up behavior: Queue${followUps.changed ? ' (updated)' : ''}. ${destination}\n`);
  launchEvent('launch-finished', { taskId: result.taskId, status: result.status,
    reason: result.reason, classification: result.classification,
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
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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

if (requestFile && !['discover-admin-scope', 'preflight-admin'].includes(action))
  fail('--request is only valid for discover-admin-scope or preflight-admin');
if (humansDir && action !== 'setup') fail('--humans-dir is only valid for setup');
if (action === 'preflight-admin') {
  if (!requestFile || profile || migrate || human || humanDir || thread) {
    fail('usage: launcher.mjs preflight-admin --request REQUEST.json');
  }
  process.stdout.write(run(process.execPath, [path.join(scriptDir, 'admin-initialization.mjs'), requestFile]));
} else if (action === 'discover-admin-scope') {
  if (!requestFile || profile || migrate || human || humanDir || thread) {
    fail('usage: launcher.mjs discover-admin-scope --request REQUEST.json');
  }
  let client;
  try {
    const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
    client = await connectNativeAppServer({
      socketPath: path.join(codexHome, 'app-server-control/app-server-control.sock'),
    });
    const result = await discoverManualAdminBootstrapScope(request, client);
    const projectSelection = 'attached-authorized-intersection';
    const selectionEvidence = { profilePath: result.profilePath,
      savedProjectId: result.savedProject.id, rootsComplete: result.savedProject.rootsComplete };
    let preflightRequest;
    const approval = request.authorization;
    if (approval?.humanApproved === true && approval.profileId === result.profileId &&
        approval.workflowId === result.workflowId && approval.logicalProjectId === result.logicalProjectId) {
      const authorization = { ...approval, projectIds: result.projectIds,
        projectSelection, selectionEvidence };
      preflightRequest = { profilePath: result.profilePath, profileId: result.profileId,
        workflowId: result.workflowId, projectIds: result.projectIds,
        logicalProjectId: result.logicalProjectId, runtimeScope: result.runtimeScope,
        savedProjectId: result.savedProject.id,
        savedProjects: result.projectIds.map(projectId => ({ projectId, savedProjectId: result.savedProject.id })),
        generation: request.generation || 1, authorization };
    }
    process.stdout.write(`${JSON.stringify({ ...result, projectSelection, selectionEvidence,
      ...(preflightRequest ? { preflightRequest } : {}) })}\n`);
  } catch (error) { fail(error.message); }
  finally { client?.close(); }
} else if (action === 'setup') setup(profile, migrate, humansDir);
else if (action === 'doctor') doctor();
else if (action === 'launch') launch().catch(error => fail(error.message));
else if (action === 'prepare-human-profile') {
  if (!human || humanDir || thread || profile || migrate || humansDir)
    fail('usage: launcher.mjs prepare-human-profile --human ID');
  try {
    const registryFile = path.join(pluginDataDirectory(`ai-fleas-gpt@${marketplaceName}`),
      'agent-bindings.json');
    const result = new GovernorHumanResolver().resolve(readGovernorRegistry(registryFile), human);
    buildGovernorInitialization(result.humanDir, human, 1);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { fail(error.message); }
}
else if (action === 'initialize-governor') {
  if (!human || !humanDir || !thread || profile || migrate) {
    fail('usage: launcher.mjs initialize-governor --human ID --human-dir PATH --thread TASK_ID');
  }
  process.stdout.write(run(process.execPath, [
    path.join(scriptDir, 'initialize-governor.mjs'),
    '--human', human, '--human-dir', humanDir, '--thread', thread,
  ]));
} else fail(`unknown action: ${action}; expected setup, doctor, launch, prepare-human-profile, initialize-governor, discover-admin-scope, or preflight-admin`);
}
