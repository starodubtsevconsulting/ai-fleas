import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const launcher = fileURLToPath(new URL('./launcher.mjs', import.meta.url));
const repositoryRoot = fs.realpathSync(fileURLToPath(new URL('../..', import.meta.url)));

function fixture({ marketplace = false, plugins = false, legacy = false, staleMarketplace = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-gpt-launcher-'));
  const bin = path.join(root, 'bin');
  const app = path.join(root, 'ChatGPT.app');
  const log = path.join(root, 'calls.log');
  const state = path.join(root, 'state');
  fs.mkdirSync(bin);
  fs.mkdirSync(app);
  fs.writeFileSync(state, `${marketplace ? 'marketplace' : ''}\n${plugins ? 'plugins' : ''}\n${legacy ? 'legacy' : ''}\n${staleMarketplace ? 'stale' : ''}\n`);
  const codex = path.join(bin, 'codex');
  const embeddedCodex = path.join(app, 'Contents', 'Resources', 'codex');
  const open = path.join(bin, 'open');
  fs.writeFileSync(codex, `#!/bin/sh
printf '%s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
case "$*" in
  '--version') echo 'codex-test 1.0' ;;
  'plugin marketplace list --json')
    if grep -q marketplace "$AI_FLEAS_TEST_STATE"; then
      if grep -q stale "$AI_FLEAS_TEST_STATE"; then echo '{"marketplaces":[{"name":"ai-fleas","root":"/private/tmp/stale-ai-fleas"}]}'
      else printf '{"marketplaces":[{"name":"ai-fleas","root":"%s"}]}\\n' "$AI_FLEAS_EXPECTED_MARKETPLACE_ROOT"; fi
    else echo '{"marketplaces":[]}'; fi ;;
  'plugin marketplace remove ai-fleas') sed -i.bak -e '/marketplace/d' -e '/stale/d' "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin marketplace add '*) printf 'marketplace\\n' >> "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin add '*) printf 'plugins\\n' >> "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin remove '*) sed -i.bak '/legacy/d' "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin list --json')
    if grep -q plugins "$AI_FLEAS_TEST_STATE"; then
      if grep -q legacy "$AI_FLEAS_TEST_STATE"; then
        echo '{"installed":[{"pluginId":"ai-fleas-gpt@ai-fleas","enabled":true},{"pluginId":"ai-fleas-agent-bootstrap@ai-fleas","enabled":true},{"pluginId":"ai-fleas-workflow-router@ai-fleas","enabled":true},{"pluginId":"ai-fleas-gpt@personal","enabled":true}]}'
      else echo '{"installed":[{"pluginId":"ai-fleas-gpt@ai-fleas","enabled":true}]}'; fi
    elif grep -q legacy "$AI_FLEAS_TEST_STATE"; then
      echo '{"installed":[{"pluginId":"ai-fleas-agent-bootstrap@ai-fleas","enabled":true},{"pluginId":"ai-fleas-workflow-router@ai-fleas","enabled":true}]}'
    else echo '{"installed":[]}'; fi ;;
  *) echo '{}' ;;
esac
`);
  fs.mkdirSync(path.dirname(embeddedCodex), { recursive: true });
  fs.copyFileSync(codex, embeddedCodex);
  fs.writeFileSync(open, '#!/bin/sh\nprintf \'open %s\\n\' "$*" >> "$AI_FLEAS_TEST_LOG"\n');
  fs.chmodSync(codex, 0o755);
  fs.chmodSync(embeddedCodex, 0o755);
  fs.chmodSync(open, 0o755);
  return { root, app, log, state, codex, open };
}

function run(item, args, { finderEnvironment = false } = {}) {
  const env = {
    ...process.env,
    AI_FLEAS_OS: 'darwin',
    AI_FLEAS_OPEN_BIN: item.open,
    AI_FLEAS_CHATGPT_APP: item.app,
    AI_FLEAS_TEST_LOG: item.log,
    AI_FLEAS_TEST_STATE: item.state,
    AI_FLEAS_EXPECTED_MARKETPLACE_ROOT: repositoryRoot,
    XDG_CONFIG_HOME: path.join(item.root, 'config'),
    CODEX_HOME: path.join(item.root, 'codex-home'),
  };
  if (finderEnvironment) {
    delete env.AI_FLEAS_CODEX_BIN;
    env.PATH = '/usr/bin:/bin';
  } else {
    env.AI_FLEAS_CODEX_BIN = item.codex;
  }
  return spawnSync(process.execPath, [launcher, ...args], {
    encoding: 'utf8',
    env,
  });
}

test('doctor reports setup-required when marketplace and plugins are absent', () => {
  const item = fixture();
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'setup-required');
});

