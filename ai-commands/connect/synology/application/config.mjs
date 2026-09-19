import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {blocked} from './errors.mjs';

const token = /^[a-z][a-z0-9-]{0,62}$/;
const logicalSecret = /^[a-z0-9-]+(?:\.[a-z0-9-]+){3,}$/;
const pendingPath = /^TODO_[A-Z0-9_]+$/;
const commandIds = new Set(['synology', 'synology-memory']);

export function validateConfig(source) {
  const doc = YAML.parseDocument(source, {uniqueKeys: true, strict: true});
  if (doc.errors.length) blocked('INVALID_CONFIG');
  const config = doc.toJS();
  if (!config || Object.keys(config).some(key => !['nas', 'shares'].includes(key))) blocked('INVALID_CONFIG');
  validateNas(config.nas);
  if (!config.shares || typeof config.shares !== 'object' || Array.isArray(config.shares)) blocked('INVALID_SHARES');
  for (const [id, share] of Object.entries(config.shares)) validateShare(id, share);
  return config;
}

function validateNas(nas) {
  if (!nas || Object.keys(nas).some(key => !['host', 'https_port', 'certificate_sha256', 'remote_access'].includes(key))) {
    blocked('INVALID_NAS');
  }
  if (typeof nas.host !== 'string' || !nas.host || !Number.isInteger(nas.https_port)) blocked('INVALID_NAS');
  const remote = nas.remote_access;
  if (!remote || Object.keys(remote).some(key => !['mode', 'host', 'quickconnect', 'command', 'client', 'status'].includes(key)) ||
      !['none', 'private-tunnel', 'cloudflare-private-network'].includes(remote.mode) || remote.quickconnect !== false) {
    blocked('INVALID_NAS');
  }
  if (remote.mode !== 'none' && !(typeof remote.host === 'string' &&
      (pendingPath.test(remote.host) || remote.host.includes('.')))) blocked('INVALID_NAS');
  if (remote.mode === 'none' && Object.keys(remote).some(key => !['mode', 'quickconnect'].includes(key))) blocked('INVALID_NAS');
  if (remote.mode === 'cloudflare-private-network' &&
      (remote.command !== 'cloudflare' || remote.client !== 'warp' || !pendingPath.test(remote.status || ''))) {
    blocked('INVALID_NAS');
  }
}

function validateShare(id, share) {
  const allowed = ['name', 'account', 'access', 'source', 'projection', 'workflow', 'usage', 'mutation',
    'repository', 'credential'];
  if (!token.test(id) || !share || Object.keys(share).some(key => !allowed.includes(key))) blocked('INVALID_SHARE');
  if (!token.test(share.name) || !token.test(share.account) || !['read-only', 'read-write'].includes(share.access)) {
    blocked('INVALID_SHARE');
  }
  if (typeof share.source !== 'string' || !path.isAbsolute(share.source) || !token.test(share.workflow)) {
    blocked('INVALID_SHARE');
  }
  if (!share.credential || Object.keys(share.credential).some(key => !['username_secret', 'password_secret'].includes(key)) ||
      !logicalSecret.test(share.credential.username_secret || '') ||
      !logicalSecret.test(share.credential.password_secret || '')) blocked('INVALID_SHARE');
  const projection = share.projection;
  if (!projection || Object.keys(projection).some(key => !['type', 'team_folder', 'local_path', 'sync_mode'].includes(key)) ||
      projection.type !== 'synology-drive' || projection.team_folder !== share.name ||
      !['download-only', 'bidirectional'].includes(projection.sync_mode) ||
      (share.access === 'read-only' && projection.sync_mode !== 'download-only') ||
      (share.access === 'read-write' && projection.sync_mode !== 'bidirectional') ||
      typeof projection.local_path !== 'string' ||
      !(path.isAbsolute(projection.local_path) || pendingPath.test(projection.local_path))) blocked('INVALID_SHARE');
  if (!['memory', 'workspace', 'inbox'].includes(share.usage) ||
      !['source-control', 'direct'].includes(share.mutation)) blocked('INVALID_SHARE');
  validateRepository(share);
}

function validateRepository(share) {
  if (share.mutation !== 'source-control') {
    if (share.repository != null) blocked('INVALID_SHARE');
    return;
  }
  const repository = share.repository;
  if (share.access !== 'read-only' || !repository ||
      Object.keys(repository).some(key => !['id', 'branch', 'subpath', 'delivery', 'publisher_checkout'].includes(key)) ||
      !token.test(repository.id) || !token.test(repository.branch) || repository.delivery !== 'on-merge' ||
      typeof repository.subpath !== 'string' || path.isAbsolute(repository.subpath) ||
      repository.subpath.split('/').includes('..') || typeof repository.publisher_checkout !== 'string' ||
      !(path.isAbsolute(repository.publisher_checkout) || pendingPath.test(repository.publisher_checkout))) {
    blocked('INVALID_SHARE');
  }
}

export function readConfig(filename) {
  return validateConfig(fs.readFileSync(filename, 'utf8'));
}

export function selectShare(config, id) {
  if (!token.test(id) || !config.shares[id]) blocked('UNKNOWN_SHARE');
  return config.shares[id];
}

export function mappingRows(config) {
  return Object.entries(config.shares).sort(([left], [right]) => left.localeCompare(right)).map(([id, share]) => ({
    id, workflow: share.workflow, access: share.access, team_folder: share.projection.team_folder,
    local_projection: share.projection.local_path, sync_mode: share.projection.sync_mode,
    repository: share.repository ?? null,
  }));
}

function profileCommandConfigs(profileFile) {
  if (!profileFile || !path.isAbsolute(profileFile)) blocked('PROFILE_REQUIRED');
  const profileDir = fs.realpathSync(path.dirname(profileFile));
  const profile = YAML.parse(fs.readFileSync(profileFile, 'utf8'));
  return (profile.commands || []).filter(binding => commandIds.has(binding.id) && typeof binding.config === 'string')
    .map(binding => {
      const configPath = fs.realpathSync(path.resolve(profileDir, binding.config));
      if (!configPath.startsWith(profileDir + path.sep)) blocked('INVALID_PROFILE_CONFIG');
      return {command: binding.id, config: readConfig(configPath)};
    });
}

export function allProfileMappings(profileFile) {
  return profileCommandConfigs(profileFile)
    .flatMap(({command, config}) => mappingRows(config).map(row => ({...row, command})))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function profileConfigForShare(profileFile, id, fallback) {
  if (fallback.shares[id]) return fallback;
  if (!profileFile || !path.isAbsolute(profileFile)) blocked('UNKNOWN_SHARE');
  for (const {config} of profileCommandConfigs(profileFile)) if (config.shares[id]) return config;
  blocked('UNKNOWN_SHARE');
}
