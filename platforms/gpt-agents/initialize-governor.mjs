#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireFile(file, label) {
  const resolved = fs.realpathSync(file);
  if (!fs.statSync(resolved).isFile()) throw new Error(`${label} is not a file: ${file}`);
  return resolved;
}

function readYaml(file, label) {
  return YAML.parse(fs.readFileSync(requireFile(file, label), 'utf8'));
}

function declaredFile(base, ref, label) {
  if (typeof ref !== 'string' || !ref) throw new Error(`${label} is not declared`);
  return requireFile(path.resolve(base, ref), label);
}

export function buildGovernorInitialization(humanDir, humanId, generation, options = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(humanId)) throw new Error('exact human profile ID required');
  const dir = fs.realpathSync(humanDir);
  const profileFile = requireFile(path.join(dir, 'profile.yml'), 'human profile');
  const profile = readYaml(profileFile, 'human profile');
  if (profile.type !== 'human' || profile.id !== humanId || path.basename(dir) !== humanId) {
    throw new Error('human profile ID or type does not match');
  }
  const governorFile = declaredFile(dir, profile.governor?.config, 'Governor config');
  const memoryFile = declaredFile(dir, profile.memory?.config, 'memory config');
  const governor = readYaml(governorFile, 'Governor config');
  const memory = readYaml(memoryFile, 'memory config');
  if (profile.governor?.role !== 'personal-governor' ||
      governor.agentId !== 'personal-governor' || governor.subject?.id !== humanId ||
      profile.governor?.readinessToken !== 'PERSONAL_GOVERNOR_READY' ||
      governor.readinessToken !== 'PERSONAL_GOVERNOR_READY' ||
      !governor.platformBindings?.['gpt-agents']) {
    throw new Error('Personal Governor role, subject, readiness, or platform binding conflicts');
  }
  const roleFile = declaredFile(path.dirname(governorFile), governor.roleDefinition, 'Governor role');
  for (const [name, settings] of Object.entries(governor.governorStrategy?.methodSettings ?? {})) {
    if (settings?.enabled && settings.method) declaredFile(path.dirname(governorFile), settings.method, `${name} method`);
  }
  const binding = governor.memory?.find(item => item.name === 'governor');
  const permanent = memory.permanentMemory?.governor;
  if (binding?.uri !== 'profile-memory://governor' || binding?.authority !== 'source-of-truth' ||
      binding?.access !== 'read-write' || permanent?.provider !== binding.provider ||
      permanent?.authoritative !== true || permanent?.writableAuthority !== true ||
      memory.consumers?.personalGovernor?.permanentMemoryRef !== 'governor') {
    throw new Error('authoritative Governor memory binding conflicts');
  }
  const providerFile = declaredFile(dir, permanent.providerConfig, 'memory provider config');
  if (binding.provider !== 'permanent-memory-synology') {
    throw new Error(`unsupported Governor memory provider: ${binding.provider}`);
  }
  if (!Array.isArray(profile.authorizedProfiles) || !Array.isArray(profile.authorizedWorkflows)) {
    throw new Error('authorized profile and workflow contexts are missing');
  }
  const providerScript = requireFile(path.join(repoRoot,
    'ai-commands/connect/permanent-memory-synology/permanent-memory-synology.command.sh'), 'memory provider command');
  const check = options.checkProvider
    ? options.checkProvider(providerFile)
    : spawnSync('bash', [providerScript, 'check'], {
      encoding: 'utf8', env: { ...process.env, PERMANENT_MEMORY_SYNOLOGY_CONFIG: providerFile },
    });
  if (check.error || check.status !== 0 || !/^provider=synology$/m.test(check.stdout) ||
      !/^reachable=true$/m.test(check.stdout) || !/^access=read-write$/m.test(check.stdout) ||
      !/^writable=true$/m.test(check.stdout)) {
    throw new Error(`Governor memory is not usable: ${check.error?.message || check.stderr?.trim() || check.stdout?.trim()}`);
  }
  const initializerFile = requireFile(path.join(scriptDir, 'agents/personal-governor-initialization.md'), 'GPT initializer');
  return {
    binding: {
      platformAdapter: 'gpt-agents', agentId: 'personal-governor', generation,
      scope: { kind: 'governed-human', humanProfileId: humanId },
      initialization: {
        readinessToken: 'PERSONAL_GOVERNOR_READY', memoryBinding: binding.uri,
        sources: [
          { id: 'portable-role', ref: roleFile },
          { id: 'gpt-initializer', ref: initializerFile },
          { id: 'human-profile', ref: profileFile },
          { id: 'human-governor', ref: governorFile },
          { id: 'human-memory', ref: memoryFile },
          { id: 'memory-provider', ref: providerFile },
        ],
      },
    },
    prompt: `Initialize Personal Governor for ${humanId}. This is the exact host-authorized initialization transaction for this task. Load and verify the canonical sources and declared memory route supplied by the AI Fleas plugin. If every check passes, reply with exactly PERSONAL_GOVERNOR_READY and no other text. Otherwise report the concrete blocker without the readiness token.`,
  };
}

