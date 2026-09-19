#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';

const blocked = code => { throw new Error(code); };
const token = /^[a-z][a-z0-9-]{0,62}$/;

export function validateConfig(source) {
  const doc = YAML.parseDocument(source, {uniqueKeys: true, strict: true});
  if (doc.errors.length) blocked('INVALID_CONFIG');
  const config = doc.toJS();
  if (!config || Object.keys(config).some(k => !['nas','shares'].includes(k))) blocked('INVALID_CONFIG');
  if (!config.nas || Object.keys(config.nas).some(k => !['host','https_port','certificate_sha256','remote_access'].includes(k))) blocked('INVALID_NAS');
  if (typeof config.nas.host !== 'string' || !config.nas.host || !Number.isInteger(config.nas.https_port)) blocked('INVALID_NAS');
  if (!config.nas.remote_access || Object.keys(config.nas.remote_access).some(k => !['mode','host','quickconnect','command','client','status'].includes(k)) ||
      !['none','private-tunnel','cloudflare-private-network'].includes(config.nas.remote_access.mode) || config.nas.remote_access.quickconnect !== false) blocked('INVALID_NAS');
  if (config.nas.remote_access.mode !== 'none' && !(typeof config.nas.remote_access.host === 'string' &&
      (/^TODO_[A-Z0-9_]+$/.test(config.nas.remote_access.host) || config.nas.remote_access.host.includes('.')))) blocked('INVALID_NAS');
  if (config.nas.remote_access.mode === 'none' && Object.keys(config.nas.remote_access).some(k => !['mode','quickconnect'].includes(k))) blocked('INVALID_NAS');
  if (config.nas.remote_access.mode === 'cloudflare-private-network' &&
      (config.nas.remote_access.command !== 'cloudflare' || config.nas.remote_access.client !== 'warp' ||
       !/^TODO_[A-Z0-9_]+$/.test(config.nas.remote_access.status || ''))) blocked('INVALID_NAS');
  if (!config.shares || typeof config.shares !== 'object' || Array.isArray(config.shares)) blocked('INVALID_SHARES');
  for (const [id, share] of Object.entries(config.shares)) {
    if (!token.test(id) || !share || Object.keys(share).some(k => !['name','account','access','source','projection','workflow','usage','mutation','repository'].includes(k))) blocked('INVALID_SHARE');
    if (!token.test(share.name) || !token.test(share.account) || !['read-only','read-write'].includes(share.access)) blocked('INVALID_SHARE');
    if (typeof share.source !== 'string' || !path.isAbsolute(share.source) || !token.test(share.workflow)) blocked('INVALID_SHARE');
    if (!share.projection || Object.keys(share.projection).some(k => !['type','team_folder','local_path','sync_mode'].includes(k)) ||
        share.projection.type !== 'synology-drive' || share.projection.team_folder !== share.name ||
        share.projection.sync_mode !== 'download-only' || typeof share.projection.local_path !== 'string' ||
        !(path.isAbsolute(share.projection.local_path) || /^TODO_[A-Z0-9_]+$/.test(share.projection.local_path))) blocked('INVALID_SHARE');
    if (!['memory','workspace','inbox'].includes(share.usage) || !['source-control','direct'].includes(share.mutation)) blocked('INVALID_SHARE');
    if (share.mutation === 'source-control') {
      if (share.access !== 'read-only' || !share.repository ||
          Object.keys(share.repository).some(k => !['id','branch','subpath','delivery','publisher_checkout'].includes(k)) ||
          !token.test(share.repository.id) || !token.test(share.repository.branch) ||
          share.repository.delivery !== 'on-merge' || typeof share.repository.subpath !== 'string' ||
          path.isAbsolute(share.repository.subpath) || share.repository.subpath.split('/').includes('..') ||
          !(typeof share.repository.publisher_checkout === 'string' &&
            (path.isAbsolute(share.repository.publisher_checkout) || /^TODO_[A-Z0-9_]+$/.test(share.repository.publisher_checkout)))) blocked('INVALID_SHARE');
    } else if (share.repository != null) blocked('INVALID_SHARE');
  }
  return config;
}

function safeShare(config, id) {
  if (!token.test(id) || !config.shares[id]) blocked('UNKNOWN_SHARE');
  return config.shares[id];
}

function output(value) { process.stdout.write(JSON.stringify(value, null, 2) + '\n'); }

const relevantApis = [
  'SYNO.API.Auth',
  'SYNO.Core.Share',
  'SYNO.Core.Share.Permission',
  'SYNO.Core.User',
  'SYNO.SynologyDrive.TeamFolders'
];

function normalizedFingerprint(value) { return String(value || '').replaceAll(':', '').toUpperCase(); }

