/**
 * Explicit controller-selected app INIT handshake, not an automatic runtime caller.
 * submitAppAdminInitialization takes an already authorized canonical Admin payload,
 * native read client, trusted app sender and owning-app live-thread reader.
 * The authorized controller invokes this helper explicitly; Markdown role rules
 * do not run it automatically. It registers one pending INIT packet,
 * sends once, then correlates an exact actor nonce acknowledgement to one new turn.
 * Native persistence is not treated as live execution status for app-owned turns.
 * Effects: generic registry pending receipt writes and one INIT message; never task
 * creation, active/readiness writes, unrelated messages or native-delivery fallback.
 * The standard Stop hook and native host still verify actual final ADMIN_READY.
 * AppAdminLifecycle owns injected dependencies without constructor IO; exported
 * functions preserve the existing call contracts for explicit submit/retry calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { normalizeAdminScope } from './initialize-workflow-admin.mjs';
import { registerAgentInitialization, rollbackAgentInitialization } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/register-agent-initialization.mjs';
import { prepareNativeAdmin } from './prepare-native-admin.mjs';
import { buildNativeAdminHost } from './native-admin-host.mjs';
import { verifyInstalledBootstrap } from './initialize-native-admin.mjs';
import { buildAdminInitPrompt } from './admin-initialization.mjs';

function fail(code) {
  throw new Error(code);
}

const scopeKey = scope => JSON.stringify(normalizeAdminScope(scope));
const liveIdle = live => ['idle', 'completed'].includes(
  typeof live?.thread?.status === 'string' ? live.thread.status : live?.thread?.status?.type,
);

/** Join immutable native identity with trusted owning-app live turn evidence. */
export function combineAppThreadEvidence(native, live, taskId) {
  if (native?.id !== taskId || live?.thread?.id !== taskId || !Array.isArray(live.turns)) {
    fail('ADMIN_APP_LIVE_EVIDENCE_UNVERIFIED');
  }
  const ids = new Set();
  for (const turn of live.turns) {
    if (typeof turn.id !== 'string' || !turn.id || ids.has(turn.id)) {
      fail('ADMIN_APP_LIVE_EVIDENCE_UNVERIFIED');
    }
    ids.add(turn.id);
  }
  return { ...native, turns: live.turns };
}

export function buildAppInitPacket(scope, nonce) {
  if (!/^[0-9a-f]{32}$/.test(nonce)) {
    fail('ADMIN_APP_PACKET_INVALID');
  }
  const prompt = buildAdminInitPrompt(scope);
  return `INIT\nAI_FLEAS_INIT_DELIVERY ${nonce}\nThis is only the human-approved Admin INIT lifecycle delivery, not permission for other work. Read the exact generic task receipt and its canonical source references, including the current common Admin/self-command contracts. Those contracts permit controller-delivered INIT, not other task instructions. Verify task identity, scope, pending generation, matching delivery nonce and unexpired permit. Before readiness, emit one commentary message exactly: AI_FLEAS_INIT_ACK ${nonce}\nThen poll the receipt read-only for at most 60 seconds until its acknowledged turnId matches your own immutable host turn ID. Do not claim readiness before this match. Complete every source, scope and required INIT audit check; report a concrete blocker on failure. Do not initialize another role or perform workflow work.\n${prompt}`;
}

