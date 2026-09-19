#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {blocked} from './lib/errors.mjs';
import {allProfileMappings, mappingRows, profileConfigForShare, readConfig, selectShare,
  validateConfig} from './lib/config.mjs';
import {call, containsName, discoverCatalog, rows, withSession} from './lib/dsm-client.mjs';
import {provisionShare} from './lib/share-provisioner.mjs';

export {validateConfig};

const commandDirectory = path.dirname(new URL(import.meta.url).pathname);

function output(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function planReceipt(config, id, share) {
  return {
    status: 'planned', share: id, workflow: share.workflow, usage: share.usage, mutation: share.mutation,
    repository: share.repository ?? null,
    target: {nas: config.nas.host, name: share.name, account: share.account, access: share.access,
      projection: share.projection},
    source: {path: share.source, migration_required: true},
    prerequisites: ['top-level shared folder exists', 'Synology Drive Team Folder is enabled'],
    secrets: {
      admin: ['SYNOLOGY_ADMIN_USERNAME', 'SYNOLOGY_ADMIN_PASSWORD'],
      consumer: ['SYNOLOGY_SHARE_USERNAME', 'SYNOLOGY_SHARE_PASSWORD'],
      generated_consumer_credential: {
        username: 'profile-declared account', password: 'cryptographically random; generated in memory',
        delivery: 'DSM and approved secret-store writer only', printed: false, persisted_locally: false,
      },
    },
    effects: [
      'authenticate with a dedicated DSM provisioning administrator',
      'verify the shared folder and Team Folder exist',
      'generate a unique share password in memory when the account needs creation or recovery',
      'create-or-reconcile the dedicated non-admin account',
      'grant the configured access',
      'store the consumer username and generated password through the profile-declared secret writer',
      'verify permission without exposing values',
    ],
    applied: false,
  };
}

async function apiStatus(config, id, share) {
  return withSession(config, async session => {
    const catalog = await discoverCatalog(config);
    const [shareResponse, userResponse, teamFolderResponse] = await Promise.all([
      call(config, session, catalog, 'SYNO.Core.Share', 'list'),
      call(config, session, catalog, 'SYNO.Core.User', 'list'),
      call(config, session, catalog, 'SYNO.SynologyDrive.TeamFolders', 'list'),
    ]);
    const shares = rows(shareResponse, 'shares', 'items');
    const users = rows(userResponse, 'users', 'items');
    const teamFolders = rows(teamFolderResponse, 'items', 'shares', 'team_folders');
    return {
      status: 'observed', mapping: id,
      share_present: containsName(shares, share.name), account_present: containsName(users, share.account),
      team_folder_present: containsName(teamFolders, share.projection.team_folder),
      evidence: {shares_returned: shares.length, users_returned: users.length,
        team_folders_returned: teamFolders.length},
    };
  });
}

function mappingStatus(id, share) {
  const sourcePresent = fs.existsSync(share.source);
  const projectionPending = share.projection.local_path.startsWith('TODO_');
  const publisherPending = share.repository?.publisher_checkout?.startsWith('TODO_') ?? false;
  return {
    status: projectionPending || publisherPending ? 'pending' : 'configured', mapping: id,
    workflow: share.workflow, source_present: sourcePresent, team_folder: share.projection.team_folder,
    local_projection: projectionPending ? 'pending' : share.projection.local_path,
    publisher_checkout: publisherPending ? 'pending' : share.repository.publisher_checkout,
    blockers: [...(!sourcePresent ? ['SOURCE_NOT_FOUND'] : []),
      ...(projectionPending ? ['LOCAL_PROJECTION_NOT_CONFIGURED'] : []),
      ...(publisherPending ? ['PUBLISHER_CHECKOUT_NOT_CONFIGURED'] : [])],
  };
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
    const catalog = await discoverCatalog(config);
    return output({status: 'available', apis: Object.fromEntries(Object.entries(catalog).map(([name, value]) =>
      [name, {path: value.path, min_version: value.minVersion, max_version: value.maxVersion,
        request_format: value.requestFormat ?? null}]))});
  }
  if (operation === 'api' && noun === 'status' && id && !flag) {
    return output(await apiStatus(config, id, selectShare(config, id)));
  }
  if (operation === 'mapping' && noun === 'list' && argv.length === 2) {
    return output({status: 'configured', mappings: mappingRows(config)});
  }
  if (operation === 'mapping' && noun === 'list' && id === '--all' && argv.length === 3) {
    return output({status: 'configured', mappings: allProfileMappings(process.env.AI_PROFILE_FILE)});
  }
  if (operation === 'mapping' && noun === 'status' && id && !flag) {
    return output(mappingStatus(id, selectShare(config, id)));
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
    return output(planReceipt(config, id, selectShare(config, id)));
  }
  if (operation === 'share' && noun === 'apply' && id && flag === '--apply') {
    const selectedConfig = profileConfigForShare(process.env.AI_PROFILE_FILE, id, config);
    return output(await provisionShare(selectedConfig, id, selectShare(selectedConfig, id)));
  }
  if (operation === 'mapping' && noun === 'apply' && id && flag === '--apply') {
    const share = selectShare(config, id);
    if (share.projection.local_path.startsWith('TODO_')) blocked('LOCAL_PROJECTION_PATH_REQUIRED');
    if (share.repository.publisher_checkout.startsWith('TODO_')) blocked('PUBLISHER_CHECKOUT_REQUIRED');
    blocked('DSM_MUTATION_DRIVER_NOT_VERIFIED');
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
