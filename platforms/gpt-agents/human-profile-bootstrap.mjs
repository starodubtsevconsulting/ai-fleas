/** Purpose: scaffold a private, minimal human profile when an exact selected ID is new.
 * Caller: the GPT launcher or a plugin-directed Governor controller before task creation.
 * Inputs: configured human-catalog directory and exact human profile ID.
 * Output: the new or existing human directory; effects: creates only a missing profile
 * directory and its Governor config, local authoritative memory, and empty access lists.
 * This helper does not initialize an agent or grant workflow access.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const roleRef = 'ai-fleas://roles/personal-governor';
const humanIdPattern = /^[a-z][a-z0-9_-]*$/;

export function assertHumanProfileId(humanId) {
  if (!humanIdPattern.test(humanId)) throw new Error('GOVERNOR_HUMAN_ID_REQUIRED');
  return humanId;
}

export class HumanProfileBootstrap {
  constructor(io = fs) { this.io = io; }

  render(humanId) {
    assertHumanProfileId(humanId);
    const memoryPath = 'memory/governor-memory.md';
    const profile = {
      schemaVersion: 'human-profile.v1', id: humanId, type: 'human', name: humanId,
      governor: { config: 'governor.yml', role: 'personal-governor', lifecycle: 'persistent',
        readinessToken: 'PERSONAL_GOVERNOR_READY' },
      memory: { config: 'memory.yml' },
      authorizedProfiles: [], authorizedWorkflows: [],
    };
    const governor = {
      schemaVersion: 'profile-agent-binding.v1', agentId: 'personal-governor',
      roleDefinition: roleRef, scope: 'governed-human', lifecycle: 'persistent',
      humanFacing: true, readinessToken: 'PERSONAL_GOVERNOR_READY',
      subject: { id: humanId, name: humanId }, platformBindings: { 'codex-app': {} },
      memory: [{ name: 'governor', uri: 'profile-memory://governor',
        authority: 'source-of-truth', access: 'read-write', provider: 'local-profile-memory' }],
      cutover: { authoritativeMemory: 'profile-memory://governor', writableAuthorityCount: 1,
        resolutionChain: ['profile-memory://governor', 'local-profile-memory', memoryPath] },
    };
    const memory = {
      schemaVersion: 'profile-memory.v0-draft',
      permanentMemory: { governor: { provider: 'local-profile-memory', authoritative: true,
        writableAuthority: true, path: memoryPath, format: 'markdown', humanInterface: 'markdown',
        access: 'read-write', sourceOfTruth: true } },
      retrieval: { sourcePermanentMemoryRef: 'governor', writableAuthorityCount: 1 },
      consumers: { personalGovernor: { permanentMemoryRef: 'governor' } },
    };
    return new Map([
      ['profile.yml', YAML.stringify(profile)],
      ['governor.yml', YAML.stringify(governor)],
      ['memory.yml', YAML.stringify(memory)],
      [memoryPath, '# Personal Governor memory\n\nNo plans or commitments recorded yet.\n'],
    ]);
  }

  prepare(humansDir, humanId) {
    const files = this.render(humanId);
    const catalog = this.#catalog(humansDir);
    const target = path.join(catalog, humanId);
    if (this.io.existsSync(target)) return this.#existingProfile(target);
    try { this.io.mkdirSync(target, { mode: 0o700 }); }
    catch (error) {
      if (error.code === 'EEXIST') return this.#existingProfile(target);
      throw error;
    }
    this.io.mkdirSync(path.join(target, 'memory'), { mode: 0o700 });
    for (const [relative, content] of files)
      this.io.writeFileSync(path.join(target, relative), content, { flag: 'wx', mode: 0o600 });
    return { humanDir: target, created: true };
  }

  // Private implementation

  #catalog(humansDir) {
    if (!humansDir) throw new Error('GOVERNOR_HUMAN_CATALOG_NOT_CONFIGURED');
    let catalog;
    try { catalog = this.io.realpathSync(humansDir); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('GOVERNOR_HUMAN_CATALOG_NOT_FOUND', { cause: error });
      throw error;
    }
    if (!this.io.statSync(catalog).isDirectory())
      throw new Error('GOVERNOR_HUMAN_CATALOG_NOT_DIRECTORY');
    return catalog;
  }

  #existingProfile(target) {
    if (!this.io.lstatSync(target).isDirectory())
      throw new Error('GOVERNOR_EXISTING_HUMAN_PROFILE_INCOMPLETE');
    // Existing profiles may declare different Governor and memory filenames.
    // The Governor preflight validates their exact declarations after this check.
    const profileFile = path.join(target, 'profile.yml');
    if (!this.io.existsSync(profileFile) || !this.io.lstatSync(profileFile).isFile())
      throw new Error('GOVERNOR_EXISTING_HUMAN_PROFILE_INCOMPLETE');
    return { humanDir: this.io.realpathSync(target), created: false };
  }
}
