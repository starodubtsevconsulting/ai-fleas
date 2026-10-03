/** Run: node --test platforms/gpt-agents/human-profile-store.test.mjs.
 * Passing verifies catalog precedence and bounded default creation with fake IO;
 * it does not prove a live desktop profile or Governor lifecycle transaction.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { HumanProfileStore } from './human-profile-store.mjs';

function fixture(environment = {}, configContents = null) {
  const calls = [];
  const file = '/private/example-home/.config/ai-fleas/gpt-agents/humans-dir';
  const io = {
    existsSync: value => value === file && configContents != null,
    readFileSync: value => { assert.equal(value, file); return configContents; },
    mkdirSync: (value, options) => calls.push({ value, options }),
  };
  return { calls, locator: new HumanProfileStore({ io, environment, home: '/private/example-home' }) };
}

test('uses an app-owned home-folder store when no explicit location exists', () => {
  const { locator, calls } = fixture();
  assert.equal(locator.resolve({ createDefault: true }), '/private/example-home/.local/share/ai-fleas/humans');
  assert.deepEqual(calls, [{ value: '/private/example-home/.local/share/ai-fleas/humans',
    options: { recursive: true, mode: 0o700 } }]);
});

test('environment and configured catalogs take precedence without creating a default', () => {
  const environment = fixture({ AI_FLEAS_HUMANS_DIR: '/private/selected-humans' }, '/private/saved-humans');
  assert.equal(environment.locator.resolve({ createDefault: true }), '/private/selected-humans');
  assert.deepEqual(environment.calls, []);
  const saved = fixture({}, '/private/saved-humans\n');
  assert.equal(saved.locator.resolve({ createDefault: true }), '/private/saved-humans');
  assert.deepEqual(saved.calls, []);
});

test('blank configured catalog fails closed', () => {
  const { locator, calls } = fixture({}, '\n');
  assert.throws(() => locator.resolve({ createDefault: true }), /GOVERNOR_HUMAN_CATALOG_CONFIG_EMPTY/);
  assert.deepEqual(calls, []);
});

test('relative store locations fail before any directory is created', () => {
  const selected = fixture({ AI_FLEAS_HUMANS_DIR: 'relative/humans' });
  assert.throws(() => selected.locator.resolve({ createDefault: true }),
    /GOVERNOR_HUMAN_LOCATION_NOT_ABSOLUTE/);
  assert.deepEqual(selected.calls, []);
  const defaultRoot = fixture({ XDG_DATA_HOME: 'relative/data' });
  assert.throws(() => defaultRoot.locator.resolve({ createDefault: true }),
    /GOVERNOR_HUMAN_STORE_ROOT_NOT_ABSOLUTE/);
  assert.deepEqual(defaultRoot.calls, []);
});
