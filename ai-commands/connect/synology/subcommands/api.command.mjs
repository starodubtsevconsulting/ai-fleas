import {call, containsName, discoverCatalog, rows, withSession} from '../application/dsm-client.mjs';

export async function catalog(config) {
  const available = await discoverCatalog(config);
  return {status: 'available', apis: Object.fromEntries(Object.entries(available).map(([name, value]) =>
    [name, {path: value.path, min_version: value.minVersion, max_version: value.maxVersion,
      request_format: value.requestFormat ?? null}]))};
}

export async function status(config, id, share) {
  return withSession(config, async session => {
    const available = await discoverCatalog(config);
    const [shareResponse, userResponse, teamFolderResponse] = await Promise.all([
      call(config, session, available, 'SYNO.Core.Share', 'list'),
      call(config, session, available, 'SYNO.Core.User', 'list'),
      call(config, session, available, 'SYNO.SynologyDrive.TeamFolders', 'list'),
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
