import {provisionShare} from '../application/share-provisioner.mjs';

export function plan(config, id, share) {
  return {
    status: 'planned', share: id, workflow: share.workflow, usage: share.usage, mutation: share.mutation,
    repository: share.repository ?? null,
    target: {nas: config.nas.host, name: share.name, account: share.account, access: share.access,
      projection: share.projection},
    source: {path: share.source, migration_required: true},
    prerequisites: share.bootstrap ? ['configured DSM volume exists'] :
      ['top-level shared folder exists', 'Synology Drive Team Folder is enabled'],
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

export async function apply(config, id, share) {
  return provisionShare(config, id, share);
}