function dsmRequest(config, parameters) {
  const expectedFingerprint = normalizedFingerprint(config.nas.certificate_sha256);
  const body = new URLSearchParams(parameters).toString();
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: config.nas.host,
      port: config.nas.https_port,
      path: '/webapi/entry.cgi',
      method: 'POST',
      rejectUnauthorized: false,
      headers: {'content-type':'application/x-www-form-urlencoded', 'content-length':Buffer.byteLength(body)}
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.success) return reject(new Error(`DSM_API_ERROR_${parsed.error?.code ?? 'UNKNOWN'}`));
          resolve(parsed.data ?? {});
        } catch (error) { reject(error); }
      });
    });
    request.on('socket', socket => socket.once('secureConnect', () => {
      const actual = normalizedFingerprint(socket.getPeerCertificate()?.fingerprint256);
      if (!expectedFingerprint || actual !== expectedFingerprint) request.destroy(new Error('DSM_CERTIFICATE_MISMATCH'));
    }));
    request.setTimeout(15000, () => request.destroy(new Error('DSM_API_TIMEOUT')));
    request.on('error', reject);
    request.end(body);
  });
}

async function dsmCatalog(config) {
  const data = await dsmRequest(config, {api:'SYNO.API.Info', version:'1', method:'query', query:relevantApis.join(',')});
  return Object.fromEntries(relevantApis.filter(name => data[name]).map(name => [name, data[name]]));
}

async function withDsmSession(config, operation) {
  const account = process.env.SYNOLOGY_ADMIN_USERNAME;
  const passwd = process.env.SYNOLOGY_ADMIN_PASSWORD;
  if (!account || !passwd) blocked('DSM_ADMIN_CREDENTIALS_REQUIRED');
  const login = await dsmRequest(config, {api:'SYNO.API.Auth', version:'7', method:'login', account, passwd,
    session:'AI-Fleas-Synology', format:'sid', enable_syno_token:'yes'});
  if (!login.sid) blocked('DSM_LOGIN_FAILED');
  const session = {sid:login.sid, synotoken:login.synotoken};
  try { return await operation(session); }
  finally {
    try { await dsmRequest(config, {api:'SYNO.API.Auth', version:'7', method:'logout', session:'AI-Fleas-Synology', _sid:session.sid,
      ...(session.synotoken ? {SynoToken:session.synotoken} : {})}); } catch {}
  }
}

async function dsmCall(config, session, api, method, parameters={}) {
  const catalog = await dsmCatalog(config);
  const descriptor = catalog[api];
  if (!descriptor) blocked(`DSM_API_UNAVAILABLE_${api}`);
  return dsmRequest(config, {api, version:String(descriptor.maxVersion), method, ...parameters, _sid:session.sid,
    ...(session.synotoken ? {SynoToken:session.synotoken} : {})});
}

function mappingRows(config) {
  return Object.entries(config.shares).sort(([a],[b]) => a.localeCompare(b)).map(([id, share]) => ({id,
    workflow:share.workflow, access:share.access, team_folder:share.projection.team_folder,
    local_projection:share.projection.local_path, sync_mode:share.projection.sync_mode,
    repository:share.repository ?? null}));
}

function allProfileMappings(profileFile) {
  if (!profileFile || !path.isAbsolute(profileFile)) blocked('PROFILE_REQUIRED');
  const profileDir = fs.realpathSync(path.dirname(profileFile));
  const profile = YAML.parse(fs.readFileSync(profileFile, 'utf8'));
  const rows = [];
  for (const binding of profile.commands || []) {
    if (!['synology','synology-memory'].includes(binding.id) || typeof binding.config !== 'string') continue;
    const configPath = fs.realpathSync(path.resolve(profileDir, binding.config));
    if (!configPath.startsWith(profileDir + path.sep)) blocked('INVALID_PROFILE_CONFIG');
    for (const row of mappingRows(validateConfig(fs.readFileSync(configPath, 'utf8')))) rows.push({...row, command:binding.id});
  }
  return rows.sort((a,b) => a.id.localeCompare(b.id));
}

