import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootInstaller = fileURLToPath(new URL('../../../Install AI Fleas.command', import.meta.url));

function fixture({ pinned = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-macos-installer-'));
  const bin = path.join(root, 'bin');
  const applications = path.join(root, 'Applications');
  const log = path.join(root, 'calls.log');
  fs.mkdirSync(bin);

  const osacompile = path.join(bin, 'osacompile');
  fs.writeFileSync(osacompile, `#!/bin/sh
printf 'osacompile %s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
while [ "$#" -gt 0 ]; do
  if [ "$1" = -o ]; then
    shift
    mkdir -p "$1/Contents/Resources"
    exit 0
  fi
  shift
done
exit 1
`);

  const defaults = path.join(bin, 'defaults');
  fs.writeFileSync(defaults, `#!/bin/sh
printf 'defaults %s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
if [ "$1" = read ] && [ "${pinned ? '1' : '0'}" = 1 ]; then echo 'AI Fleas GPT.app'; fi
`);

  for (const command of ['open', 'killall']) {
    const executable = path.join(bin, command);
    fs.writeFileSync(executable, `#!/bin/sh
printf '${command} %s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
`);
    fs.chmodSync(executable, 0o755);
  }
  fs.chmodSync(osacompile, 0o755);
  fs.chmodSync(defaults, 0o755);

  return {
    root,
    applications,
    log,
    env: {
      ...process.env,
      AI_FLEAS_APPLICATIONS_DIR: applications,
      AI_FLEAS_OSACOMPILE_BIN: osacompile,
      AI_FLEAS_DEFAULTS_BIN: defaults,
      AI_FLEAS_OPEN_BIN: path.join(bin, 'open'),
      AI_FLEAS_KILLALL_BIN: path.join(bin, 'killall'),
      AI_FLEAS_SKIP_APP_ICON: '1',
      AI_FLEAS_TEST_LOG: log,
    },
  };
}

test('root installer creates, pins, and launches the macOS app', () => {
  const item = fixture();
  const result = spawnSync('/bin/zsh', [rootInstaller], { encoding: 'utf8', env: item.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(item.applications, 'AI Fleas GPT.app')), true);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /osacompile -o .*AI Fleas GPT\.app/);
  assert.match(calls, /defaults write com\.apple\.dock persistent-apps -array-add/);
  assert.match(calls, /killall Dock/);
  assert.match(calls, /open .*AI Fleas GPT\.app/);
});

test('root installer does not duplicate an existing Dock icon', () => {
  const item = fixture({ pinned: true });
  const result = spawnSync('/bin/zsh', [rootInstaller], { encoding: 'utf8', env: item.env });
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.doesNotMatch(calls, /defaults write/);
  assert.doesNotMatch(calls, /killall Dock/);
  assert.match(calls, /open .*AI Fleas GPT\.app/);
});
