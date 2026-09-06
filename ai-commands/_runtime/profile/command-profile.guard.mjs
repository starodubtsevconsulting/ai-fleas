import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function requireCommandProfile(commandId, modulePath) {
  const profileFile = process.env.AI_PROFILE_FILE || '';
  const workflow = process.env.AI_FLOW_WORKFLOW || '';
  const profileId = process.env.AI_WORK_PROFILE_ID || process.env.WORK_PROFILE_ID || '';
  const commandsRoot = process.env.AI_COMMANDS_ROOT || '';
  if (!profileFile || !workflow || !profileId || !commandsRoot || !isAbsolute(commandsRoot) || !existsSync(profileFile)) {
    throw new Error(`PROFILE_REQUIRED: select an AI Profile before running command ${commandId}`);
  }
  const expectedCommandRoot = resolve(commandsRoot, commandId);
  if (!resolve(modulePath).startsWith(`${expectedCommandRoot}/`)) {
    throw new Error(`PROFILE_BLOCKED: module is outside selected command ${commandId}`);
  }

  const profileProjectRoot = resolve(dirname(profileFile), '..', '..');
  const resolver = resolve(commandsRoot, 'runtime', 'profile', 'activate-profile.sh');
  const result = spawnSync(resolver, ['--profile', profileId, '--workflow', workflow, '--command', commandId], {
    encoding: 'utf8',
    env: { ...process.env, AI_CONFIG_PROJECT: profileProjectRoot },
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `PROFILE_BLOCKED: command ${commandId}`);
  }
}
