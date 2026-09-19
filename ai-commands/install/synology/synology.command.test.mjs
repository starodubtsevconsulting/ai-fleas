import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from './synology.command.mjs';

const sample = `nas:\n  host: synology.local\n  https_port: 5001\n  certificate_sha256: AA\n  remote_access:\n    mode: private-tunnel\n    host: TODO_PRIVATE_TUNNEL_HOSTNAME\n    quickconnect: false\nshares:\n  incorporated:\n    name: incorporated\n    account: agent-incorporated\n    access: read-only\n    workflow: financial-insights\n    source: /data/incorparated\n    projection:\n      type: synology-drive\n      team_folder: incorporated\n      local_path: TODO_LOCAL_SYNC_PATH\n      sync_mode: download-only\n    usage: memory\n    mutation: source-control\n    repository:\n      id: sc-memory\n      branch: main\n      subpath: documents/incorparated\n      delivery: on-merge\n      publisher_checkout: TODO_INFRA_01_GIT_CHECKOUT\n`;

test('validates a named share without credentials', () => {
  const config = validateConfig(sample);
  assert.equal(config.shares.incorporated.access, 'read-only');
  assert.equal(config.shares.incorporated.repository.id, 'sc-memory');
  assert.equal(sample.includes('password'), false);
});

test('rejects relative paths and unsafe access', () => {
  assert.throws(() => validateConfig(sample.replace('/data/incorparated', '../data')), /INVALID_SHARE/);
  assert.throws(() => validateConfig(sample.replace('read-only', 'admin')), /INVALID_SHARE/);
  assert.throws(() => validateConfig(sample.replace('read-only', 'read-write')), /INVALID_SHARE/);
});