/** Pure acknowledgement verifier: returns pending receipt update, never active. */
export function bindAppInitAcknowledgement({
  taskId, binding, expectedBinding, thread, previousTurnIds, nonce, now,
}) {
  if (binding?.status !== 'pending' || JSON.stringify(binding) !== JSON.stringify(expectedBinding) ||
      binding.agentId !== 'admin' || binding.platformAdapter !== 'codex-app' ||
      binding.initialization?.delivery?.nonce !== nonce || binding.initialization.delivery.state !== 'issued' ||
      !Number.isFinite(now) || !Number.isFinite(Date.parse(binding.initialization.expiresAt)) ||
      Date.parse(binding.initialization.expiresAt) <= now) {
    fail('ADMIN_APP_RECEIPT_CHANGED_OR_EXPIRED');
  }
  if (thread?.id !== taskId || thread.projectId !== binding.scope.projects[0].savedProjectId ||
      !binding.scope.projects.some(project => project.root === thread.cwd) || !Array.isArray(thread.turns)) {
    fail('ADMIN_APP_TARGET_UNVERIFIED');
  }
  const turns = thread.turns.filter(turn => !previousTurnIds.has(turn.id) &&
    turn.items?.some(item => item.type === 'agentMessage' && item.phase === 'commentary' &&
      item.text?.trim() === `AI_FLEAS_INIT_ACK ${nonce}`));
  if (turns.length === 0) {
    return null;
  }
  if (turns.length !== 1 || turns[0].items.filter(item => item.type === 'agentMessage' &&
      item.phase === 'commentary' && item.text?.trim() === `AI_FLEAS_INIT_ACK ${nonce}`).length !== 1 ||
      turns[0].status !== 'inProgress' || !turns[0].id ||
      thread.turns.some(turn => turn.status === 'inProgress' && turn.id !== turns[0].id)) {
    fail('ADMIN_APP_ACK_AMBIGUOUS');
  }
  return {
    ...binding,
    initialization: {
      ...binding.initialization,
      turnId: turns[0].id,
      startedAt: new Date(now).toISOString(),
      delivery: { ...binding.initialization.delivery, state: 'acknowledged' },
    },
  };
}

/** App-owned INIT service; constructor only retains injected dependencies, with no IO. */
export class AppAdminLifecycle {
  #client;
  #options;

  constructor(client, options = {}) {
    this.#client = client;
    this.#options = options;
  }

