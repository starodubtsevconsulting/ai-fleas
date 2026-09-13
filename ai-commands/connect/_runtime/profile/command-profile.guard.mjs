import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

export function requireCommandProfile(commandId, modulePath) {
  const profileFile = process.env.AI_PROFILE_FILE || '';
  const workflow = process.env.AI_FLOW_WORKFLOW || '';
  const profileId = process.env.AI_WORK_PROFILE_ID || process.env.WORK_PROFILE_ID || '';
  const commandsRoot = process.env.AI_COMMANDS_ROOT || '';

  if (!profileFile || !workflow || !profileId || !commandsRoot || !isAbsolute(commandsRoot) || !existsSync(profileFile)) {
    throw new Error(`PROFILE_REQUIRED: select an AI Profile before running command ${commandId}`);
  }

  const expectedCommandRoot = resolve(commandsRoot, 'connect', commandId);
  const resolvedModule = resolve(modulePath);
  if (resolvedModule !== expectedCommandRoot && !resolvedModule.startsWith(`${expectedCommandRoot}${sep}`)) {
    throw new Error(`PROFILE_BLOCKED: module is outside selected command ${commandId}`);
  }

  const profileProjectRoot = resolve(dirname(profileFile), '..', '..');
  const resolver = resolve(commandsRoot, '_runtime', 'profile', 'activate-profile.sh');
  const args = ['--profile', profileId, '--workflow', workflow];
  if (process.env.AI_AGENT_PLATFORM) args.push('--agent-platform', process.env.AI_AGENT_PLATFORM);
  args.push('--command', commandId);

  const result = spawnSync(resolver, args, {
    encoding: 'utf8',
    env: { ...process.env, AI_CONFIG_PROJECT: profileProjectRoot },
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `PROFILE_BLOCKED: command ${commandId}`);
  }
}
