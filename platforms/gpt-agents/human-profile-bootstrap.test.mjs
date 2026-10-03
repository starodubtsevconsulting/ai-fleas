/** Run: node --test platforms/gpt-agents/human-profile-bootstrap.test.mjs.
 * Passing verifies pure scaffold contents and bounded filesystem effects with fake IO;
 * it does not prove live profile-catalog access or Governor activation.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import { HumanProfileBootstrap } from './human-profile-bootstrap.mjs';

const catalog = '/private/example-humans';

function fakeIO(exists = false) {
  const calls = [];
  const target = path.join(catalog, 'example-human');
  return { calls, io: {
    realpathSync: value => value,
    statSync: () => ({ isDirectory: () => true }),
    existsSync: value => exists && (value === target || value.startsWith(`${target}${path.sep}`)),
    lstatSync: value => ({ isDirectory: () => value === target, isFile: () => value !== target }),
    mkdirSync: (value, options) => calls.push({ kind: 'mkdir', value, options }),
    writeFileSync: (value, content, options) => calls.push({ kind: 'write', value, content, options }),
  } };
}

test('new human scaffold has exact identity, empty permissions, and writable local memory', () => {
  const bootstrap = new HumanProfileBootstrap();
  const files = bootstrap.render('example-human');
  const profile = YAML.parse(files.get('profile.yml'));
  const governor = YAML.parse(files.get('governor.yml'));
  const memory = YAML.parse(files.get('memory.yml'));
  assert.equal(profile.id, 'example-human');
  assert.deepEqual(profile.authorizedProfiles, []);
  assert.deepEqual(profile.authorizedWorkflows, []);
  assert.equal(governor.subject.id, 'example-human');
  assert.equal(governor.roleDefinition, 'ai-fleas://roles/personal-governor');
  assert.equal(governor.memory[0].provider, 'local-profile-memory');
  assert.equal(memory.permanentMemory.governor.path, 'memory/governor-memory.md');
  assert.match(files.get('memory/governor-memory.md'), /No plans or commitments/);
  assert.doesNotMatch([...files.values()].join(''), /jonathan-example|example-client/);
});

test('human ID permits an underscore without changing the exact selected identity', () => {
  const files = new HumanProfileBootstrap().render('example_human_2');
  assert.equal(YAML.parse(files.get('profile.yml')).id, 'example_human_2');
  assert.equal(YAML.parse(files.get('governor.yml')).subject.id, 'example_human_2');
});

test('creates only the selected missing human and never overwrites an existing profile', () => {
  const fresh = fakeIO();
  const result = new HumanProfileBootstrap(fresh.io).prepare(catalog, 'example-human');
  assert.equal(result.created, true);
  assert.equal(result.humanDir, path.join(catalog, 'example-human'));
  assert.deepEqual(fresh.calls.filter(call => call.kind === 'mkdir').map(call => call.value),
    [result.humanDir, path.join(result.humanDir, 'memory')]);
  assert.equal(fresh.calls.filter(call => call.kind === 'write').length, 4);
  assert.ok(fresh.calls.filter(call => call.kind === 'write')
    .every(call => call.options.flag === 'wx' && call.options.mode === 0o600));
  const existing = fakeIO(true);
  existing.io.existsSync = value => value === result.humanDir ||
    value === path.join(result.humanDir, 'profile.yml');
  assert.deepEqual(new HumanProfileBootstrap(existing.io).prepare(catalog, 'example-human'),
    { humanDir: result.humanDir, created: false });
  assert.deepEqual(existing.calls, []);
});

test('fails closed on unsafe IDs and absent catalog configuration', () => {
  const bootstrap = new HumanProfileBootstrap(fakeIO().io);
  assert.throws(() => bootstrap.prepare(catalog, '../wrong-human'), /GOVERNOR_HUMAN_ID_REQUIRED/);
  assert.throws(() => bootstrap.prepare(null, 'example-human'), /GOVERNOR_HUMAN_CATALOG_NOT_CONFIGURED/);
});

test('existing partial profiles and symlink targets are rejected without writes', () => {
  const partial = fakeIO(true);
  partial.io.existsSync = value => value === path.join(catalog, 'example-human');
  assert.throws(() => new HumanProfileBootstrap(partial.io).prepare(catalog, 'example-human'),
    /GOVERNOR_EXISTING_HUMAN_PROFILE_INCOMPLETE/);
  assert.deepEqual(partial.calls, []);
  const linked = fakeIO(true);
  linked.io.lstatSync = () => ({ isDirectory: () => false, isFile: () => false });
  assert.throws(() => new HumanProfileBootstrap(linked.io).prepare(catalog, 'example-human'),
    /GOVERNOR_EXISTING_HUMAN_PROFILE_INCOMPLETE/);
  assert.deepEqual(linked.calls, []);
});

test('catalog not found is reported as an actionable error', () => {
  const absent = fakeIO();
  absent.io.realpathSync = () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; };
  assert.throws(() => new HumanProfileBootstrap(absent.io).prepare(catalog, 'example-human'),
    /GOVERNOR_HUMAN_CATALOG_NOT_FOUND/);
});
