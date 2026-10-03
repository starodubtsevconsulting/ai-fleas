/** Purpose: let the macOS GPT launcher ensure one human-scoped Governor without Admin.
 * Caller: launcher.mjs after plugin/setup checks, never an automatic background hook.
 * Inputs: exact host client, plugin registry, selected human ID, canonical human directory.
 * Output: existing, pending, or verified ready task ID.
 * Effects: reconciles archived receipts, may create one projectless host task, queue
 * its exact INIT through the checked-in initializer, and pin only verified readiness.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { buildGovernorInitialization, hostTaskState,
  reconcileUnavailableGovernorReceipts } from './initialize-governor.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const humanIdPattern = /^[a-z][a-z0-9-]*$/;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function governorWorkspaceRoots(humanDir, canonical) {
  const sources = canonical?.binding?.initialization?.sources;
  if (!Array.isArray(sources)) return [humanDir];
  const profileSource = sources.find(source => source.id === 'human-profile')?.ref;
  if (profileSource !== path.join(humanDir, 'profile.yml'))
    throw new Error('GOVERNOR_HUMAN_PROFILE_SOURCE_UNVERIFIED');
  const profile = YAML.parse(fs.readFileSync(profileSource, 'utf8'));
  if (!Array.isArray(profile?.authorizedProfiles))
    throw new Error('GOVERNOR_AUTHORIZED_CONTEXTS_UNVERIFIED');
  const profileRoot = path.resolve(humanDir, '../..');
  const roots = [humanDir];
  const contexts = new Map();
  for (const source of sources) {
    if (source.id === 'portable-role' || source.id === 'gpt-initializer')
      roots.push(fs.realpathSync(path.dirname(source.ref)));
  }
  for (const context of profile.authorizedProfiles) {
    if (!humanIdPattern.test(context?.id ?? ''))
      throw new Error('GOVERNOR_AUTHORIZED_CONTEXTS_UNVERIFIED');
    const root = fs.realpathSync(path.join(profileRoot, context.id));
    if (path.dirname(root) !== profileRoot)
      throw new Error('GOVERNOR_AUTHORIZED_CONTEXTS_UNVERIFIED');
    roots.push(root);
    const workProfileFile = path.join(root, `${context.id}-work-profile.yml`);
    const workProfile = YAML.parse(fs.readFileSync(workProfileFile, 'utf8'));
    contexts.set(context.id, { root, workProfile });
  }
  for (const workflow of profile.authorizedWorkflows ?? []) {
    if (!humanIdPattern.test(workflow?.profile ?? '') ||
        !humanIdPattern.test(workflow?.id ?? '') ||
        workflow.path !== `${workflow.id}.workflow.md`)
      throw new Error('GOVERNOR_AUTHORIZED_WORKFLOW_UNVERIFIED');
    const context = contexts.get(workflow.profile);
    if (!context || !context.workProfile.workflows?.some(item => item.path === workflow.path))
      throw new Error('GOVERNOR_AUTHORIZED_WORKFLOW_UNVERIFIED');
    const workflowRoot = fs.realpathSync(path.resolve(context.root,
      context.workProfile.ai_workflows_root));
    const definitionDir = fs.realpathSync(path.join(workflowRoot, workflow.id));
    if (path.dirname(definitionDir) !== workflowRoot ||
        !fs.statSync(path.join(definitionDir, workflow.path)).isFile())
      throw new Error('GOVERNOR_AUTHORIZED_WORKFLOW_UNVERIFIED');
    roots.push(definitionDir);
  }
  return [...new Set(roots)];
}

export function readGovernorRegistry(registryFile, io = fs) {
  if (!io.existsSync(registryFile)) return { schemaVersion: 1, instances: {} };
  const registry = JSON.parse(io.readFileSync(registryFile, 'utf8'));
  if (!registry || typeof registry.instances !== 'object' || !registry.instances ||
      Array.isArray(registry.instances)) throw new Error('GOVERNOR_REGISTRY_UNVERIFIED');
  return registry;
}

export function selectGovernorHuman(registry, requestedHuman, askHuman) {
  const receipts = Object.values(registry.instances).filter(binding =>
    binding?.agentId === 'personal-governor' &&
    binding.scope?.kind === 'governed-human' &&
    humanIdPattern.test(binding.scope.humanProfileId ?? ''));
  const current = [...new Set(receipts.filter(binding => ['active', 'pending'].includes(binding.status))
    .map(binding => binding.scope.humanProfileId))];
  const known = [...new Set(receipts.map(binding => binding.scope.humanProfileId))];
  const human = requestedHuman || (current.length === 1 ? current[0] :
    current.length === 0 && known.length === 1 ? known[0] : askHuman());
  if (!humanIdPattern.test(human ?? '')) throw new Error('GOVERNOR_HUMAN_ID_REQUIRED');
  return human;
}

export function resolveGovernorHumanDir(registry, humanId, { humansDir, io = fs } = {}) {
  if (!humanIdPattern.test(humanId)) throw new Error('GOVERNOR_HUMAN_ID_REQUIRED');
  let directory;
  if (humansDir) {
    const root = io.realpathSync(humansDir);
    directory = path.join(root, humanId);
  } else {
    const receipts = Object.values(registry.instances).filter(binding =>
      binding?.agentId === 'personal-governor' && binding.scope?.humanProfileId === humanId);
    const latest = receipts.sort((a, b) => (b.generation ?? 0) - (a.generation ?? 0))[0];
    const profile = latest?.initialization?.sources?.find(source => source.id === 'human-profile')?.ref;
    if (!profile || path.basename(profile) !== 'profile.yml')
      throw new Error('GOVERNOR_HUMAN_CATALOG_NOT_CONFIGURED');
    directory = path.dirname(profile);
  }
  const exact = io.realpathSync(directory);
  if (path.basename(exact) !== humanId || !io.statSync(exact).isDirectory())
    throw new Error('GOVERNOR_HUMAN_DIRECTORY_UNVERIFIED');
  return exact;
}

function runInitializer(humanId, humanDir, taskId, registryFile, { spawn = spawnSync } = {}) {
  const result = spawn(process.execPath, [path.join(scriptDir, 'initialize-governor.mjs'),
    '--human', humanId, '--human-dir', humanDir, '--thread', taskId], {
    encoding: 'utf8', env: { ...process.env, PLUGIN_DATA: path.dirname(registryFile) },
  });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr?.trim() || 'GOVERNOR_INITIALIZATION_FAILED');
  const parsed = JSON.parse(result.stdout);
  if (parsed.threadId !== taskId || !['pending', 'active'].includes(parsed.status))
    throw new Error('GOVERNOR_INITIALIZER_RESULT_UNVERIFIED');
  return parsed;
}

async function pinReadyGovernor(client, taskId) {
  const sections = await client.request('threadSection/list', {});
  const pinned = sections?.data?.filter(section => section.name === 'Pinned');
  if (pinned?.length !== 1) throw new Error('GOVERNOR_PINNED_SECTION_UNVERIFIED');
  await client.request('thread/section/move', { threadId: taskId, sectionId: pinned[0].id });
  const read = await client.request('thread/read', { threadId: taskId, includeTurns: false });
  if (read?.thread?.section?.id !== pinned[0].id) throw new Error('GOVERNOR_PIN_UNVERIFIED');
}

async function verifyAndPresentActiveGovernor(client, taskId, binding, hostState = hostTaskState) {
  const turnId = binding.initialization?.completedTurnId;
  const host = await hostState(client, taskId);
  if (!host || host.archived || host.task.projectId != null)
    throw new Error('GOVERNOR_READY_TASK_UNVERIFIED');
  // Activation consumes the one-use prompt permit, so turnId is no longer kept
  // in the active receipt. The Stop hook records the exact completed turn here.
  if (!turnId || binding.initialization?.readinessToken !== 'PERSONAL_GOVERNOR_READY' ||
      !binding.activatedAt)
    throw new Error('GOVERNOR_READY_RECEIPT_UNVERIFIED');
  await client.request('thread/name/set', { threadId: taskId, name: '🧭 Personal Governor' });
  await pinReadyGovernor(client, taskId);
  return turnId;
}

export async function waitForGovernor(client, registryFile, taskId, { humanId,
  readRegistry = readGovernorRegistry, hostState = hostTaskState,
  now = Date.now, pause = sleep, timeoutMs = 120_000 } = {}) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const binding = readRegistry(registryFile).instances[taskId];
    if (binding?.agentId !== 'personal-governor' ||
        binding.scope?.kind !== 'governed-human' ||
        binding.scope.humanProfileId !== humanId)
      throw new Error('GOVERNOR_LAUNCH_BINDING_UNVERIFIED');
    if (binding?.status === 'active') {
      const turnId = await verifyAndPresentActiveGovernor(client, taskId, binding, hostState);
      return { status: 'ready', taskId, completedTurnId: turnId };
    }
    if (binding?.status !== 'pending') throw new Error('GOVERNOR_PENDING_BINDING_LOST');
    // Do not fetch an in-progress transcript: command output can exceed the
    // control socket's bounded frame size. The trusted Stop hook publishes the
    // exact active receipt after a completed readiness turn.
    await pause(2000);
  }
  return { status: 'pending', taskId };
}

export async function ensurePersonalGovernor({ client, registryFile, humanId, humanDir,
  openTask, initialize = runInitializer, wait = waitForGovernor,
  preflight = buildGovernorInitialization, readRegistry = readGovernorRegistry,
  reconcile = reconcileUnavailableGovernorReceipts, hostState = hostTaskState }) {
  const canonical = preflight(humanDir, humanId, 1);
  let registry = readRegistry(registryFile);
  registry = await reconcile(registryFile, registry, client, humanId);
  const current = Object.entries(registry.instances).filter(([, binding]) =>
    binding?.agentId === 'personal-governor' &&
    binding.scope?.humanProfileId === humanId && ['active', 'pending'].includes(binding.status));
  const active = current.filter(([, binding]) => binding.status === 'active');
  const pending = current.filter(([, binding]) => binding.status === 'pending');
  if (active.length > 1 || pending.length > 1 ||
      (active.length && pending.length &&
        (pending[0][1].replaces?.taskId !== active[0][0] ||
          pending[0][1].replaces?.generation !== active[0][1].generation)))
    throw new Error('GOVERNOR_SINGLETON_BINDING_CONFLICT');
  if (active.length && !pending.length) {
    const [taskId, binding] = active[0];
    if (canonical?.binding &&
        (JSON.stringify(binding.initialization?.sources) !==
          JSON.stringify(canonical.binding.initialization.sources) ||
          binding.initialization?.memoryBinding !== canonical.binding.initialization.memoryBinding))
      throw new Error('GOVERNOR_ACTIVE_CANONICAL_SOURCES_CHANGED');
    const host = await hostState(client, taskId);
    if (!host || host.archived || host.task.projectId != null)
      throw new Error('GOVERNOR_ACTIVE_TASK_UNVERIFIED');
    await verifyAndPresentActiveGovernor(client, taskId, binding, hostState);
    return { status: 'existing', taskId };
  }
  let taskId;
  if (pending.length) {
    taskId = pending[0][0];
  } else {
    const workspaceRoots = governorWorkspaceRoots(humanDir, canonical);
    const started = await client.request('thread/start', { cwd: humanDir, projectId: null,
      runtimeWorkspaceRoots: workspaceRoots, ephemeral: false,
      sandbox: 'workspace-write', approvalPolicy: 'never' });
    taskId = started?.thread?.id;
    if (!taskId || started.thread.projectId != null || started.thread.ephemeral === true ||
        started.thread.forkedFromId || started.thread.parentThreadId ||
        fs.realpathSync(started.thread.cwd) !== fs.realpathSync(humanDir))
      throw new Error('GOVERNOR_CREATED_TASK_UNVERIFIED');
    await client.request('thread/name/set', { threadId: taskId, name: 'Personal Governor initialization' });
  }
  initialize(humanId, humanDir, taskId, registryFile);
  const settled = await wait(client, registryFile, taskId, { humanId, humanDir, initialize });
  openTask(taskId);
  return settled;
}