async function main(argv) {
  const configPath = process.env.AI_COMMAND_CONFIG_PATH;
  if (!configPath) blocked('PROFILE_REQUIRED');
  const config = validateConfig(fs.readFileSync(configPath, 'utf8'));
  const [op, noun, id, flag] = argv;
  if (op === 'validate' && argv.length === 1) return output({status:'valid', shares:Object.keys(config.shares).sort()});
  if (op === 'inspect' && argv.length === 1) return output({status:'configured', shares:mappingRows(config)});
  if (op === 'api' && noun === 'catalog' && argv.length === 2) {
    const catalog = await dsmCatalog(config);
    return output({status:'available', apis:Object.fromEntries(Object.entries(catalog).map(([name, value]) =>
      [name, {path:value.path, min_version:value.minVersion, max_version:value.maxVersion, request_format:value.requestFormat ?? null}]))});
  }
  if (op === 'api' && noun === 'status' && id && !flag) {
    const share = safeShare(config, id);
    return withDsmSession(config, async session => {
      const [shares, users, teamFolders] = await Promise.all([
        dsmCall(config, session, 'SYNO.Core.Share', 'list'),
        dsmCall(config, session, 'SYNO.Core.User', 'list'),
        dsmCall(config, session, 'SYNO.SynologyDrive.TeamFolders', 'list')
      ]);
      const shareRows = shares.shares ?? shares.items ?? [];
      const userRows = users.users ?? users.items ?? [];
      const teamRows = teamFolders.items ?? teamFolders.shares ?? teamFolders.team_folders ?? [];
      const hasName = (rows, name) => rows.some(row => [row.name,row.share_name,row.username,row.account].includes(name));
      return output({status:'observed', mapping:id, share_present:hasName(shareRows, share.name),
        account_present:hasName(userRows, share.account), team_folder_present:hasName(teamRows, share.projection.team_folder),
        evidence:{shares_returned:shareRows.length, users_returned:userRows.length, team_folders_returned:teamRows.length}});
    });
  }
  if (op === 'mapping' && noun === 'list' && argv.length === 2) return output({status:'configured', mappings:mappingRows(config)});
  if (op === 'mapping' && noun === 'list' && id === '--all' && argv.length === 3) return output({status:'configured', mappings:allProfileMappings(process.env.AI_PROFILE_FILE)});
  if (op === 'mapping' && noun === 'status' && id && !flag) {
    const share = safeShare(config, id);
    const sourcePresent = fs.existsSync(share.source);
    const projectionPending = share.projection.local_path.startsWith('TODO_');
    const publisherPending = share.repository?.publisher_checkout?.startsWith('TODO_') ?? false;
    return output({status: projectionPending || publisherPending ? 'pending' : 'configured', mapping:id, workflow:share.workflow, source_present:sourcePresent, team_folder:share.projection.team_folder, local_projection:projectionPending ? 'pending' : share.projection.local_path, publisher_checkout:publisherPending ? 'pending' : share.repository.publisher_checkout, blockers:[...(!sourcePresent ? ['SOURCE_NOT_FOUND'] : []), ...(projectionPending ? ['LOCAL_PROJECTION_NOT_CONFIGURED'] : []), ...(publisherPending ? ['PUBLISHER_CHECKOUT_NOT_CONFIGURED'] : [])]});
  }
  if (op === 'discover' && argv.length === 1) {
    const result = spawnSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'find-synology-ip.sh'), [], {encoding:'utf8'});
    if (result.status) blocked('DISCOVERY_FAILED');
    return output({status:'discovered', address:result.stdout.trim()});
  }
  if (op === 'open' && argv.length === 1) {
    const result = spawnSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'open-synology.sh'), [config.nas.host], {stdio:'inherit'});
    if (result.status) blocked('OPEN_FAILED');
    return;
  }
  if ((op === 'share' || op === 'mapping') && noun === 'plan' && id && !flag) {
    const share = safeShare(config, id);
    return output({status:'planned', share:id, workflow:share.workflow, usage:share.usage, mutation:share.mutation, repository:share.repository ?? null, target:{nas:config.nas.host,name:share.name,account:share.account,access:share.access,projection:share.projection}, source:{path:share.source, migration_required:true}, secrets:{admin:['SYNOLOGY_ADMIN_USERNAME','SYNOLOGY_ADMIN_PASSWORD'], consumer:['SYNOLOGY_SHARE_USERNAME','SYNOLOGY_SHARE_PASSWORD'], generated_consumer_credential:{username:'profile-declared account',password:'cryptographically random; generated in memory',delivery:'DSM and approved secret-store writer only',printed:false,persisted_locally:false}}, effects:['authenticate with a dedicated DSM provisioning administrator','generate a unique share password in memory','create-or-reconcile dedicated non-admin account','create-or-reconcile top-level shared folder','enable Synology Drive Team Folder','deny unrelated shares to dedicated account','grant configured access only','store the consumer username and generated password through a separately authorized secret writer','create download-only local projection','verify account, secret resolution, and projection without exposing values'], applied:false});
  }
  if (op === 'share' && noun === 'apply' && id && flag === '--apply') {
    safeShare(config, id);
    blocked('DSM_MUTATION_DRIVER_NOT_VERIFIED');
  }
  if (op === 'mapping' && noun === 'apply' && id && flag === '--apply') {
    const share = safeShare(config, id);
    if (share.projection.local_path.startsWith('TODO_')) blocked('LOCAL_PROJECTION_PATH_REQUIRED');
    if (share.repository.publisher_checkout.startsWith('TODO_')) blocked('PUBLISHER_CHECKOUT_REQUIRED');
    blocked('DSM_MUTATION_DRIVER_NOT_VERIFIED');
  }
  blocked('USAGE');
}

if (process.argv[1]?.endsWith('/synology.command.mjs')) {
  try { await main(process.argv.slice(2)); } catch (error) {
    process.stderr.write('BLOCKED_SYNOLOGY: ' + error.message + '\n');
    process.exitCode = 2;
  }
}