  /** Validate pending scope, send one INIT packet, and bind only its exact nonce ACK. */
  async submit({ taskId, payload }, options = this.#options) {
    const client = this.#client;
    // Retry passes an exact submission whitelist; do not merge unrelated outer
    // options into registration, timing, rollback or message-delivery effects.
    const {
      pluginData, sendMessage, readLiveThread, io = fs,
      now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 15000,
      register = registerAgentInitialization, rollback = rollbackAgentInitialization,
    } = options;
    if (typeof sendMessage !== 'function' || typeof readLiveThread !== 'function' ||
        !path.isAbsolute(pluginData || '') || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) {
      fail('ADMIN_APP_CONFIGURATION_INVALID');
    }
    if (payload?.prompt !== buildAdminInitPrompt(payload?.binding?.scope)) {
      fail('ADMIN_APP_NONCANONICAL_INIT');
    }
    const file = path.join(pluginData, 'agent-bindings.json');
    const readRegistry = () => JSON.parse(io.readFileSync(file, 'utf8'));
    const existing = io.existsSync(file) ? readRegistry() : { instances: {} };
    const selectedScope = payload.binding.scope;
    const matching = Object.entries(existing.instances || {}).filter(([, binding]) => binding.agentId === 'admin' &&
      binding.scope?.profileId === selectedScope.profileId && binding.scope?.workflowId === selectedScope.workflowId &&
      binding.scope?.logicalProjectId === selectedScope.logicalProjectId);
    if (matching.length !== 1 || matching[0][0] !== taskId || matching[0][1].status !== 'pending' ||
        scopeKey(matching[0][1].scope) !== scopeKey(selectedScope) ||
        payload.binding.generation !== matching[0][1].generation + 1) {
      fail('ADMIN_APP_PENDING_SCOPE_UNVERIFIED');
    }
    const before = await client.request('thread/read', { threadId: taskId, includeTurns: true });
    const liveBefore = await readLiveThread(taskId);
    if (!liveIdle(liveBefore)) {
      fail('ADMIN_APP_TARGET_UNVERIFIED');
    }
    const thread = combineAppThreadEvidence(before.thread, liveBefore, taskId);
    const projects = payload.binding.scope.projects;
    if (thread?.id !== taskId || thread.projectId !== projects[0].savedProjectId ||
        !projects.some(project => io.realpathSync(project.root) === io.realpathSync(thread.cwd)) ||
        !Array.isArray(thread.turns) || thread.turns.some(turn => turn.status === 'inProgress')) {
      fail('ADMIN_APP_TARGET_UNVERIFIED');
    }
    const previousTurnIds = new Set(thread.turns.map(turn => turn.id));
    const nonce = randomBytes(16).toString('hex');
    const prompt = buildAppInitPacket(payload.binding.scope, nonce);
    const binding = {
      ...payload.binding,
      initialization: {
        ...payload.binding.initialization,
        delivery: { transport: 'app-init-ack', nonce, state: 'issued' },
      },
    };
    const receipt = register({ sessionId: taskId, binding, prompt, dataRoot: pluginData }, {
      fs: io, now: new Date(now()),
    });
    const expectedBinding = receipt.rollbackReceipt.registeredBinding;
    try {
      await sendMessage({ taskId, prompt });
    } catch (error) {
      if (error.deliveryRejected === true) {
        rollback(receipt.rollbackReceipt, { fs: io });
      }
      throw error;
    }
    const deadline = now() + timeoutMs;
    do {
      const registry = readRegistry();
      const read = await client.request('thread/read', { threadId: taskId, includeTurns: true });
      const live = combineAppThreadEvidence(read.thread, await readLiveThread(taskId), taskId);
      const updated = bindAppInitAcknowledgement({
        taskId, binding: registry.instances?.[taskId], expectedBinding, thread: live,
        previousTurnIds, nonce, now: now(),
      });
      if (updated) {
        // Re-read immediately before replacement; preserve all unrelated entries.
        const latest = readRegistry();
        if (JSON.stringify(latest.instances?.[taskId]) !== JSON.stringify(expectedBinding)) {
          fail('ADMIN_APP_RECEIPT_CHANGED_OR_EXPIRED');
        }
        latest.instances[taskId] = updated;
        const staging = `${file}.${process.pid}.ack.tmp`;
        io.writeFileSync(staging, `${JSON.stringify(latest, null, 2)}\n`, { mode: 0o600 });
        io.renameSync(staging, file);
        return { taskId, status: 'submitted', turnId: updated.initialization.turnId };
      }
      if (now() >= deadline) {
        break;
      }
      await sleep(Math.min(250, deadline - now()));
    } while (now() <= deadline);
    fail('ADMIN_APP_ACK_UNVERIFIED');
  }

