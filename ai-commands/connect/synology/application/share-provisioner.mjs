import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {resolveLogicalSecrets, upsertLogicalSecrets, validateConfig as validateSecretsConfig}
  from '../../../connect/secrets/secrets.command.mjs';
import {blocked} from './errors.mjs';
import {call, containsName, discoverCatalog, rows, withSession} from './dsm-client.mjs';

function generatedPassword() {
  return `Aa1!${crypto.randomBytes(32).toString('base64url')}`;
}

function loadSecretsConfig() {
  const filename = process.env.AI_SECRETS_CONFIG_PATH;
  if (!filename || !path.isAbsolute(filename)) blocked('SECRETS_WRITER_REQUIRED');
  return validateSecretsConfig(fs.readFileSync(filename, 'utf8'));
}

export function createShareParameters(share) {
  const shareinfo = {
    name: share.name, vol_path: share.bootstrap.volume,
    desc: `AI Fleas ${share.workflow} permanent memory`,
    enable_recycle_bin: true, recycle_bin_admin_only: true,
    enable_share_cow: true, enable_share_compress: false, name_org: '',
  };
  return {name: share.name, shareinfo};
}

async function ensureAccount(config, session, catalog, id, share, users, secretsConfig) {
  if (!containsName(users, share.account)) {
    const password = generatedPassword();
    await call(config, session, catalog, 'SYNO.Core.User', 'create', {
      name: share.account, password, description: `AI Fleas ${id} share account`, email: '', expired: 'never',
      cannot_chg_passwd: true, passwd_never_expire: true, notify_by_email: false, send_password: false,
    });
    return {password, created: true, rotated: false};
  }
  try {
    const stored = await resolveLogicalSecrets(secretsConfig,
      [share.credential.username_secret, share.credential.password_secret]);
    if (stored[share.credential.username_secret] !== share.account) blocked('SECRET_ACCOUNT_MISMATCH');
    return {password: stored[share.credential.password_secret], created: false, rotated: false};
  } catch (error) {
    if (error?.message !== 'SECRET_NOT_FOUND') throw error;
    const password = generatedPassword();
    await call(config, session, catalog, 'SYNO.Core.User', 'set', {
      type: 'local', name: share.account, new_name: share.account, password,
      description: `AI Fleas ${id} share account`, email: '', expired: 'never', cannot_chg_passwd: true,
      passwd_never_expire: true, notify_by_email: false, send_password: false,
    });
    return {password, created: false, rotated: true};
  }
}

async function setPermission(config, session, catalog, share) {
  return call(config, session, catalog, 'SYNO.Core.Share.Permission', 'set', {
    name: share.name, user_group_type: 'local_user', permissions: [{
      name: share.account, is_deny: false, is_readonly: share.access === 'read-only',
      is_writable: share.access === 'read-write',
    }],
  });
}

async function verifyPermission(config, session, catalog, share) {
  const response = await call(config, session, catalog, 'SYNO.Core.Share.Permission', 'list', {
    name: share.name, offset: 0, limit: 100, action: 'enum', is_unite_permission: false,
    with_inherit: false, user_group_type: 'local_user',
  });
  const permission = rows(response, 'items', 'permissions').find(item => item.name === share.account);
  if (!permission || (share.access === 'read-only' && permission.is_readonly !== true) ||
      (share.access === 'read-write' && permission.is_writable !== true)) blocked('PERMISSION_VERIFICATION_FAILED');
}

async function ensureStorage(config, session, catalog, share, shares, teamFolders) {
  let shareCreated = false;
  let teamFolderEnabled = false;
  if (!containsName(shares, share.name)) {
    if (!share.bootstrap?.create_share) blocked('SHARE_MIGRATION_REQUIRED');
    // DSM 7.3.2 requires the create payload inside a JSON-encoded shareinfo
    // envelope while retaining the JSON-encoded name at the top level.
    await call(config, session, catalog, 'SYNO.Core.Share', 'create', createShareParameters(share));
    shareCreated = true;
  }
  if (!containsName(teamFolders, share.projection.team_folder)) {
    if (!share.bootstrap?.enable_team_folder) blocked('TEAM_FOLDER_ENABLEMENT_REQUIRED');
    await call(config, session, catalog, 'SYNO.SynologyDrive.Share', 'set', {
      share: [{share_name: share.name, share_enable: true, enable_versioning: true, rotate_cnt: 8}],
    });
    teamFolderEnabled = true;
  }
  const [verifiedShares, verifiedTeamFolders] = await Promise.all([
    call(config, session, catalog, 'SYNO.Core.Share', 'list'),
    call(config, session, catalog, 'SYNO.SynologyDrive.TeamFolders', 'list'),
  ]);
  if (!containsName(rows(verifiedShares, 'shares', 'items'), share.name)) blocked('SHARE_CREATION_VERIFICATION_FAILED');
  if (!containsName(rows(verifiedTeamFolders, 'items', 'shares', 'team_folders'), share.projection.team_folder)) {
    blocked('TEAM_FOLDER_ENABLEMENT_VERIFICATION_FAILED');
  }
  return {shareCreated, teamFolderEnabled};
}

export async function provisionShare(config, id, share) {
  const secretsConfig = loadSecretsConfig();
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
    const storage = await ensureStorage(config, session, catalog, share, shares, teamFolders);

    const account = await ensureAccount(config, session, catalog, id, share, users, secretsConfig);
    try {
      await setPermission(config, session, catalog, share);
      await upsertLogicalSecrets(secretsConfig, {
        [share.credential.username_secret]: share.account,
        [share.credential.password_secret]: account.password,
      });
      await verifyPermission(config, session, catalog, share);
    } catch (error) {
      if (account.created) {
        try {
          await call(config, session, catalog, 'SYNO.Core.User', 'delete', {name: share.account});
        } catch {
          blocked('ROLLBACK_FAILED');
        }
      }
      throw error;
    }
    return {
      status: 'applied', share: id, account: share.account, access: share.access,
      account_created: account.created, credential_rotated: account.rotated, secret_store_updated: true,
      share_present: true, share_created: storage.shareCreated, team_folder_present: true,
      team_folder_enabled: storage.teamFolderEnabled, credential_values_exposed: false,
    };
  });
}
