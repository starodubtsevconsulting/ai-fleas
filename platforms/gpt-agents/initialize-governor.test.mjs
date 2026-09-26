import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildGovernorInitialization } from './initialize-governor.mjs';

const humanDir = fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url));
const usableProvider = () => ({
  status: 0,
  stdout: 'provider=synology\nreachable=true\naccess=read-write\nwritable=true\n',
  stderr: '',
});

test('builds a compact exact-human Governor initialization from declared sources', () => {
  const { binding, prompt } = buildGovernorInitialization(humanDir, 'example-human', 3, {
    checkProvider: usableProvider,
  });
  assert.equal(binding.agentId, 'personal-governor');
  assert.equal(binding.generation, 3);
  assert.deepEqual(binding.scope, { kind: 'governed-human', humanProfileId: 'example-human' });
  assert.equal(binding.initialization.memoryBinding, 'profile-memory://governor');
  assert.equal(binding.initialization.readinessToken, 'PERSONAL_GOVERNOR_READY');
  assert.ok(binding.initialization.sources.every(source => path.isAbsolute(source.ref)));
  assert.match(prompt, /Initialize Personal Governor for example-human/);
});

test('rejects identity mismatch and unusable memory before registering a task', () => {
  assert.throws(() => buildGovernorInitialization(humanDir, 'someone-else', 1, {
    checkProvider: usableProvider,
  }), /human profile ID or type does not match/);
  assert.throws(() => buildGovernorInitialization(humanDir, 'example-human', 1, {
    checkProvider: () => ({ status: 0, stdout: 'provider=synology\nreachable=true\naccess=read-write\nwritable=false\n' }),
  }), /memory is not usable/);
});
