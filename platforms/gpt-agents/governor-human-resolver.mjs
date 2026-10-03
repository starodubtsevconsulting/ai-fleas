/** Purpose: choose the exact human profile for GPT Governor bootstrap.
 * Caller: launcher launch and prepare-human-profile CLI after exact ID selection.
 * Inputs: host plugin registry and exact human ID. Output: resolved human directory.
 * Effects: may create only a missing profile in the GPT-owned local store or an
 * explicit override. It does not create or initialize a Governor task.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveGovernorHumanDir } from './governor-launch.mjs';
import { assertHumanProfileId, HumanProfileBootstrap } from './human-profile-bootstrap.mjs';
import { HumanProfileStore } from './human-profile-store.mjs';

export class GovernorHumanResolver {
  constructor({ io = fs, store = new HumanProfileStore(),
    bootstrap = new HumanProfileBootstrap(io), resolveReceipt = resolveGovernorHumanDir } = {}) {
    this.io = io;
    this.store = store;
    this.bootstrap = bootstrap;
    this.resolveReceipt = resolveReceipt;
  }

  resolve(registry, humanId) {
    assertHumanProfileId(humanId);
    const explicit = this.store.explicitLocation();
    const receipts = Object.values(registry?.instances ?? {}).filter(binding =>
      binding?.agentId === 'personal-governor' &&
      binding.scope?.humanProfileId === humanId);
    if (receipts.length) {
      const humanDir = this.resolveReceipt(registry, humanId, { io: this.io });
      if (explicit && path.dirname(humanDir) !== this.io.realpathSync(explicit))
        throw new Error('GOVERNOR_HUMAN_LOCATION_CONFLICT');
      return { humanDir, created: false, source: 'verified-receipt' };
    }
    const root = this.store.resolve({ createDefault: true });
    return { ...this.bootstrap.prepare(root, humanId), source: explicit ? 'configured' : 'local-store' };
  }
}
