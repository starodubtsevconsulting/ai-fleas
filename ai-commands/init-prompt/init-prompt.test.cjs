const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const scriptPath = path.join(__dirname, 'init-prompt.sh');
const projectDir = path.join(repoRoot, 'ai');
const tick = '`';

function runInitPrompt(env, args = []) {
  return spawnSync(
    'bash',
    [scriptPath, '--project-dir', projectDir, '--project-label', 'ai', ...args],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
      },
      encoding: 'utf8',
    },
  );
}

test('init prompt keeps markdown placeholders literal and reports terminal UI mode', () => {
  const sessionRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'init-prompt-session-root-'),
  );
  const result = runInitPrompt(
    {
      AI_SESSIONS_ROOT: sessionRoot,
      AI_SESSION_UI_MODE: 'terminal',
    },
    ['--task', 'test startup', '--scope', 'prove prompt quoting'],
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Session UI mode: terminal\./);
  assert.match(result.stdout, /Session task: test startup/);
  assert.match(result.stdout, /Session scope: prove prompt quoting/);
  assert.ok(result.stdout.includes(`${tick}AI_SESSIONS_ROOT${tick}`));
  assert.ok(
    result.stdout.includes(
      `${tick}<session-root>/.current-session-path${tick}`,
    ),
  );
  assert.doesNotMatch(
    result.stderr + result.stdout,
    /command not found|No such file or directory/,
  );
});

test('init prompt resolves terminal UI mode from current-ui-mode file', () => {
  const sessionRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'init-prompt-session-root-'),
  );
  fs.writeFileSync(path.join(sessionRoot, '.current-ui-mode'), 'terminal\n');
  const result = runInitPrompt({
    AI_SESSIONS_ROOT: sessionRoot,
    AI_SESSION_UI_MODE: '',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Session UI mode: terminal\./);
});
