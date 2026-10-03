/** Purpose: let the macOS GPT launcher ensure one human-scoped Governor without Admin.
 * Caller: launcher.mjs after plugin/setup checks, never an automatic background hook.
 * Inputs: exact host client, plugin registry, selected human ID, canonical human directory.
 * Output: existing, pending, or verified ready task ID and welcome INIT status.
 * Effects: reconciles archived receipts, may create one projectless host task, queue
 * its exact activation through the checked-in initializer, run a separate welcome
 * INIT turn after activation, record its receipt, and pin only verified readiness.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { buildGovernorInitialization, hostTaskState,
  reconcileUnavailableGovernorReceipts } from './initialize-governor.mjs';
import { withGovernorRegistryLock } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/governor-registry-lock.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const humanIdPattern = /^[a-z][a-z0-9_-]*$/;
const governorTitle = '🧭 Personal Governor';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const welcomePrompt = [
  'This is a NEW post-bootstrap Personal Governor INIT turn, not the one-time activation transaction.',
  'The earlier instruction to reply with exactly PERSONAL_GOVERNOR_READY applied only to that activation turn; do not repeat the token now.',
  'Revalidate this exact active Governor binding and canonical sources. Load authoritative memory, current plans, commitments, and the minimum near-future context.',
  'Inspect configured Governor-owned scheduled follow-ups and actual platform scheduler state. Reconcile only triggers authorized by the human profile and selected adapter; never invent a schedule or claim a callback is active without host evidence.',
  'Give the human a concise welcome using the verified profile name. Say what memory and schedules you actually verified, what you changed, and any limitation or blocker.',
].join(' ');

function updateWelcomeReceipt(registryFile, taskId, expected, next) {
  withGovernorRegistryLock(registryFile, () => {
    const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    const binding = registry.instances?.[taskId];
    if (binding?.agentId !== 'personal-governor' || binding.status !== 'active' ||
        JSON.stringify(binding.initialization?.welcome ?? null) !== JSON.stringify(expected))
      throw new Error('GOVERNOR_WELCOME_RECEIPT_CHANGED');
    binding.initialization.welcome = next;
    const swap = `${registryFile}.${process.pid}.welcome.tmp`;
    fs.writeFileSync(swap, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(swap, registryFile);
  });
}

export async function runGovernorWelcome(client, registryFile, taskId, humanId, {
  readRegistry = readGovernorRegistry, updateReceipt = updateWelcomeReceipt,
  pause = sleep, now = Date.now, timeoutMs = 180_000, requestId = randomUUID,
} = {}) {
  const binding = readRegistry(registryFile).instances?.[taskId];
  if (binding?.status !== 'active' || binding.agentId !== 'personal-governor' ||
      binding.scope?.humanProfileId !== humanId ||
      !binding.initialization?.completedTurnId)
    throw new Error('GOVERNOR_WELCOME_BINDING_UNVERIFIED');
  let welcome = binding.initialization.welcome ?? null;
  if (welcome?.status === 'completed') return { status: 'completed', turnId: welcome.turnId };
  if (welcome?.status === 'blocked') return { status: 'blocked', reason: welcome.reason };
  const deadline = now() + timeoutMs;
  if (!welcome) {
    // Do not steal the bootstrap turn's writer or send a second INIT while it
    // is still completing, even if the Stop hook has already activated us.
    let idle = false;
    while (now() < deadline) {
      const state = await client.request('thread/read', { threadId: taskId, includeTurns: false });
      if (state?.thread?.id !== taskId || state.thread.projectId != null)
        throw new Error('GOVERNOR_WELCOME_HOST_TASK_UNVERIFIED');
      if (state.thread.status?.type === 'idle') { idle = true; break; }
      await pause(2000);
    }
    if (!idle) return { status: 'pending', reason: 'GOVERNOR_BOOTSTRAP_WRITER_NOT_RELEASED' };
    welcome = { status: 'requested', requestId: requestId(), requestedAt: new Date().toISOString() };
    updateReceipt(registryFile, taskId, null, welcome);
    let submitted;
    try {
      submitted = await client.request('turn/start', { threadId: taskId,
        clientUserMessageId: welcome.requestId,
        input: [{ type: 'text', text: welcomePrompt }] });
    } catch (error) {
      // A lost response might hide an accepted turn. Keep the request ID and
      // never blindly submit a duplicate on the next launcher run.
      return { status: 'blocked', reason: `GOVERNOR_WELCOME_SUBMISSION_UNCERTAIN: ${error.message}` };
    }
    const turnId = submitted?.turn?.id;
    if (!turnId || !['inProgress', 'completed'].includes(submitted.turn.status))
      return { status: 'blocked', reason: 'GOVERNOR_WELCOME_ACCEPTANCE_UNVERIFIED' };
    const next = { ...welcome, status: 'inProgress', turnId };
    updateReceipt(registryFile, taskId, welcome, next);
    welcome = next;
  }
  if (welcome.status === 'requested')
    return { status: 'blocked', reason: 'GOVERNOR_WELCOME_SUBMISSION_UNCERTAIN' };
  if (welcome.status !== 'inProgress' || !welcome.turnId)
    throw new Error('GOVERNOR_WELCOME_RECEIPT_UNVERIFIED');
  while (now() < deadline) {
    const read = await client.request('thread/read', { threadId: taskId, includeTurns: true });
    const turn = read?.thread?.turns?.find(item => item.id === welcome.turnId);
    if (read?.thread?.id !== taskId || read.thread.projectId != null || !turn)
      throw new Error('GOVERNOR_WELCOME_TURN_UNVERIFIED');
    if (turn.status === 'completed') {
      const final = turn.items?.filter(item => item.type === 'agentMessage' &&
        item.phase === 'final_answer').at(-1)?.text?.trim();
      if (!final || final === 'PERSONAL_GOVERNOR_READY') {
        const blocked = { ...welcome, status: 'blocked', reason: 'GOVERNOR_WELCOME_REPORT_MISSING' };
        updateReceipt(registryFile, taskId, welcome, blocked);
        return { status: 'blocked', reason: blocked.reason };
      }
      updateReceipt(registryFile, taskId, welcome,
        { ...welcome, status: 'completed', completedAt: new Date().toISOString() });
      return { status: 'completed', turnId: welcome.turnId };
    }
    if (['failed', 'interrupted'].includes(turn.status)) {
      const blocked = { ...welcome, status: 'blocked', reason: `GOVERNOR_WELCOME_TURN_${turn.status.toUpperCase()}` };
      updateReceipt(registryFile, taskId, welcome, blocked);
      return { status: 'blocked', reason: blocked.reason };
    }
    await pause(2000);
  }
  return { status: 'pending', reason: 'GOVERNOR_WELCOME_TURN_STILL_RUNNING' };
}

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

export function selectGovernorHuman(registry, requestedHuman, askHuman, { chooseHuman = false } = {}) {
  const receipts = Object.values(registry.instances).filter(binding =>
    binding?.agentId === 'personal-governor' &&
    binding.scope?.kind === 'governed-human' &&
    humanIdPattern.test(binding.scope.humanProfileId ?? ''));
  const current = [...new Set(receipts.filter(binding => ['active', 'pending'].includes(binding.status))
    .map(binding => binding.scope.humanProfileId))];
  const known = [...new Set(receipts.map(binding => binding.scope.humanProfileId))];
  const human = requestedHuman || (chooseHuman ? askHuman(current.length === 1 ? current[0] :
    known.length === 1 ? known[0] : '') : current.length === 1 ? current[0] :
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
  if (read?.thread?.section?.id !== pinned[0].id || read.thread.name !== governorTitle)
    throw new Error('GOVERNOR_PRESENTATION_UNVERIFIED');
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
  await client.request('thread/name/set', { threadId: taskId, name: governorTitle });
  await pinReadyGovernor(client, taskId);
  return turnId;
}

export async function waitForGovernor(client, registryFile, taskId, { humanId,
  readRegistry = readGovernorRegistry, hostState = hostTaskState,
  now = Date.now, pause = sleep, timeoutMs = 600_000,
  onProgress = () => {}, progressEveryMs = 60_000 } = {}) {
  const deadline = now() + timeoutMs;
  let nextProgressAt = now() + progressEveryMs;
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
    if (now() >= nextProgressAt) {
      onProgress({ taskId, stage: 'activation-pending' });
      nextProgressAt = now() + progressEveryMs;
    }
    await pause(2000);
  }
  return { status: 'pending', taskId };
}

export async function ensurePersonalGovernor({ client, registryFile, humanId, humanDir,
  openTask, initialize = runInitializer, wait = waitForGovernor,
  welcome = runGovernorWelcome,
  onProgress = () => {},
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
    const followUp = binding.initialization?.welcome
      ? await welcome(client, registryFile, taskId, humanId) : null;
    return { status: 'existing', taskId,
      ...(followUp ? { welcomeStatus: followUp.status, welcomeReason: followUp.reason } : {}) };
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
  }
  // A pending task is not yet Governor-authorized, but its presentation title
  // should never be a temporary label that the desktop can cache indefinitely.
  await client.request('thread/name/set', { threadId: taskId, name: governorTitle });
  initialize(humanId, humanDir, taskId, registryFile);
  onProgress({ taskId, stage: 'activation-started' });
  const settled = await wait(client, registryFile, taskId,
    { humanId, humanDir, initialize, onProgress });
  // The queue transport owns the task until its turn completes. Opening a
  // still-pending task presents a misleading "open in another app" lock.
  if (settled.status !== 'ready') return settled;
  onProgress({ taskId, stage: 'welcome-started' });
  const followUp = await welcome(client, registryFile, taskId, humanId);
  if (followUp.status === 'completed') openTask(taskId);
  return { ...settled, welcomeStatus: followUp.status,
    ...(followUp.reason ? { welcomeReason: followUp.reason } : {}) };
}
