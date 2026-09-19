import fs from 'node:fs';
import path from 'node:path';
import {blocked} from '../application/errors.mjs';

export const areas = ['memory', 'strategy', 'daily', 'decisions', 'references'];

function requireGovernorMemory(share) {
  if (share.usage !== 'memory' || share.access !== 'read-write' || share.mutation !== 'direct' ||
      share.source !== share.projection.local_path) blocked('INVALID_MEMORY_MAPPING');
}

export function plan(id, share) {
  requireGovernorMemory(share);
  return {
    status: 'planned', mapping: id, root: share.projection.local_path, areas,
    effects: ['create missing semantic directories', 'preserve every existing file and directory'], applied: false,
  };
}

export function init(id, share) {
  requireGovernorMemory(share);
  const root = share.projection.local_path;
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) blocked('MEMORY_PROJECTION_NOT_AVAILABLE');
  const rootReal = fs.realpathSync(root);
  const created = [];
  for (const area of areas) {
    const target = path.join(rootReal, area);
    if (fs.existsSync(target)) {
      if (!fs.statSync(target).isDirectory()) blocked('MEMORY_AREA_CONFLICT');
      continue;
    }
    fs.mkdirSync(target);
    created.push(area);
  }
  return {status: 'initialized', mapping: id, root: rootReal, areas, created, preserved_existing: true};
}
