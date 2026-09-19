#!/usr/bin/env node
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {blocked} from './application/errors.mjs';
import {mappingRows, profileConfigForShare, readConfig, selectShare, validateConfig}
  from './application/config.mjs';
import * as api from './subcommands/api.command.mjs';
import * as mapping from './subcommands/mapping.command.mjs';
import * as memory from './subcommands/memory.command.mjs';
import * as share from './subcommands/share.command.mjs';

export {validateConfig};

const commandDirectory = path.dirname(new URL(import.meta.url).pathname);

function output(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function runHelper(script, args, options = {}) {
  const result = spawnSync(path.join(commandDirectory, script), args, options);
  if (result.status) blocked(options.errorCode);
  return result;
}

async function main(argv) {
  const configPath = process.env.AI_COMMAND_CONFIG_PATH;
  if (!configPath) blocked('PROFILE_REQUIRED');
  const config = readConfig(configPath);
  const [operation, noun, id, flag] = argv;

  if (operation === 'validate' && argv.length === 1) {
    return output({status: 'valid', shares: Object.keys(config.shares).sort()});
  }
  if (operation === 'inspect' && argv.length === 1) {
    return output({status: 'configured', shares: mappingRows(config)});
  }
  if (operation === 'api' && noun === 'catalog' && argv.length === 2) {
    return output(await api.catalog(config));
  }
  if (operation === 'api' && noun === 'status' && id && !flag) {
    return output(await api.status(config, id, selectShare(config, id)));
  }
  if (operation === 'mapping' && noun === 'list' && argv.length === 2) {
    return output(mapping.list(config));
  }
  if (operation === 'mapping' && noun === 'list' && id === '--all' && argv.length === 3) {
    return output(mapping.listAll(process.env.AI_PROFILE_FILE));
  }
  if (operation === 'mapping' && noun === 'status' && id && !flag) {
    return output(mapping.status(id, selectShare(config, id)));
  }
  if (operation === 'memory' && noun === 'plan' && id && !flag) {
    return output(memory.plan(id, selectShare(config, id)));
  }
  if (operation === 'memory' && noun === 'init' && id && flag === '--apply') {
    return output(memory.init(id, selectShare(config, id)));
  }
  if (operation === 'discover' && argv.length === 1) {
    const result = runHelper('find-synology-ip.sh', [], {encoding: 'utf8', errorCode: 'DISCOVERY_FAILED'});
    return output({status: 'discovered', address: result.stdout.trim()});
  }
  if (operation === 'open' && argv.length === 1) {
    runHelper('open-synology.sh', [config.nas.host], {stdio: 'inherit', errorCode: 'OPEN_FAILED'});
    return;
  }
  if ((operation === 'share' || operation === 'mapping') && noun === 'plan' && id && !flag) {
    return output(share.plan(config, id, selectShare(config, id)));
  }
  if (operation === 'share' && noun === 'apply' && id && flag === '--apply') {
    const selectedConfig = profileConfigForShare(process.env.AI_PROFILE_FILE, id, config);
    return output(await share.apply(selectedConfig, id, selectShare(selectedConfig, id)));
  }
  if (operation === 'mapping' && noun === 'apply' && id && flag === '--apply') {
    return mapping.apply(selectShare(config, id));
  }
  blocked('USAGE');
}

if (process.argv[1]?.endsWith('/synology.command.mjs')) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('BLOCKED_SYNOLOGY: ' + error.message + '\n');
    process.exitCode = 2;
  }
}
