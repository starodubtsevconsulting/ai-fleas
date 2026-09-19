import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from './synology.command.mjs';

const sample = `nas:\n  host: synology.local\n  https_port: 5001\n  certificate_sha256: AA\nshares:\n  incorporated:\n    name: incorporated\n    account: agent-incorporated\n    access: read-only\n    source: /data/incorparated\n    mount: /Volumes/incorporated\n`;

test('validates a named share without credentials', () => {
  const config = validateConfig(sample);
  assert.equal(config.shares.incorporated.access, 'read-only');
  assert.equal(sample.includes('password'), false);
});

test('rejects relative paths and unsafe access', () => {
  assert.throws(() => validateConfig(sample.replace('/data/incorparated', '../data')), /INVALID_SHARE/);
  assert.throws(() => validateConfig(sample.replace('read-only', 'admin')), /INVALID_SHARE/);
});
