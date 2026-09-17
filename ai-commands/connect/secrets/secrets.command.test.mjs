import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {consumerEnvironment, formatHermesEnv, inspectConfig, readBootstrap, resolveForConsumer, validateConfig, verifyConnection}
  from './secrets.command.mjs';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-secrets-test-'));
const bootstrap = path.join(folder, 'bootstrap.env');
fs.writeFileSync(bootstrap, 'INFISICAL_CLIENT_ID=synthetic-id\nINFISICAL_CLIENT_SECRET=synthetic-secret\n', {mode: 0o600});
const accessBootstrap = path.join(folder, 'access.env');
fs.writeFileSync(accessBootstrap, 'CF_ACCESS_CLIENT_ID=synthetic-access-id\nCF_ACCESS_CLIENT_SECRET=synthetic-access-secret\n', {mode: 0o600});
const sample = `provider: infisical
endpoint: https://secrets.example.invalid
provider_config:
  project_id: 00000000-0000-4000-8000-000000000000
  environment: dev
  machine_identity: example-runtime
  bootstrap_file: ${bootstrap}
secrets:
  example.dev.integration.api-token:
    ref: ${'${secret:example.dev.integration.api-token}'}
    backend:
      path: /
      key: EXAMPLE_API_TOKEN
command_injection:
  cloudflare:
    executable: connect/cloudflare/cloudflare.command.sh
    environment:
      EXAMPLE_API_TOKEN:
        logical_secret: example.dev.integration.api-token
policy:
  inject_at_execution_time: true
  delivery_scope: child-process-only
  persist_values_in_git: false
  persist_values_in_memory: false
  log_values: false
`;

test('validates a bounded profile mapping without network access', () => {
  const config = validateConfig(sample);
  assert.equal(config.provider_config.environment, 'dev');
  assert.equal(config.command_injection.cloudflare.environment.EXAMPLE_API_TOKEN.logical_secret,
    'example.dev.integration.api-token');
});

test('Hermes startup pipe emits only dotenv assignments and rejects line injection', () => {
  assert.equal(formatHermesEnv({SC_HERMES_SECRET: 'synthetic=value'}), 'SC_HERMES_SECRET=synthetic=value\n');
  assert.throws(() => formatHermesEnv({SC_HERMES_SECRET: 'safe\nOTHER=stolen'}), /INVALID_SECRET_VALUE/);
  assert.throws(() => formatHermesEnv({'BAD-KEY': 'value'}), /INVALID_SECRET_VALUE/);
});

test('consumer child does not inherit a different consumer credential or provider bootstrap', () => {
  const config = validateConfig(sample);
  config.command_injection['hermes-agents'] = {
    executable: 'system/hermes-agents/hermes-agents.command.sh',
    environment: {MODEL_ACCESS_SECRET: {logical_secret: 'example.dev.integration.api-token'}},
  };
  const child = consumerEnvironment(config, {EXAMPLE_API_TOKEN: 'fetched-value'}, {
    PATH: '/usr/bin', EXAMPLE_API_TOKEN: 'stale-value', MODEL_ACCESS_SECRET: 'model-value',
    INFISICAL_CLIENT_SECRET: 'bootstrap-value', CF_ACCESS_CLIENT_SECRET: 'access-value',
  });
  assert.deepEqual(child, {PATH: '/usr/bin', EXAMPLE_API_TOKEN: 'fetched-value'});
  const probe = spawnSync(process.execPath, ['-e', `
    process.stdout.write(JSON.stringify({
      selected: process.env.EXAMPLE_API_TOKEN === 'fetched-value',
      other: 'MODEL_ACCESS_SECRET' in process.env,
      provider: 'INFISICAL_CLIENT_SECRET' in process.env,
      access: 'CF_ACCESS_CLIENT_SECRET' in process.env,
    }));
  `], {env: child, encoding: 'utf8'});
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout), {
    selected: true, other: false, provider: false, access: false,
  });
});

