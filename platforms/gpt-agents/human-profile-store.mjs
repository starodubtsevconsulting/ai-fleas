/** Purpose: locate the GPT adapter's local human-profile store.
 * Caller: the daily launcher and prepare-human-profile CLI before Governor bootstrap.
 * Inputs: process environment, home directory, and optional createDefault flag.
 * Output: profile-store path. Effects: only when no explicit location is configured
 * and createDefault is true, creates the adapter-owned local default store.
 * This helper does not create a human profile or initialize an agent.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class HumanProfileStore {
  constructor({ io = fs, environment = process.env, home = os.homedir() } = {}) {
    this.io = io;
    this.environment = environment;
    this.home = home;
  }

  configFile() {
    const configRoot = this.environment.XDG_CONFIG_HOME || path.join(this.home, '.config');
    return path.join(configRoot, 'ai-fleas', 'gpt-agents', 'humans-dir');
  }

  defaultCatalog() {
    const dataRoot = this.environment.XDG_DATA_HOME || path.join(this.home, '.local', 'share');
    if (!path.isAbsolute(dataRoot)) throw new Error('GOVERNOR_HUMAN_STORE_ROOT_NOT_ABSOLUTE');
    return path.join(dataRoot, 'ai-fleas', 'humans');
  }

  explicitLocation() {
    const explicit = this.environment.AI_FLEAS_HUMANS_DIR?.trim();
    if (explicit) {
      if (!path.isAbsolute(explicit)) throw new Error('GOVERNOR_HUMAN_LOCATION_NOT_ABSOLUTE');
      return explicit;
    }
    const configFile = this.configFile();
    if (this.io.existsSync(configFile)) {
      const configured = this.io.readFileSync(configFile, 'utf8').trim();
      if (!configured) throw new Error('GOVERNOR_HUMAN_CATALOG_CONFIG_EMPTY');
      if (!path.isAbsolute(configured)) throw new Error('GOVERNOR_HUMAN_LOCATION_NOT_ABSOLUTE');
      return configured;
    }
    return null;
  }

  resolve({ createDefault = false } = {}) {
    const explicit = this.explicitLocation();
    if (explicit) return explicit;
    const fallback = this.defaultCatalog();
    if (createDefault) this.io.mkdirSync(fallback, { recursive: true, mode: 0o700 });
    return fallback;
  }
}