function parseArgs(args) {
  const options = {};
  while (args.length) {
    const flag = args.shift();
    if (!['--human', '--human-dir', '--thread'].includes(flag) || !args.length) {
      throw new Error('usage: initialize-governor --human ID --human-dir PATH --thread TASK_ID');
    }
    options[flag.slice(2)] = args.shift();
  }
  if (!options.human || !options['human-dir'] || !uuid.test(options.thread ?? '')) {
    throw new Error('usage: initialize-governor --human ID --human-dir PATH --thread TASK_ID');
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = process.env.PLUGIN_DATA || path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    'plugins/data/ai-fleas-gpt-ai-fleas',
  );
  const registryFile = path.join(dataDir, 'agent-bindings.json');
  const registry = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, 'utf8')) : { instances: {} };
  const exact = registry.instances?.[options.thread];
  if (exact?.status === 'active' && exact.agentId === 'personal-governor' &&
      exact.scope?.humanProfileId === options.human) {
    buildGovernorInitialization(options['human-dir'], options.human, exact.generation);
    process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'active', alreadyInitialized: true })}\n`);
    return;
  }
  const sameHuman = Object.entries(registry.instances ?? {}).filter(([id, item]) =>
    id !== options.thread && item?.agentId === 'personal-governor' &&
    item?.scope?.humanProfileId === options.human && ['active', 'pending'].includes(item.status));
  if (sameHuman.length) throw new Error('another Governor binding exists; verify and reconcile its exact host task before replacement');
  const generation = 1 + Math.max(0, ...Object.values(registry.instances ?? {})
    .filter(item => item?.agentId === 'personal-governor' && item?.scope?.humanProfileId === options.human)
    .map(item => Number.isInteger(item.generation) ? item.generation : 0));
  const payload = buildGovernorInitialization(options['human-dir'], options.human, generation);
  const inputDir = path.join(dataDir, 'initialization-inputs', `${options.thread}-${process.pid}`);
  fs.mkdirSync(inputDir, { recursive: true, mode: 0o700 });
  const bindingFile = path.join(inputDir, 'binding.json');
  const promptFile = path.join(inputDir, 'prompt.txt');
  try {
    fs.writeFileSync(bindingFile, `${JSON.stringify(payload.binding)}\n`, { mode: 0o600 });
    fs.writeFileSync(promptFile, `${payload.prompt}\n`, { mode: 0o600 });
    const helper = path.join(scriptDir, 'plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/queue-agent-initialization.mjs');
    const queued = spawnSync(process.execPath, [helper, options.thread, bindingFile, promptFile], {
      encoding: 'utf8', env: { ...process.env, PLUGIN_DATA: dataDir },
    });
    if (queued.error || queued.status !== 0) {
      throw new Error(queued.error?.message || queued.stderr?.trim() || queued.stdout?.trim() || 'queue failed');
    }
    process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'pending', generation })}\n`);
  } finally {
    fs.rmSync(bindingFile, { force: true });
    fs.rmSync(promptFile, { force: true });
    fs.rmdirSync(inputDir);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
