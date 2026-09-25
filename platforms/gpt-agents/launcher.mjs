#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = fs.realpathSync(path.resolve(scriptDir, '../..'));
const marketplaceName = 'ai-fleas';
const requiredPlugins = ['ai-fleas-agent-bootstrap', 'ai-fleas-workflow-router'];
const openBin = process.env.AI_FLEAS_OPEN_BIN || 'open';
const platform = process.env.AI_FLEAS_OS || process.platform;

function fail(message) {
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
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, 'codex')),
    ...appCandidates.map(app => path.join(app, 'Contents', 'Resources', 'codex')),
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
      return requiredPlugins.includes(name) && marketplace !== marketplaceName;
    });
}

function missingPlugins() {
  const installed = new Set(installedPlugins().map(item => item.pluginId));
  return requiredPlugins.filter(name => !installed.has(`${name}@${marketplaceName}`));
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

function setup(profileArg, migrate) {
  prerequisites();
  const conflicts = conflictingPlugins();
  let marketplace = marketplaceState();
  const rootMismatch = marketplaceRootMismatch(marketplace);
  if (conflicts.length && !migrate) {
    fail(`the same plugins are enabled from another marketplace: ${conflicts.join(', ')}; rerun setup with --migrate to replace them`);
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
  for (const pluginId of conflicts) {
    run(codexBin, ['plugin', 'remove', pluginId]);
  }
  const profile = saveProfile(profileArg);
  process.stdout.write([
    'AI Fleas GPT setup is installed.',
    profile ? `Selected profile: ${profile}` : 'No private profile selected yet.',
    'If ChatGPT is running, quit it completely so it releases its cached plugin snapshot.',
    'Run the daily launcher, review and trust the AI Fleas plugin hooks, then start a new Codex task.',
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
    platform: 'gpt-agents',
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

function launch() {
  const app = prerequisites();
  const conflicts = conflictingPlugins();
  if (conflicts.length) {
    fail(`duplicate AI Fleas plugins are enabled: ${conflicts.join(', ')}; run setup --migrate first`);
  }
  const marketplace = marketplaceState();
  const rootMismatch = marketplaceRootMismatch(marketplace);
  if (rootMismatch) {
    fail(`marketplace ${marketplaceName} points to ${rootMismatch.configured || 'an unknown path'}, expected ${rootMismatch.expected}; run setup --migrate first`);
  }
  if (!marketplace || missingPlugins().length) {
    fail(`setup is incomplete; run ${path.join(scriptDir, 'launcher.mjs')} setup first`);
  }
  run(openBin, ['-a', 'ChatGPT']);
  process.stdout.write('AI Fleas GPT is ready. If ChatGPT requests hook review, approve the current AI Fleas hook definitions and start a new task.\n');
}

const args = process.argv.slice(2);
const action = args.shift() || 'launch';
let profile = null;
let migrate = false;
while (args.length) {
  const option = args.shift();
  if (option === '--profile' && args.length) profile = args.shift();
  else if (option === '--migrate') migrate = true;
  else fail(`unknown or incomplete option: ${option}`);
}

if (action === 'setup') setup(profile, migrate);
else if (action === 'doctor') doctor();
else if (action === 'launch') launch();
else fail(`unknown action: ${action}; expected setup, doctor, or launch`);