  /** Explicit human-authorized app retry of the same pending Admin, never creates.
   * It does not unsubscribe the owning app's writer or claim native lease release.
   * Owning-app idle evidence proves appIdleVerified, not actual UI typing.
   */
  async retry(taskId, request) {
    const client = this.#client;
    const { pluginData, installedScripts, sendMessage, readLiveThread,
      verifyApproval, verifyPluginActive, io = fs, prepare = prepareNativeAdmin,
      verifyInstalled = verifyInstalledBootstrap, buildHost = buildNativeAdminHost,
      submit = (client, transaction, options) => this.submit(transaction, options),
    } = this.#options;
    try {
      if (typeof sendMessage !== 'function' || typeof readLiveThread !== 'function' ||
          typeof verifyApproval !== 'function' || typeof verifyPluginActive !== 'function') {
        fail('ADMIN_APP_TRUSTED_CONTROLLER_REQUIRED');
      }
      const { plan } = await prepare(request, client, { io });
      if (await verifyApproval({ approval: plan.approval, scope: plan.scope, operation: 'retry-admin-only' }) !== true) {
        fail('HUMAN_BOOTSTRAP_APPROVAL_UNVERIFIED');
      }
      verifyInstalled(installedScripts);
      if (await verifyPluginActive() !== true) {
        fail('BOOTSTRAP_PLUGIN_ACTIVE_UNVERIFIED');
      }
      const host = buildHost(client, {
        pluginData, io, verifyApproval, prerequisites: async () => true,
        selectedProjectIds: [...new Set(plan.scope.projects.map(project => project.savedProjectId))],
        queueInitialization: () => fail('ADMIN_APP_DUPLICATE_SUBMISSION_FORBIDDEN'),
      });
      const before = await host.catalog();
      if (before.complete !== true || !Array.isArray(before.bindings) || !Array.isArray(before.tasks)) {
        fail('ADMIN_APP_RETRY_CATALOG_UNVERIFIED');
      }
      const matches = before.bindings.filter(binding => binding.agentId === 'admin' &&
        binding.scope?.profileId === plan.scope.profileId && binding.scope?.workflowId === plan.scope.workflowId &&
        binding.scope?.logicalProjectId === plan.scope.logicalProjectId &&
        binding.scope?.runtimeScope === plan.scope.runtimeScope);
      const tasks = before.tasks.filter(task => task.id === taskId);
      if (matches.length !== 1 || matches[0].taskId !== taskId || matches[0].status !== 'pending' ||
          matches[0].platformAdapter !== 'codex-app' || scopeKey(matches[0].scope) !== scopeKey(plan.scope) ||
          !Number.isInteger(matches[0].generation) || matches[0].generation < 1 ||
          tasks.length !== 1 || tasks[0].status !== 'active' ||
          tasks[0].projectId !== plan.scope.projects[0].savedProjectId) {
        fail('ADMIN_APP_RETRY_CATALOG_UNVERIFIED');
      }
      const initialLive = await readLiveThread(taskId);
      if (initialLive?.thread?.id !== taskId || !Array.isArray(initialLive.turns) ||
          initialLive.turns.some(turn => turn.status === 'inProgress') || !liveIdle(initialLive)) {
        fail('ADMIN_APP_RETRY_NOT_IDLE');
      }
      plan.bootstrapPayload.binding.generation = matches[0].generation + 1;
      const delivered = await submit(client, { taskId, payload: plan.bootstrapPayload }, {
        pluginData, sendMessage, readLiveThread, io,
      });
      const completion = await host.wait({ taskId, timeoutMs: 60000 });
      const after = await host.catalog();
      const bindings = after.bindings.filter(binding => binding.taskId === taskId);
      const actual = after.tasks.filter(task => task.id === taskId);
      if (completion.status !== 'complete' || completion.token !== 'ADMIN_READY' ||
          completion.turnId !== delivered.turnId || bindings.length !== 1 ||
          bindings[0].status !== 'active' || bindings[0].agentId !== 'admin' ||
          bindings[0].platformAdapter !== 'codex-app' ||
          bindings[0].generation !== plan.bootstrapPayload.binding.generation ||
          scopeKey(bindings[0].scope) !== scopeKey(plan.scope) ||
          bindings[0].initialization?.completedTurnId !== delivered.turnId ||
          actual.length !== 1 || actual[0].status !== 'active' ||
          actual[0].projectId !== plan.scope.projects[0].savedProjectId) {
        fail('ADMIN_APP_RETRY_READINESS_UNVERIFIED');
      }
      const live = await readLiveThread(taskId);
      if (live?.thread?.id !== taskId || !Array.isArray(live.turns) ||
          live.turns.some(turn => turn.status === 'inProgress') ||
          !live.turns.some(turn => turn.id === delivered.turnId && turn.status === 'completed') || !liveIdle(live)) {
        fail('ADMIN_APP_HUMAN_HANDOFF_UNVERIFIED');
      }
      return {
        status: 'ready', taskId, turnId: delivered.turnId, readinessToken: 'ADMIN_READY',
        transport: 'app-init-ack', appIdleVerified: true,
      };
    } catch (error) {
      return { status: 'blocked', taskId, reason: error.message };
    }
  }
}

// Compatibility entry points preserve existing option and callback contracts.
export async function submitAppAdminInitialization(client, transaction, options = {}) {
  return new AppAdminLifecycle(client, options).submit(transaction);
}
export async function retryAppAdminInitialization(taskId, request, { client, ...options } = {}) {
  return new AppAdminLifecycle(client, options).retry(taskId, request);
}
