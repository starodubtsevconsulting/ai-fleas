#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import YAML from 'yaml';

const logicalPattern = /^[a-z0-9-]+(?:\.[a-z0-9-]+){3,}$/;
const envPattern = /^[A-Z_][A-Z0-9_]*$/;
const segmentPattern = /^[A-Za-z0-9_-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SecretsBlocked extends Error {
  constructor(code) { super(code); this.name = 'SecretsBlocked'; }
}

function blocked(code) { throw new SecretsBlocked(code); }

function parseYaml(source) {
  const document = YAML.parseDocument(source, { uniqueKeys: true, strict: true });
  if (document.errors.length) blocked('INVALID_CONFIG');
  return document.toJS();
}

function exactKeys(value, names, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) blocked(code);
  if (Object.keys(value).some(key => !names.includes(key))) blocked(code);
}

function safeEndpoint(value) {
  if (typeof value !== 'string') blocked('INVALID_ENDPOINT');
  let url;
  try { url = new URL(value); } catch { blocked('INVALID_ENDPOINT'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.port) blocked('INVALID_ENDPOINT');
  return url.origin;
}

function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') ||
      value !== '/' && value.split('/').slice(1).some(part => !segmentPattern.test(part))) {
    blocked('INVALID_SECRET_PATH');
  }
}

function expandHome(value) {
  if (typeof value !== 'string') blocked('INVALID_BOOTSTRAP_PATH');
  return value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
}

export function validateConfig(source) {
  const config = parseYaml(source);
  if (config?.provider === 'none') {
    exactKeys(config, ['provider'], 'INVALID_CONFIG');
    return config;
  }
  exactKeys(config, ['provider', 'endpoint', 'provider_config', 'secrets', 'command_injection', 'policy'], 'INVALID_CONFIG');
  if (config.provider !== 'infisical') blocked('UNSUPPORTED_PROVIDER');
  config.endpoint = safeEndpoint(config.endpoint);
  exactKeys(config.provider_config, ['project_id', 'environment', 'machine_identity', 'bootstrap_file', 'access_bootstrap_file'], 'INVALID_PROVIDER_CONFIG');
  if (!uuidPattern.test(config.provider_config.project_id || '')) blocked('INVALID_PROJECT_ID');
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(config.provider_config.environment || '')) blocked('INVALID_ENVIRONMENT');
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(config.provider_config.machine_identity || '')) blocked('INVALID_MACHINE_IDENTITY');
  for (const key of ['bootstrap_file', 'access_bootstrap_file']) {
    if (key === 'access_bootstrap_file' && config.provider_config[key] == null) continue;
    const target = expandHome(config.provider_config[key]);
    if (!path.isAbsolute(target) || target.includes('\n') || target.includes('\r') ||
        target.split(path.sep).includes('..')) blocked('INVALID_BOOTSTRAP_PATH');
    config.provider_config[key] = target;
  }
  exactKeys(config.secrets, Object.keys(config.secrets || {}), 'INVALID_SECRETS');
  if (!Object.keys(config.secrets).length) blocked('EMPTY_SECRETS');
  for (const [logical, item] of Object.entries(config.secrets)) {
    if (!logicalPattern.test(logical)) blocked('INVALID_LOGICAL_NAME');
    exactKeys(item, ['ref', 'backend'], 'INVALID_SECRET_MAPPING');
    if (item.ref !== '${secret:' + logical + '}') blocked('INVALID_SECRET_REFERENCE');
    exactKeys(item.backend, ['path', 'key'], 'INVALID_SECRET_MAPPING');
    safePath(item.backend.path);
    if (typeof item.backend.key !== 'string' || !segmentPattern.test(item.backend.key)) blocked('INVALID_SECRET_KEY');
  }
  exactKeys(config.command_injection, Object.keys(config.command_injection || {}), 'INVALID_INJECTION');
  if (!Object.keys(config.command_injection).length) blocked('EMPTY_CONSUMERS');
  for (const [consumer, item] of Object.entries(config.command_injection)) {
    if (!/^[a-z][a-z0-9-]*$/.test(consumer)) blocked('INVALID_CONSUMER');
    exactKeys(item, ['executable', 'environment'], 'INVALID_INJECTION');
    if (typeof item.executable !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(item.executable) ||
        item.executable.startsWith('/') || item.executable.split('/').includes('..') ||
        path.posix.basename(item.executable) !== `${consumer}.command.sh` ||
        path.posix.basename(path.posix.dirname(item.executable)) !== consumer) blocked('INVALID_EXECUTABLE');
    exactKeys(item.environment, Object.keys(item.environment || {}), 'INVALID_INJECTION');
    if (!Object.keys(item.environment).length) blocked('EMPTY_INJECTION');
    for (const [name, ref] of Object.entries(item.environment)) {
      if (!envPattern.test(name)) blocked('INVALID_ENVIRONMENT_NAME');
      exactKeys(ref, ['logical_secret'], 'INVALID_INJECTION');
      if (!Object.hasOwn(config.secrets, ref.logical_secret)) blocked('UNKNOWN_LOGICAL_SECRET');
    }
  }
  exactKeys(config.policy, ['inject_at_execution_time', 'delivery_scope', 'persist_values_in_git',
    'persist_values_in_memory', 'log_values'], 'INVALID_POLICY');
  if (config.policy.inject_at_execution_time !== true ||
      config.policy.delivery_scope !== 'child-process-only' ||
      config.policy.persist_values_in_git !== false ||
      config.policy.persist_values_in_memory !== false ||
      config.policy.log_values !== false) blocked('UNSAFE_POLICY');
  return config;
}

