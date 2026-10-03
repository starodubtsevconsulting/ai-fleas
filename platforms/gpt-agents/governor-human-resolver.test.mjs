/** Run: node --test platforms/gpt-agents/governor-human-resolver.test.mjs.
 * Passing verifies receipt reuse, local-store creation routing, and conflict
 * failure with injected collaborators; it does not prove live Governor activation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { GovernorHumanResolver } from './governor-human-resolver.mjs';

const receipt = { instances: { exact: { agentId: 'personal-governor',
  scope: { humanProfileId: 'example-human' } } } };

test('an existing receipt wins over a new local profile', () => {
  const calls = [];
  const resolver = new GovernorHumanResolver({
    store: { explicitLocation: () => null, resolve: () => { throw new Error('must not create'); } },
    resolveReceipt: () => '/private/old-humans/example-human',
    bootstrap: { prepare: () => { throw new Error('must not scaffold'); } },
  });
  assert.deepEqual(resolver.resolve(receipt, 'example-human'),
    { humanDir: '/private/old-humans/example-human', created: false, source: 'verified-receipt' });
  assert.deepEqual(calls, []);
});

test('a new human is scaffolded in the adapter-owned local store', () => {
  const calls = [];
  const resolver = new GovernorHumanResolver({
    store: { explicitLocation: () => null,
      resolve: options => { calls.push(options); return '/private/local-store'; } },
    bootstrap: { prepare: (root, id) => {
      calls.push({ root, id });
      return { humanDir: `${root}/${id}`, created: true };
    } },
  });
  assert.deepEqual(resolver.resolve({ instances: {} }, 'example-human'),
    { humanDir: '/private/local-store/example-human', created: true, source: 'local-store' });
  assert.deepEqual(calls, [{ createDefault: true }, { root: '/private/local-store', id: 'example-human' }]);
});

test('explicit location cannot silently relocate an existing receipt', () => {
  const resolver = new GovernorHumanResolver({
    io: { realpathSync: value => value },
    store: { explicitLocation: () => '/private/selected-humans' },
    resolveReceipt: () => '/private/old-humans/example-human',
  });
  assert.throws(() => resolver.resolve(receipt, 'example-human'), /GOVERNOR_HUMAN_LOCATION_CONFLICT/);
});

test('unsafe IDs are rejected before resolving or creating a store', () => {
  const resolver = new GovernorHumanResolver({
    store: { explicitLocation: () => { throw new Error('store was accessed'); } },
  });
  assert.throws(() => resolver.resolve({ instances: {} }, '../outside'), /GOVERNOR_HUMAN_ID_REQUIRED/);
});
