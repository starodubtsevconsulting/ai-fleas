import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const launcher = fileURLToPath(new URL('./launcher.mjs', import.meta.url));

function fixture({ marketplace = false, plugins = false, legacy = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-gpt-launcher-'));
  const bin = path.join(root, 'bin');
  const app = path.join(root, 'ChatGPT.app');
  const log = path.join(root, 'calls.log');
  const state = path.join(root, 'state');
  fs.mkdirSync(bin);
  fs.mkdirSync(app);
  fs.writeFileSync(state, `${marketplace ? 'marketplace' : ''}\n${plugins ? 'plugins' : ''}\n${legacy ? 'legacy' : ''}\n`);
  const codex = path.join(bin, 'codex');
  const open = path.join(bin, 'open');
  fs.writeFileSync(codex, `#!/bin/sh
printf '%s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
case "$*" in
  '--version') echo 'codex-test 1.0' ;;
  'plugin marketplace list --json')
    if grep -q marketplace "$AI_FLEAS_TEST_STATE"; then echo '{"marketplaces":[{"name":"ai-fleas"}]}'; else echo '{"marketplaces":[]}'; fi ;;
  'plugin marketplace add '*) printf 'marketplace\\n' >> "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin add '*) printf 'plugins\\n' >> "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin remove '*) sed -i.bak '/legacy/d' "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin list --json')
    if grep -q plugins "$AI_FLEAS_TEST_STATE"; then
      if grep -q legacy "$AI_FLEAS_TEST_STATE"; then
        echo '{"installed":[{"pluginId":"ai-fleas-agent-bootstrap@ai-fleas","enabled":true},{"pluginId":"ai-fleas-workflow-router@ai-fleas","enabled":true},{"pluginId":"ai-fleas-agent-bootstrap@personal","enabled":true}]}'
      else echo '{"installed":[{"pluginId":"ai-fleas-agent-bootstrap@ai-fleas","enabled":true},{"pluginId":"ai-fleas-workflow-router@ai-fleas","enabled":true}]}'; fi
    elif grep -q legacy "$AI_FLEAS_TEST_STATE"; then
      echo '{"installed":[{"pluginId":"ai-fleas-agent-bootstrap@personal","enabled":true}]}'
    else echo '{"installed":[]}'; fi ;;
  *) echo '{}' ;;
esac
`);
  fs.writeFileSync(open, '#!/bin/sh\nprintf \'open %s\\n\' "$*" >> "$AI_FLEAS_TEST_LOG"\n');
  fs.chmodSync(codex, 0o755);
  fs.chmodSync(open, 0o755);
  return { root, app, log, state, codex, open };
}

function run(item, args) {
  return spawnSync(process.execPath, [launcher, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AI_FLEAS_OS: 'darwin',
      AI_FLEAS_CODEX_BIN: item.codex,
      AI_FLEAS_OPEN_BIN: item.open,
      AI_FLEAS_CHATGPT_APP: item.app,
      AI_FLEAS_TEST_LOG: item.log,
      AI_FLEAS_TEST_STATE: item.state,
      XDG_CONFIG_HOME: path.join(item.root, 'config'),
    },
  });
}

test('doctor reports setup-required when marketplace and plugins are absent', () => {
  const item = fixture();
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'setup-required');
});

test('setup adds marketplace and both plugins', () => {
  const item = fixture();
  const result = run(item, ['setup']);
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin marketplace add/);
  assert.match(calls, /plugin add ai-fleas-agent-bootstrap@ai-fleas/);
  assert.match(calls, /plugin add ai-fleas-workflow-router@ai-fleas/);
});

test('launch opens ChatGPT only when setup is ready', () => {
  const item = fixture({ marketplace: true, plugins: true });
  const result = run(item, ['launch']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(item.log, 'utf8'), /open -a ChatGPT/);
});

test('doctor reports migration-required for a duplicate plugin name', () => {
  const item = fixture({ marketplace: true, plugins: true, legacy: true });
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'migration-required');
  assert.deepEqual(report.conflictingPlugins, ['ai-fleas-agent-bootstrap@personal']);
});

test('setup requires explicit migration before replacing an older marketplace copy', () => {
  const item = fixture({ marketplace: true, plugins: true, legacy: true });
  const blocked = run(item, ['setup']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /--migrate/);
  assert.doesNotMatch(fs.readFileSync(item.log, 'utf8'), /plugin remove/);

  const migrated = run(item, ['setup', '--migrate']);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.match(fs.readFileSync(item.log, 'utf8'), /plugin remove ai-fleas-agent-bootstrap@personal/);
});