export function inspectConfig(config) {
  if (config.provider === 'none') {
    return {provider: 'none', environment: null, secrets: [], consumers: []};
  }
  return {
    provider: config.provider,
    environment: config.provider_config.environment,
    secrets: Object.entries(config.secrets).sort(([a], [b]) => a.localeCompare(b))
      .map(([logicalName, item]) => ({logical_name: logicalName,
        backend: {path: item.backend.path, key: item.backend.key}})),
    consumers: Object.entries(config.command_injection).sort(([a], [b]) => a.localeCompare(b))
      .map(([command, item]) => ({command,
        environment: Object.entries(item.environment).sort(([a], [b]) => a.localeCompare(b))
          .map(([name, mapping]) => ({name, logical_secret: mapping.logical_secret}))})),
  };
}

export function readBootstrap(filename, names) {
  let stat, source;
  try {
    stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() ||
        (stat.mode & 0o077) !== 0 || stat.size > 4096) blocked('UNSAFE_BOOTSTRAP_FILE');
    source = fs.readFileSync(filename, 'utf8');
  } catch (error) {
    if (error instanceof SecretsBlocked) throw error;
    blocked('BOOTSTRAP_UNAVAILABLE');
  }
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=([^\r\n]+)$/);
    if (!match || !names.includes(match[1]) || Object.hasOwn(values, match[1])) blocked('INVALID_BOOTSTRAP_FILE');
    values[match[1]] = match[2];
  }
  if (names.some(name => !values[name])) blocked('INCOMPLETE_BOOTSTRAP');
  return values;
}

