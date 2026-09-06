import fs from 'node:fs';
import path from 'node:path';
import { config } from '../lodgify-core.mjs';
import { ConfigProviderPort } from './ports.mjs';

export class LocalConfigProvider extends ConfigProviderPort {
  constructor({ configPath, allowTestOrigin = false }) {
    super();
    this.configPath = path.resolve(configPath);
    this.allowTestOrigin = allowTestOrigin;
  }

  load() {
    if (!fs.existsSync(this.configPath)) {
      throw Error('profile-owned Lodgify config required');
    }
    return config(fs.readFileSync(this.configPath, 'utf8'), {
      testOrigin: this.allowTestOrigin,
    });
  }
}