test('an explicit none provider has no mappings and blocks resolution', async () => {
  const config = validateConfig('provider: none\n');
  assert.deepEqual(config, {provider: 'none'});
  assert.deepEqual(inspectConfig(config), {provider: 'none', environment: null, secrets: [], consumers: []});
  assert.throws(() => validateConfig('provider: none\nsecrets: {}\n'), /INVALID_CONFIG/);
  let calls = 0;
  const neverFetch = async () => { calls++; throw Error('fetch must not happen'); };
  await assert.rejects(verifyConnection(config, neverFetch), /PROVIDER_DISABLED/);
  await assert.rejects(resolveForConsumer(config, 'cloudflare', neverFetch), /PROVIDER_DISABLED/);
  assert.equal(calls, 0);
});

test('inspection reports only configured metadata without credentials or bootstrap details', () => {
  const metadata = inspectConfig(validateConfig(sample));
  assert.deepEqual(metadata, {
    provider: 'infisical', environment: 'dev',
    secrets: [{logical_name: 'example.dev.integration.api-token',
      backend: {path: '/', key: 'EXAMPLE_API_TOKEN'}}],
    consumers: [{command: 'cloudflare', environment: [{name: 'EXAMPLE_API_TOKEN',
      logical_secret: 'example.dev.integration.api-token'}]}],
  });
  const output = JSON.stringify(metadata);
  for (const forbidden of [bootstrap, 'synthetic-secret', '00000000-0000-4000-8000-000000000000',
    'https://secrets.example.invalid', 'example-runtime']) assert.equal(output.includes(forbidden), false);
});

test('rejects duplicate definitions and unsafe references', () => {
  assert.throws(() => validateConfig(sample + '\nendpoint: https://other.example.invalid\n'), /INVALID_CONFIG/);
  assert.throws(() => validateConfig(sample.replace('https://secrets.example.invalid', 'http://secrets.example.invalid')),
    /INVALID_ENDPOINT/);
  assert.throws(() => validateConfig(sample.replace('example.dev.integration.api-token}', 'example.dev.wrong.api-token}')),
    /INVALID_SECRET_REFERENCE/);
  assert.throws(() => validateConfig(sample.replace('connect/cloudflare/cloudflare.command.sh', '../../bin/sh')),
    /INVALID_EXECUTABLE/);
  assert.throws(() => validateConfig(sample.replace('connect/cloudflare/cloudflare.command.sh', 'system/hermes-agents/hermes-agents.command.sh')),
    /INVALID_EXECUTABLE/);
});

test('requires owner-only non-symlink bootstrap files', () => {
  assert.equal(readBootstrap(bootstrap, ['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET']).INFISICAL_CLIENT_ID,
    'synthetic-id');
  fs.chmodSync(bootstrap, 0o644);
  assert.throws(() => readBootstrap(bootstrap, ['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET']),
    /UNSAFE_BOOTSTRAP_FILE/);
  fs.chmodSync(bootstrap, 0o600);
  const link = path.join(folder, 'bootstrap-link');
  fs.symlinkSync(bootstrap, link);
  assert.throws(() => readBootstrap(link, ['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET']),
    /UNSAFE_BOOTSTRAP_FILE/);
});

test('authenticates and resolves only the declared secret for a consumer', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({url: String(url), options});
    if (calls.length === 1) return {status: 200, json: async () => ({accessToken: 'synthetic-access-token'})};
    return {status: 200, json: async () => ({secret: {secretValue: 'synthetic-value'}})};
  };
  const values = await resolveForConsumer(validateConfig(sample), 'cloudflare', fakeFetch);
  assert.deepEqual(values, {EXAMPLE_API_TOKEN: 'synthetic-value'});
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/api\/v4\/secrets\/EXAMPLE_API_TOKEN\?/);
  assert.match(calls[1].url, /environment=dev/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer synthetic-access-token');
  assert.equal(calls[1].options.redirect, 'manual');
});

