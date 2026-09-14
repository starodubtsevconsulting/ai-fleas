import { existsSync, readdirSync } from 'node:fs';
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
  const directCommandRoot = resolve(commandsRoot, commandId);
  const categorizedCommandRoots = [];
  for (const category of readdirSync(commandsRoot, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name.startsWith('_')) continue;
    const candidate = resolve(commandsRoot, category.name, commandId);
    if (existsSync(candidate)) categorizedCommandRoots.push(candidate);
  }
  const commandRoots = existsSync(directCommandRoot)
    ? [directCommandRoot]
    : categorizedCommandRoots;
  if (commandRoots.length !== 1) {
    throw new Error(`PROFILE_BLOCKED: command ${commandId} must resolve exactly once under the selected command catalog`);
  }
  const expectedCommandRoot = commandRoots[0];
  if (!resolve(modulePath).startsWith(`${expectedCommandRoot}/`)) {
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
