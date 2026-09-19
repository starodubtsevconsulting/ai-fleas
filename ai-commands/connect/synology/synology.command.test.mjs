import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {validateConfig} from './synology.command.mjs';

const sample = `nas:\n  host: synology.local\n  https_port: 5001\n  certificate_sha256: AA\n  remote_access:\n    mode: private-tunnel\n    host: TODO_PRIVATE_TUNNEL_HOSTNAME\n    quickconnect: false\nshares:\n  incorporated:\n    name: incorporated\n    account: agent-incorporated\n    access: read-only\n    credential:\n      username_secret: example.dev.synology.incorporated-username\n      password_secret: example.dev.synology.incorporated-password\n    workflow: financial-insights\n    source: /data/incorparated\n    projection:\n      type: synology-drive\n      team_folder: incorporated\n      local_path: TODO_LOCAL_SYNC_PATH\n      sync_mode: download-only\n    usage: memory\n    mutation: source-control\n    repository:\n      id: example-memory\n      branch: main\n      subpath: documents/incorparated\n      delivery: on-merge\n      publisher_checkout: TODO_PUBLISHER_GIT_CHECKOUT\n`;

test('validates a named share without credentials', () => {
  const config = validateConfig(sample);
  assert.equal(config.shares.incorporated.access, 'read-only');
  assert.equal(config.shares.incorporated.repository.id, 'example-memory');
  assert.equal(sample.includes('secretValue'), false);
});

test('rejects relative paths and unsafe access', () => {
  assert.throws(() => validateConfig(sample.replace('/data/incorparated', '../data')), /INVALID_SHARE/);
  assert.throws(() => validateConfig(sample.replace('read-only', 'admin')), /INVALID_SHARE/);
  assert.throws(() => validateConfig(sample.replace('read-only', 'read-write')), /INVALID_SHARE/);
});

test('authenticated API status fails before network access when admin secrets are absent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synology-command-'));
  const config = path.join(dir, 'config.yml');
  fs.writeFileSync(config, sample);
  const command = fileURLToPath(new URL('./synology.command.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, 'api', 'status', 'incorporated'], {
    encoding:'utf8', env:{...process.env, AI_COMMAND_CONFIG_PATH:config, SYNOLOGY_ADMIN_USERNAME:'', SYNOLOGY_ADMIN_PASSWORD:''}
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /DSM_ADMIN_CREDENTIALS_REQUIRED/);
  fs.rmSync(dir, {recursive:true, force:true});
});

test('share plan declares generated credential delivery without producing a value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synology-command-'));
  const config = path.join(dir, 'config.yml');
  fs.writeFileSync(config, sample);
  const command = fileURLToPath(new URL('./synology.command.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, 'share', 'plan', 'incorporated'], {
    encoding:'utf8', env:{...process.env, AI_COMMAND_CONFIG_PATH:config}
  });
  assert.equal(result.status, 0);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.secrets.generated_consumer_credential.printed, false);
  assert.equal(plan.secrets.generated_consumer_credential.persisted_locally, false);
  assert.match(plan.secrets.generated_consumer_credential.password, /generated in memory/);
  assert.equal(result.stdout.includes('secretValue'), false);
  fs.rmSync(dir, {recursive:true, force:true});
});

test('supports a direct bidirectional Governor memory mapping without a repository', () => {
  const governor = `nas:\n  host: synology.local\n  https_port: 5001\n  certificate_sha256: AA\n  remote_access:\n    mode: none\n    quickconnect: false\nshares:\n  governor:\n    name: governor\n    account: agent-governor\n    access: read-write\n    credential:\n      username_secret: example.dev.synology.governor-username\n      password_secret: example.dev.synology.governor-password\n    workflow: personal-governor\n    source: /data/governor\n    projection:\n      type: synology-drive\n      team_folder: governor\n      local_path: /data/governor\n      sync_mode: bidirectional\n    usage: memory\n    mutation: direct\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synology-command-'));
  const config = path.join(dir, 'config.yml');
  fs.writeFileSync(config, governor);
  const command = fileURLToPath(new URL('./synology.command.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, 'mapping', 'status', 'governor'], {
    encoding:'utf8', env:{...process.env, AI_COMMAND_CONFIG_PATH:config}
  });
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.equal(status.publisher_checkout, null);
  assert.equal(status.blockers.includes('PUBLISHER_CHECKOUT_NOT_CONFIGURED'), false);
  fs.rmSync(dir, {recursive:true, force:true});
});