test('setup adds marketplace and the single AI Fleas GPT plugin', () => {
  const item = fixture();
  const result = run(item, ['setup']);
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin marketplace add/);
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.doesNotMatch(calls, /plugin add ai-fleas-agent-bootstrap/);
  assert.doesNotMatch(calls, /plugin add ai-fleas-workflow-router/);
});

test('launch opens ChatGPT only when setup is ready', () => {
  const item = fixture({ marketplace: true, plugins: true });
  const result = run(item, ['launch']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(item.log, 'utf8'), /open -a ChatGPT/);
});

test('launch finds the Codex CLI bundled in ChatGPT when Finder PATH is minimal', () => {
  const item = fixture({ marketplace: true, plugins: true });
  const result = run(item, ['launch'], { finderEnvironment: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(item.log, 'utf8'), /open -a ChatGPT/);
});

test('doctor reports migration-required for legacy and duplicate plugin copies', () => {
  const item = fixture({ marketplace: true, plugins: true, legacy: true });
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'migration-required');
  assert.deepEqual(report.conflictingPlugins, [
    'ai-fleas-agent-bootstrap@ai-fleas',
    'ai-fleas-workflow-router@ai-fleas',
    'ai-fleas-gpt@personal',
  ]);
});

test('setup requires explicit migration before replacing legacy or duplicate plugins', () => {
  const item = fixture({ marketplace: true, plugins: true, legacy: true });
  const bootstrapData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-agent-bootstrap-ai-fleas');
  const routerData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-workflow-router-ai-fleas');
  const orphanedPersonalData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-agent-bootstrap-personal');
  fs.mkdirSync(bootstrapData, { recursive: true });
  fs.mkdirSync(path.join(routerData, 'correlations'), { recursive: true });
  fs.mkdirSync(orphanedPersonalData, { recursive: true });
  fs.writeFileSync(path.join(bootstrapData, 'agent-bindings.json'), '{"bindings":[]}');
  fs.writeFileSync(path.join(routerData, 'bindings.json'), '{"bindings":[]}');
  fs.writeFileSync(path.join(routerData, 'correlations', 'task.json'), '{"task":"bound"}');
  fs.writeFileSync(path.join(orphanedPersonalData, 'legacy-receipt.json'), '{"receipt":"preserved"}');
  const blocked = run(item, ['setup']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /--migrate/);
  assert.doesNotMatch(fs.readFileSync(item.log, 'utf8'), /plugin remove/);

  const migrated = run(item, ['setup', '--migrate']);
  assert.equal(migrated.status, 0, migrated.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.match(calls, /plugin remove ai-fleas-agent-bootstrap@ai-fleas/);
  assert.match(calls, /plugin remove ai-fleas-workflow-router@ai-fleas/);
  assert.match(calls, /plugin remove ai-fleas-gpt@personal/);
  const mergedData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-gpt-ai-fleas');
  assert.equal(fs.readFileSync(path.join(mergedData, 'agent-bindings.json'), 'utf8'), '{"bindings":[]}');
  assert.equal(fs.readFileSync(path.join(mergedData, 'bindings.json'), 'utf8'), '{"bindings":[]}');
  assert.equal(fs.readFileSync(path.join(mergedData, 'correlations', 'task.json'), 'utf8'), '{"task":"bound"}');
  assert.equal(fs.readFileSync(path.join(mergedData, 'legacy-receipt.json'), 'utf8'), '{"receipt":"preserved"}');
});

test('doctor reports migration-required when marketplace name points to another checkout', () => {
  const item = fixture({ marketplace: true, plugins: true, staleMarketplace: true });
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'migration-required');
  assert.equal(report.marketplaceRootMismatch.configured, '/private/tmp/stale-ai-fleas');
  assert.equal(report.marketplaceRootMismatch.expected, repositoryRoot);
});

test('setup requires explicit migration before relocating a marketplace', () => {
  const item = fixture({ marketplace: true, plugins: true, staleMarketplace: true });
  const blocked = run(item, ['setup']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /--migrate to relocate it/);
  assert.doesNotMatch(fs.readFileSync(item.log, 'utf8'), /plugin marketplace remove/);

  const migrated = run(item, ['setup', '--migrate']);
  assert.equal(migrated.status, 0, migrated.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin marketplace remove ai-fleas/);
  assert.match(calls, /plugin marketplace add/);
});
