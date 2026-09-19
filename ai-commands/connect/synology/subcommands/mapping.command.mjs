import fs from 'node:fs';
import {blocked} from '../application/errors.mjs';
import {allProfileMappings, mappingRows} from '../application/config.mjs';

export function list(config) {
  return {status: 'configured', mappings: mappingRows(config)};
}

export function listAll(profileFile) {
  return {status: 'configured', mappings: allProfileMappings(profileFile)};
}

export function status(id, share) {
  const sourcePresent = fs.existsSync(share.source);
  const projectionPending = share.projection.local_path.startsWith('TODO_');
  const publisherPending = share.repository?.publisher_checkout?.startsWith('TODO_') ?? false;
  return {
    status: projectionPending || publisherPending ? 'pending' : 'configured', mapping: id,
    workflow: share.workflow, source_present: sourcePresent, team_folder: share.projection.team_folder,
    local_projection: projectionPending ? 'pending' : share.projection.local_path,
    publisher_checkout: share.repository ? (publisherPending ? 'pending' : share.repository.publisher_checkout) : null,
    blockers: [...(!sourcePresent ? ['SOURCE_NOT_FOUND'] : []),
      ...(projectionPending ? ['LOCAL_PROJECTION_NOT_CONFIGURED'] : []),
      ...(publisherPending ? ['PUBLISHER_CHECKOUT_NOT_CONFIGURED'] : [])],
  };
}

export function apply(share) {
  if (share.projection.local_path.startsWith('TODO_')) blocked('LOCAL_PROJECTION_PATH_REQUIRED');
  if (share.repository.publisher_checkout.startsWith('TODO_')) blocked('PUBLISHER_CHECKOUT_REQUIRED');
  blocked('DSM_MUTATION_DRIVER_NOT_VERIFIED');
}
