#!/usr/bin/env node
/** Human/controller-invoked Governor initializer, called by launcher.mjs.
 * Inputs: exact human profile directory, human ID and task ID; output: binding readiness.
 * Effects: validates declared sources; queues, retries, or reconciles the exact
 * host-backed Governor binding through the plugin's lifecycle registry.
 * It does not create tasks or initialize a workflow roster.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { connectNativeAppServer } from './native-app-server.mjs';
import { inspectGovernorPending } from './governor-reconciliation.mjs';
import { withGovernorRegistryLock } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/governor-registry-lock.mjs';

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

function taskAccessError(operation, error) {
  if (['EACCES', 'EPERM', 'EROFS'].includes(error?.code)) {
    return new Error(`current task environment blocks ${operation}: ${error.message}`, { cause: error });
  }
  return error;
}

function verifyMemoryWrite(file, options) {
  try {
    if (options.checkMemoryWrite) return options.checkMemoryWrite(file);
    const descriptor = fs.openSync(file, 'r+');
    fs.closeSync(descriptor);
  } catch (error) {
    throw taskAccessError('writing the authoritative Governor memory file', error);
  }
}

function resolveGovernorMemory(dir, permanent, memory, governor, options) {
  if (permanent.provider === 'git-profile-memory') {
    const memoryFile = declaredFile(dir, permanent.path, 'authoritative Git memory');
    const relative = path.relative(dir, memoryFile);
    if (!relative.startsWith(`memory${path.sep}`) ||
        permanent.format !== 'markdown' || permanent.humanInterface !== 'git' ||
        permanent.access !== 'read-write' || permanent.sourceOfTruth !== true ||
        memory.retrieval?.sourcePermanentMemoryRef !== 'governor' ||
        memory.retrieval?.writableAuthorityCount !== 1) {
      throw new Error('authoritative Git memory binding is invalid');
    }
    const expectedChain = ['profile-memory://governor', 'git-profile-memory', permanent.path];
    if (governor.cutover?.authoritativeMemory !== expectedChain[0] ||
        governor.cutover?.writableAuthorityCount !== 1 ||
        JSON.stringify(governor.cutover?.resolutionChain) !== JSON.stringify(expectedChain)) {
      throw new Error('Governor cutover conflicts with authoritative Git memory');
    }
    verifyMemoryWrite(memoryFile, options);
    return memoryFile;
  }
  if (permanent.provider !== 'permanent-memory-synology') {
    throw new Error(`unsupported Governor memory provider: ${permanent.provider}`);
  }
  const providerFile = declaredFile(dir, permanent.providerConfig, 'memory provider config');
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
    if (check.error) throw taskAccessError('checking the declared memory provider', check.error);
    const detail = check.stderr?.trim() || check.stdout?.trim();
    if (/permission denied|operation not permitted|network access denied/i.test(detail)) {
      throw new Error(`current task environment blocks checking the declared memory provider: ${detail}`);
    }
    throw new Error(`Governor memory is not usable: ${detail}`);
  }
  return providerFile;
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
      !governor.platformBindings?.['codex-app']) {
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
  const memorySource = resolveGovernorMemory(dir, permanent, memory, governor, options);
  if (!Array.isArray(profile.authorizedProfiles) || !Array.isArray(profile.authorizedWorkflows)) {
    throw new Error('authorized profile and workflow contexts are missing');
  }
  const initializerFile = requireFile(path.join(scriptDir, 'agents/personal-governor-initialization.md'), 'GPT initializer');
  return {
    binding: {
      platformAdapter: 'codex-app', agentId: 'personal-governor', generation,
      scope: { kind: 'governed-human', humanProfileId: humanId },
      initialization: {
        readinessToken: 'PERSONAL_GOVERNOR_READY', memoryBinding: binding.uri,
        sources: [
          { id: 'portable-role', ref: roleFile },
          { id: 'gpt-initializer', ref: initializerFile },
          { id: 'human-profile', ref: profileFile },
          { id: 'human-governor', ref: governorFile },
          { id: 'human-memory', ref: memoryFile },
          { id: 'memory-provider', ref: memorySource },
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

function agentCreatedStateRecord(taskId) {
  const stateFile = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'state_5.sqlite');
  if (!fs.existsSync(stateFile)) return null;
  let database;
  try {
    database = new DatabaseSync(stateFile, { readOnly: true });
    return database.prepare('SELECT id, archived, thread_source, cwd FROM threads WHERE id = ?').get(taskId) ?? null;
  } catch {
    throw new Error('GOVERNOR_HOST_STATE_UNVERIFIED');
  } finally {
    database?.close();
  }
}

export async function hostTaskState(client, taskId, { readAgentCreatedRecord = agentCreatedStateRecord } = {}) {
  // Exact local host-state evidence avoids unbounded native catalog pages. The
  // catalog remains the fallback when the exact state row is unavailable.
  if (uuid.test(taskId)) {
    const row = readAgentCreatedRecord(taskId);
    if (row) {
      if (row.id !== taskId || ![0, 1].includes(row.archived) ||
          !['agent_created_thread', null].includes(row.thread_source) ||
          typeof row.cwd !== 'string' || !row.cwd)
        throw new Error('GOVERNOR_HOST_STATE_UNVERIFIED');
      const response = await client.request('thread/read', { threadId: taskId, includeTurns: false });
      const task = response?.thread;
      if (task?.id !== taskId || task.cwd !== row.cwd || task.projectId != null ||
          task.ephemeral === true ||
          (row.thread_source === 'agent_created_thread' && row.archived === 0 &&
            task.threadSource !== 'agent_created_thread'))
        throw new Error('GOVERNOR_HOST_STATE_UNVERIFIED');
      return { task, archived: row.archived === 1 };
    }
  }
  let found = null;
  for (const archived of [false, true]) {
    let cursor;
    const visited = new Set();
    do {
      const page = await client.request('thread/list', {
        archived,
        sourceKinds: ['cli', 'vscode', 'exec', 'appServer', 'subAgent', 'subAgentReview',
          'subAgentCompact', 'subAgentThreadSpawn', 'subAgentOther', 'unknown'],
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (!Array.isArray(page?.data)) throw new Error('GOVERNOR_HOST_CATALOG_UNVERIFIED');
      for (const task of page.data.filter(item => item.id === taskId)) {
        if (found) throw new Error('GOVERNOR_HOST_TASK_AMBIGUOUS');
        found = { task, archived };
      }
      cursor = page.nextCursor;
      if (cursor == null) break;
      if (typeof cursor !== 'string' || !cursor || visited.has(cursor))
        throw new Error('GOVERNOR_HOST_CATALOG_UNVERIFIED');
      visited.add(cursor);
    } while (true);
  }
  if (!found && uuid.test(taskId)) {
    const loaded = await client.request('thread/loaded/list', {});
    if (!Array.isArray(loaded?.data)) throw new Error('GOVERNOR_HOST_CATALOG_UNVERIFIED');
    if (loaded.data.some(item => (typeof item === 'string' ? item : item?.id) === taskId)) {
      const response = await client.request('thread/read', { threadId: taskId, includeTurns: false });
      const task = response?.thread;
      if (task?.id !== taskId || task.projectId != null || task.ephemeral === true)
        throw new Error('GOVERNOR_HOST_STATE_UNVERIFIED');
      found = { task, archived: false };
    }
  }
  return found;
}

function queueGovernorPayload(dataDir, taskId, payload) {
  const inputDir = path.join(dataDir, 'initialization-inputs', `${taskId}-${process.pid}`);
  fs.mkdirSync(inputDir, { recursive: true, mode: 0o700 });
  const bindingFile = path.join(inputDir, 'binding.json');
  const promptFile = path.join(inputDir, 'prompt.txt');
  try {
    fs.writeFileSync(bindingFile, `${JSON.stringify(payload.binding)}\n`, { mode: 0o600 });
    fs.writeFileSync(promptFile, `${payload.prompt}\n`, { mode: 0o600 });
    const helper = path.join(scriptDir, 'plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/queue-agent-initialization.mjs');
    const queued = spawnSync(process.execPath, [helper, taskId, bindingFile, promptFile], {
      encoding: 'utf8', env: { ...process.env, PLUGIN_DATA: dataDir },
    });
    if (queued.error || queued.status !== 0) {
      throw new Error(queued.error?.message || queued.stderr?.trim() || queued.stdout?.trim() || 'queue failed');
    }
  } finally {
    fs.rmSync(bindingFile, { force: true });
    fs.rmSync(promptFile, { force: true });
    fs.rmdirSync(inputDir);
  }
}

function activateReconciledGovernor(registryFile, expectedBinding, taskId, evidence) {
  return withGovernorRegistryLock(registryFile, () => {
    const current = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    const binding = current.instances?.[taskId];
    if (JSON.stringify(binding) !== JSON.stringify(expectedBinding))
      throw new Error('GOVERNOR_PENDING_BINDING_CHANGED');
    const competing = Object.entries(current.instances).some(([id, item]) =>
      id !== taskId && id !== binding.replaces?.taskId &&
      item?.agentId === 'personal-governor' &&
      item.scope?.humanProfileId === binding.scope.humanProfileId &&
      ['active', 'pending'].includes(item.status));
    if (competing) throw new Error('GOVERNOR_COMPETING_BINDING');
    const replacement = binding.replaces;
    const predecessor = replacement && current.instances?.[replacement.taskId];
    if (replacement && (!['active', 'archived'].includes(predecessor?.status) ||
        predecessor.agentId !== 'personal-governor' ||
        predecessor.generation !== replacement.generation ||
        predecessor.scope?.humanProfileId !== binding.scope.humanProfileId))
      throw new Error('GOVERNOR_PREDECESSOR_CHANGED');
    binding.status = 'active';
    binding.activatedAt = new Date().toISOString();
    binding.initialization.completedTurnId = evidence.completedTurnId;
    binding.initialization.completedAt = evidence.completedAt;
    delete binding.initialization.promptSha256;
    delete binding.initialization.expiresAt;
    delete binding.initialization.turnId;
    delete binding.initialization.startedAt;
    if (predecessor?.status === 'active') {
      predecessor.status = 'superseded';
      predecessor.supersededBy = taskId;
      predecessor.supersededAt = binding.activatedAt;
    }
    const swap = `${registryFile}.${process.pid}.reconcile.tmp`;
    fs.writeFileSync(swap, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(swap, registryFile);
  });
}

export async function reconcileUnavailableGovernorReceipts(registryFile, registry, client, humanId) {
  const candidates = Object.entries(registry.instances ?? {}).filter(([, binding]) =>
    binding?.agentId === 'personal-governor' &&
    binding.scope?.humanProfileId === humanId &&
    ['active', 'pending'].includes(binding.status));
  const stale = [];
  for (const [taskId] of candidates) {
    const host = await hostTaskState(client, taskId);
    if (host?.task.projectId != null) throw new Error('GOVERNOR_RECORDED_TASK_NOT_PROJECTLESS');
    if (!host || host.archived) stale.push({ taskId, status: host ? 'archived' : 'missing' });
  }
  if (!stale.length) return registry;
  return withGovernorRegistryLock(registryFile, () => {
    const latest = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    for (const [taskId, binding] of candidates) {
      if (JSON.stringify(latest.instances?.[taskId]) !== JSON.stringify(binding))
        throw new Error('GOVERNOR_BINDING_CHANGED_DURING_RECONCILIATION');
    }
    const at = new Date().toISOString();
    for (const { taskId, status } of stale) {
      latest.instances[taskId].status = status;
      if (status === 'archived') {
        latest.instances[taskId].archivedAt = at;
        latest.instances[taskId].archiveObservedBy = 'governor-initializer-host-catalog';
      } else {
        latest.instances[taskId].missingObservedAt = at;
        latest.instances[taskId].missingObservedBy = 'governor-initializer-host-catalog';
      }
    }
    const swap = `${registryFile}.${process.pid}.archive.tmp`;
    fs.writeFileSync(swap, `${JSON.stringify(latest, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(swap, registryFile);
    return latest;
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = process.env.PLUGIN_DATA || path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    'plugins/data/ai-fleas-gpt-ai-fleas',
  );
  const registryFile = path.join(dataDir, 'agent-bindings.json');
  let registry = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, 'utf8')) : { instances: {} };
  buildGovernorInitialization(options['human-dir'], options.human, 1);
  const runtimeHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const client = await connectNativeAppServer({
    socketPath: path.join(runtimeHome, 'app-server-control/app-server-control.sock'),
  });
  try {
    registry = await reconcileUnavailableGovernorReceipts(registryFile, registry, client, options.human);
    const exact = registry.instances?.[options.thread];
    if (exact && (exact.agentId !== 'personal-governor' ||
        exact.scope?.humanProfileId !== options.human ||
        !['active', 'pending'].includes(exact.status)))
      throw new Error('GOVERNOR_EXACT_TASK_BINDING_CONFLICT');
    const hostEntry = await hostTaskState(client, options.thread);
    if (!hostEntry || hostEntry.archived || hostEntry.task.projectId != null)
      throw new Error('GOVERNOR_PROJECTLESS_HOST_TASK_UNVERIFIED');
    const response = await client.request('thread/read', { threadId: options.thread, includeTurns: true });
    const thread = response?.thread;
    if (thread?.id !== options.thread || thread.projectId != null)
      throw new Error('GOVERNOR_PROJECTLESS_HOST_TASK_UNVERIFIED');
    if (exact?.status === 'active') {
      buildGovernorInitialization(options['human-dir'], options.human, exact.generation);
      process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'active',
        alreadyInitialized: true })}\n`);
      return;
    }
    if (exact?.status === 'pending') {
      const canonical = buildGovernorInitialization(options['human-dir'], options.human, exact.generation);
      if (JSON.stringify(exact.initialization?.sources) !==
            JSON.stringify(canonical.binding.initialization.sources) ||
          exact.initialization?.memoryBinding !== canonical.binding.initialization.memoryBinding)
        throw new Error('GOVERNOR_CANONICAL_SOURCES_CHANGED');
      const decision = inspectGovernorPending({
        registry, taskId: options.thread, humanId: options.human,
        binding: exact, prompt: canonical.prompt, thread,
      });
      if (decision.status === 'blocked') throw new Error(decision.reason);
      if (decision.status === 'wait') {
        process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'pending',
          alreadyQueued: true, reason: decision.reason })}\n`);
        return;
      }
      if (exact.replaces) {
        const predecessor = await hostTaskState(client, exact.replaces.taskId);
        if (!predecessor || predecessor.task.projectId != null ||
            predecessor.archived !==
              (registry.instances?.[exact.replaces.taskId]?.status === 'archived'))
          throw new Error('GOVERNOR_PREDECESSOR_HOST_UNVERIFIED');
      }
      if (decision.status === 'ready') {
        activateReconciledGovernor(registryFile, exact, options.thread, decision);
        process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'active',
          reconciled: true, completedTurnId: decision.completedTurnId })}\n`);
        return;
      }
      const next = buildGovernorInitialization(options['human-dir'], options.human, exact.generation + 1);
      if (exact.replaces) next.binding.replaces = exact.replaces;
      queueGovernorPayload(dataDir, options.thread, next);
      process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'pending',
        retried: true, generation: next.binding.generation })}\n`);
      return;
    }
    if (thread.turns?.some(turn => turn.status === 'inProgress'))
      throw new Error('GOVERNOR_HOST_TASK_RUNNING');
    const sameHuman = Object.entries(registry.instances ?? {}).filter(([id, item]) =>
      id !== options.thread && item?.agentId === 'personal-governor' &&
      item?.scope?.humanProfileId === options.human && ['active', 'pending'].includes(item.status));
    const pending = sameHuman.filter(([, item]) => item.status === 'pending');
    const active = sameHuman.filter(([, item]) => item.status === 'active');
    if (pending.length || active.length > 1) {
      throw new Error('Governor lifecycle state is ambiguous; reconcile exact host tasks before replacement');
    }
    const generation = 1 + Math.max(0, ...Object.values(registry.instances ?? {})
      .filter(item => item?.agentId === 'personal-governor' && item?.scope?.humanProfileId === options.human)
      .map(item => Number.isInteger(item.generation) ? item.generation : 0));
    const payload = buildGovernorInitialization(options['human-dir'], options.human, generation);
    if (active.length === 1) {
      const [predecessorTaskId, predecessor] = active[0];
      payload.binding.replaces = {
        taskId: predecessorTaskId,
        generation: predecessor.generation,
        strategy: 'successor-first',
      };
    }
    queueGovernorPayload(dataDir, options.thread, payload);
    process.stdout.write(`${JSON.stringify({ threadId: options.thread, status: 'pending', generation })}\n`);
  } finally {
    client.close();
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
