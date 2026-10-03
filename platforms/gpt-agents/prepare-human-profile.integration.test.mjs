/** Run: node --test platforms/gpt-agents/prepare-human-profile.integration.test.mjs.
 * Passing proves the real launcher command resolves and preflights an existing
 * profile through its selected location without writing operational logs.
 * It does not prove creation of a new profile or desktop Governor activation.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import YAML from 'yaml';
import { HumanProfileBootstrap } from './human-profile-bootstrap.mjs';

const launcher = fileURLToPath(new URL('./launcher.mjs', import.meta.url));
const catalog = fileURLToPath(new URL('./fixtures/governor/', import.meta.url));
const localHuman = fileURLToPath(new URL('./fixtures/governor/local-human/', import.meta.url));

function prepare(id, humansDir = catalog) {
  return spawnSync(process.execPath, [launcher, 'prepare-human-profile', '--human', id], {
    encoding: 'utf8',
    env: { ...process.env, AI_FLEAS_HUMANS_DIR: humansDir },
  });
}

test('real CLI preflights an existing human without creating or changing it', () => {
  const profileFile = new URL('./fixtures/governor/local-human/profile.yml', import.meta.url);
  const before = fs.statSync(profileFile).mtimeMs;
  const result = prepare('local-human');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { humanDir: localHuman.replace(/\/$/, ''),
    created: false, source: 'configured' });
  assert.equal(fs.statSync(profileFile).mtimeMs, before);
});

test('the checked-in first-create fixture matches current scaffold and CLI preflight', () => {
  const result = prepare('bootstrap-human');
  assert.equal(result.status, 0, result.stderr);
  const { humanDir, created } = JSON.parse(result.stdout);
  assert.equal(created, false);
  const files = new HumanProfileBootstrap().render('bootstrap-human');
  for (const [relative, expected] of files) {
    const actual = fs.readFileSync(path.join(humanDir, relative), 'utf8');
    if (relative === 'governor.yml')
      assert.deepEqual(YAML.parse(actual), YAML.parse(expected));
    else assert.equal(actual, expected);
  }
});