function accessHeaders(config) {
  const file = config.provider_config.access_bootstrap_file;
  if (!file) return {};
  const values = readBootstrap(file, ['CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']);
  return {'CF-Access-Client-Id': values.CF_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret': values.CF_ACCESS_CLIENT_SECRET};
}

async function postLogin(config, fetcher = fetch) {
  const auth = readBootstrap(config.provider_config.bootstrap_file,
    ['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET']);
  let response;
  try {
    response = await fetcher(config.endpoint + '/api/v1/auth/universal-auth/login', {
      method: 'POST', redirect: 'manual',
      headers: {'Content-Type': 'application/json', ...accessHeaders(config)},
      body: JSON.stringify({clientId: auth.INFISICAL_CLIENT_ID,
        clientSecret: auth.INFISICAL_CLIENT_SECRET}),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error instanceof SecretsBlocked) throw error;
    blocked('PROVIDER_UNREACHABLE');
  }
  if (response.status !== 200) blocked(response.status >= 300 && response.status < 400 ?
    'ACCESS_GATE_REQUIRED' : 'PROVIDER_AUTH_FAILED');
  let body;
  try { body = await response.json(); } catch { blocked('INVALID_PROVIDER_RESPONSE'); }
  if (typeof body?.accessToken !== 'string' || !body.accessToken) blocked('INVALID_PROVIDER_RESPONSE');
  return body.accessToken;
}

export async function verifyConnection(config, fetcher = fetch) {
  if (config.provider === 'none') blocked('PROVIDER_DISABLED');
  await postLogin(config, fetcher);
}

export async function resolveForConsumer(config, consumer, fetcher = fetch) {
  if (config.provider === 'none') blocked('PROVIDER_DISABLED');
  const declaration = config.command_injection[consumer];
  if (!declaration) blocked('UNKNOWN_CONSUMER');
  const token = await postLogin(config, fetcher);
  const result = {};
  for (const [name, ref] of Object.entries(declaration.environment)) {
    const mapping = config.secrets[ref.logical_secret].backend;
    const url = new URL(config.endpoint + '/api/v4/secrets/' + encodeURIComponent(mapping.key));
    url.searchParams.set('projectId', config.provider_config.project_id);
    url.searchParams.set('environment', config.provider_config.environment);
    url.searchParams.set('secretPath', mapping.path);
    url.searchParams.set('type', 'shared');
    url.searchParams.set('expandSecretReferences', 'false');
    let response;
    try {
      response = await fetcher(url, {redirect: 'manual',
        headers: {Authorization: 'Bearer ' + token, ...accessHeaders(config)},
        signal: AbortSignal.timeout(10000)});
    } catch (error) {
      if (error instanceof SecretsBlocked) throw error;
      blocked('PROVIDER_UNREACHABLE');
    }
    if (response.status !== 200) blocked(response.status === 404 ? 'SECRET_NOT_FOUND' :
      response.status >= 300 && response.status < 400 ? 'ACCESS_GATE_REQUIRED' : 'SECRET_READ_FAILED');
    let body;
    try { body = await response.json(); } catch { blocked('INVALID_PROVIDER_RESPONSE'); }
    if (typeof body?.secret?.secretValue !== 'string' || !body.secret.secretValue) blocked('INVALID_SECRET_VALUE');
    result[name] = body.secret.secretValue;
  }
  return result;
}

export function formatHermesEnv(values) {
  const lines = [];
  for (const [name, value] of Object.entries(values)) {
    if (!envPattern.test(name) || typeof value !== 'string' || !value || /[\r\n]/.test(value)) {
      blocked('INVALID_SECRET_VALUE');
    }
    lines.push(`${name}=${value}\n`);
  }
  return lines.join('');
}

export function consumerEnvironment(config, injected, parentEnv = process.env) {
  const childEnv = {...parentEnv};
  // A Hermes backend can already hold its model-provider credentials in its
  // environment. Do not forward another configured consumer's variables to
  // the selected command merely because the parent process has them.
  for (const declaration of Object.values(config.command_injection)) {
    for (const name of Object.keys(declaration.environment)) delete childEnv[name];
  }
  for (const name of ['INFISICAL_CLIENT_ID','INFISICAL_CLIENT_SECRET','CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET']) {
    delete childEnv[name];
  }
  return {...childEnv, ...injected};
}

function authorizedConsumer(profileFile, workflow, consumer) {
  const profile = parseYaml(fs.readFileSync(profileFile, 'utf8'));
  if (!Array.isArray(profile?.commands) || !profile.commands.some(item => item.id === consumer && item.config)) {
    blocked('CONSUMER_NOT_BOUND');
  }
  const selected = profile.workflows?.find(item => item.path === workflow);
  if (!selected?.commands?.includes(consumer)) blocked('CONSUMER_NOT_AUTHORIZED');
  const ref = profile.commands.find(item => item.id === consumer).config;
  if (typeof ref !== 'string' || ref.startsWith('/') || ref.split('/').includes('..')) blocked('INVALID_CONSUMER_CONFIG');
  const profileDir = fs.realpathSync(path.dirname(profileFile));
  const resolved = fs.realpathSync(path.resolve(profileDir, ref));
  if (!resolved.startsWith(profileDir + path.sep) || !fs.statSync(resolved).isFile()) {
    blocked('INVALID_CONSUMER_CONFIG');
  }
  return resolved;
}

async function main(argv) {
  const [operation, consumer, separator, ...args] = argv;
  if (!['validate', 'inspect', 'status', 'run', 'hermes-env'].includes(operation)) blocked('USAGE');
  const configPath = process.env.AI_COMMAND_CONFIG_PATH;
  if (!configPath || !process.env.AI_PROFILE_FILE || !process.env.AI_FLOW_WORKFLOW ||
      !process.env.AI_COMMANDS_ROOT) blocked('PROFILE_REQUIRED');
  const config = validateConfig(fs.readFileSync(configPath, 'utf8'));
  if (operation === 'validate') {
    if (argv.length !== 1) blocked('USAGE');
    process.stdout.write('secrets configuration valid\n');
    return;
  }
  if (operation === 'inspect') {
    if (argv.length !== 1) blocked('USAGE');
    process.stdout.write(JSON.stringify(inspectConfig(config), null, 2) + '\n');
    return;
  }
  if (config.provider === 'none') blocked('PROVIDER_DISABLED');
  if (operation === 'status') {
    if (argv.length !== 1) blocked('USAGE');
    await verifyConnection(config);
    process.stdout.write('secrets provider authenticated\n');
    return;
  }
  if (operation === 'hermes-env') {
    // Hermes reads this process's stdout through its private command-source
    // pipe at profile startup. Never use this operation in an interactive shell.
    if (consumer !== 'hermes-agents' || argv.length !== 3 ||
        !/^[a-z0-9][a-z0-9_-]*$/.test(separator) || process.env.HERMES_SECRET_KEY ||
        path.basename(process.env.HERMES_HOME || '') !== separator) blocked('HERMES_RUNTIME_SCOPE_INVALID');
    authorizedConsumer(process.env.AI_PROFILE_FILE, process.env.AI_FLOW_WORKFLOW, consumer);
    const values = await resolveForConsumer(config, consumer);
    process.stdout.write(formatHermesEnv(values));
    return;
  }
  if (!consumer || separator !== '--') blocked('USAGE');
  const targetConfig = authorizedConsumer(process.env.AI_PROFILE_FILE, process.env.AI_FLOW_WORKFLOW, consumer);
  const commandsRoot = fs.realpathSync(process.env.AI_COMMANDS_ROOT);
  const executable = fs.realpathSync(path.resolve(commandsRoot, config.command_injection[consumer]?.executable || ''));
  if (!executable.startsWith(commandsRoot + path.sep) ||
      !fs.statSync(executable).isFile()) blocked('INVALID_EXECUTABLE');
  const injected = await resolveForConsumer(config, consumer);
  const childEnv = {...consumerEnvironment(config, injected), AI_COMMAND_CONFIG_PATH: targetConfig,
    AI_SECRETS_CONFIG_PATH: fs.realpathSync(configPath)};
  const child = spawn(executable, args, {env: childEnv, stdio: 'inherit', shell: false});
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject); child.on('exit', (exitCode, signal) => resolve(signal ? 128 : exitCode ?? 1));
  });
  process.exitCode = code;
}

if (process.argv[1]?.endsWith('/secrets.command.mjs')) {
  main(process.argv.slice(2)).catch(error => {
    const code = error instanceof SecretsBlocked ? error.message : 'INTERNAL_ERROR';
    process.stderr.write('BLOCKED_SECRETS: ' + code + '\n');
    process.exitCode = 2;
  });
}