test('Access redirects and missing secrets fail closed', async () => {
  const config = validateConfig(sample);
  await assert.rejects(verifyConnection(config, async () => ({status: 302})), /ACCESS_GATE_REQUIRED/);
  let count = 0;
  await assert.rejects(resolveForConsumer(config, 'cloudflare', async () => {
    count++;
    return count === 1 ? {status: 200, json: async () => ({accessToken: 'synthetic'})} : {status: 404};
  }), /SECRET_NOT_FOUND/);
  await assert.rejects(resolveForConsumer(config, 'unknown', async () => {
    throw Error('fetch must not happen');
  }), /UNKNOWN_CONSUMER/);
});

test('offline and unauthorized provider paths fail closed without leaking credentials', async () => {
  const config = validateConfig(sample);
  const assertBlocked = async (operation, code) => {
    await assert.rejects(operation, error => {
      assert.match(error.message, new RegExp(code));
      for (const value of ['synthetic-secret', 'synthetic-access-token', 'synthetic-value']) {
        assert.equal(error.message.includes(value), false);
      }
      return true;
    });
  };
  await assertBlocked(verifyConnection(config, async () => {
    throw Error('offline synthetic-secret');
  }), 'PROVIDER_UNREACHABLE');
  await assertBlocked(verifyConnection(config, async () => ({status: 401})), 'PROVIDER_AUTH_FAILED');
  let calls = 0;
  await assertBlocked(resolveForConsumer(config, 'cloudflare', async () => {
    calls++;
    return calls === 1
      ? {status: 200, json: async () => ({accessToken: 'synthetic-access-token'})}
      : {status: 403};
  }), 'SECRET_READ_FAILED');
  assert.equal(calls, 2);
});

test('missing Access bootstrap blocks before or during secret resolution', async () => {
  const missing = path.join(folder, 'missing-access.env');
  const config = validateConfig(sample.replace('  bootstrap_file: ' + bootstrap,
    '  bootstrap_file: ' + bootstrap + '\n  access_bootstrap_file: ' + missing));
  let calls = 0;
  await assert.rejects(verifyConnection(config, async () => {
    calls++;
    throw Error('fetch must not happen');
  }), /BOOTSTRAP_UNAVAILABLE/);
  assert.equal(calls, 0);

  const removed = path.join(folder, 'removed-access.env');
  fs.writeFileSync(removed, 'CF_ACCESS_CLIENT_ID=synthetic-id\nCF_ACCESS_CLIENT_SECRET=synthetic-secret\n',
    {mode: 0o600});
  const second = validateConfig(sample.replace('  bootstrap_file: ' + bootstrap,
    '  bootstrap_file: ' + bootstrap + '\n  access_bootstrap_file: ' + removed));
  await assert.rejects(resolveForConsumer(second, 'cloudflare', async () => {
    calls++;
    fs.unlinkSync(removed);
    return {status: 200, json: async () => ({accessToken: 'synthetic-access-token'})};
  }), /BOOTSTRAP_UNAVAILABLE/);
  assert.equal(calls, 1);
});

test('sends the separate Access bootstrap only to the configured provider endpoint', async () => {
  const config = validateConfig(sample.replace('  bootstrap_file: ' + bootstrap,
    '  bootstrap_file: ' + bootstrap + '\n  access_bootstrap_file: ' + accessBootstrap));
  const calls = [];
  await resolveForConsumer(config, 'cloudflare', async (url, options) => {
    calls.push({url: String(url), options});
    return calls.length === 1
      ? {status: 200, json: async () => ({accessToken: 'synthetic-access-token'})}
      : {status: 200, json: async () => ({secret: {secretValue: 'synthetic-value'}})};
  });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.url, /^https:\/\/secrets\.example\.invalid\/api\//);
    assert.equal(call.options.headers['CF-Access-Client-Id'], 'synthetic-access-id');
    assert.equal(call.options.headers['CF-Access-Client-Secret'], 'synthetic-access-secret');
    assert.equal(call.options.redirect, 'manual');
  }
});

test.after(() => fs.rmSync(folder, {recursive: true, force: true}));
