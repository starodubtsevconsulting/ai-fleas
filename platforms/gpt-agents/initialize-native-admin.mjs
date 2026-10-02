/** Native Admin lifecycle entry, explicitly called by the authorized controller.
 * Inputs: canonical selection, actual human-approval verifier, active plugin paths,
 * and existing native client. Output: verified Admin or a concrete blocked result.
 * NativeAdminLifecycle owns dependencies; named exports remain compatibility APIs.
 * Construction performs no IO; only explicit initialize/retry/submit/release calls act.
 * Effects: native discovery; at most one Admin create and INIT; generic binding
 * registration. No plugin deployment, daemon restart, roster, or later messages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareNativeAdmin } from './prepare-native-admin.mjs';
import { buildNativeAdminHost } from './native-admin-host.mjs';
import { initializeWorkflowAdmin, normalizeAdminScope } from './initialize-workflow-admin.mjs';
import { registerAgentInitialization, rollbackAgentInitialization } from './plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/register-agent-initialization.mjs';

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts');

// Codex send_message_to_thread is steering delivery, not lifecycle user input:
// it does not run UserPromptSubmit. The separate app-admin-initialization.mjs
// adapter uses an explicitly authorized nonce/actual-turn handshake instead.

/** Explicit recovery guard: requires exact pending identity and a terminated INIT. */
export function validateNativeAdminRetry(taskId, plan, binding, thread, canonicalize = fs.realpathSync, now = Date.now()) {
  if (binding?.status !== 'pending' || binding.agentId !== 'admin' || binding.platformAdapter !== 'codex-app' ||
      !Number.isInteger(binding.generation) || binding.generation < 1 ||
      JSON.stringify(normalizeAdminScope(binding.scope)) !== JSON.stringify(normalizeAdminScope(plan.scope)))
    throw new Error('ADMIN_RETRY_BINDING_UNVERIFIED');
  if (thread?.id !== taskId || thread.projectId !== plan.scope.projects[0].savedProjectId ||
      !plan.scope.projects.some(project => canonicalize(project.root) === canonicalize(thread.cwd)))
    throw new Error('ADMIN_RETRY_TASK_UNVERIFIED');
  const turns = thread.turns?.filter(turn => turn.id === binding.initialization?.turnId);
  if (turns?.length !== 1 || thread.turns.some(turn => turn.status === 'inProgress')) throw new Error('ADMIN_RETRY_TURN_NOT_STOPPED');
  const turn = turns[0], messages = turn.items?.filter(item=>item.type==='agentMessage') || [];
  const expires = Date.parse(binding.initialization?.expiresAt);
  const expiredPermitFailure = turn.status === 'completed' && Number.isFinite(expires) &&
    Number.isFinite(now) && expires <= now &&
    /^BLOCKED_INIT_PERMIT_EXPIRED(?::|$)/.test(messages.at(-1)?.text?.trim() || '') &&
    !messages.some(message=>message.text?.trim() === 'ADMIN_READY');
  if (!['interrupted','failed'].includes(turn.status) && !expiredPermitFailure)
    throw new Error('ADMIN_RETRY_TURN_NOT_STOPPED');
  return binding.generation + 1;
}

export function verifyInstalledBootstrap(installedScripts) {
  if (!path.isAbsolute(installedScripts || '')) throw new Error('BOOTSTRAP_PLUGIN_LOCATION_UNVERIFIED');
  for (const name of ['agent-bootstrap-hook.mjs', 'readiness-evidence.mjs']) {
    if (!fs.existsSync(path.join(installedScripts, name)) ||
        fs.readFileSync(path.join(installedScripts, name), 'utf8') !== fs.readFileSync(path.join(scripts, name), 'utf8'))
      throw new Error('BOOTSTRAP_PLUGIN_UPDATE_REQUIRED');
  }
  return true;
}

/** Read current native hook activation/trust; never changes trust or preferences. */
export async function verifyNativeBootstrapActive(client, { cwd, installedScripts }) {
  const response = await client.request('hooks/list', { cwds: [cwd] });
  const entries = response?.data?.filter(entry => entry.cwd === cwd);
  if (entries?.length !== 1 || entries[0].errors?.length || entries[0].warnings?.length) return false;
  const command = `node ${path.join(installedScripts, 'agent-bootstrap-hook.mjs')}`;
  return ['sessionStart', 'userPromptSubmit', 'stop'].every(event => {
    const hooks = entries[0].hooks?.filter(hook => hook.eventName === event &&
      hook.pluginId === 'ai-fleas-gpt@ai-fleas' && hook.command === command);
    return hooks?.length === 1 && hooks[0].enabled === true && hooks[0].trustStatus === 'trusted';
  });
}

/** Dependency-owned native lifecycle service. Construction has no host or filesystem effects. */
export class NativeAdminLifecycle {
  #client;
  #options;

  constructor(client, options = {}) {
    this.#client = client;
    this.#options = options;
  }

  /** Human-authorized retry of a stopped partial INIT; never creates another task. */
  async retry(taskId, request) {
    const client = this.#client;
    const { pluginData, installedScripts,
      verifyApproval, verifyPluginActive, io = fs, prepare = prepareNativeAdmin,
      verifyInstalled = verifyInstalledBootstrap, submit = (client, transaction, options) => this.submit(transaction, options),
      buildHost = buildNativeAdminHost, now = Date.now } = this.#options;
    try {
      const {plan} = await prepare(request, client);
      if (typeof verifyApproval !== 'function' || typeof verifyPluginActive !== 'function' ||
          await verifyApproval({approval:plan.approval,scope:plan.scope,operation:'retry-admin-only'}) !== true)
        throw new Error('HUMAN_BOOTSTRAP_APPROVAL_UNVERIFIED');
      verifyInstalled(installedScripts);
      if (await verifyPluginActive() !== true) throw new Error('BOOTSTRAP_PLUGIN_ACTIVE_UNVERIFIED');
      const registry = JSON.parse(io.readFileSync(path.join(pluginData,'agent-bindings.json'),'utf8'));
      const binding = registry.instances?.[taskId];
      const response = await client.request('thread/read',{threadId:taskId,includeTurns:true});
      const generation = validateNativeAdminRetry(taskId,plan,binding,response?.thread,value=>io.realpathSync(value),now());
      const host = buildHost(client,{pluginData,io,verifyApproval,prerequisites:async()=>true,
        selectedProjectIds:[...new Set(plan.scope.projects.map(project=>project.savedProjectId))],
        queueInitialization:()=>{throw new Error('ADMIN_RETRY_DUPLICATE_SUBMISSION_FORBIDDEN');}});
      const before = await host.catalog();
      if (before.complete !== true || !Array.isArray(before.bindings) || !Array.isArray(before.tasks))
        throw new Error('ADMIN_RETRY_CATALOG_UNVERIFIED');
      const sameScope = before.bindings.filter(item=>item.agentId==='admin' &&
        item.scope?.profileId===plan.scope.profileId && item.scope?.workflowId===plan.scope.workflowId &&
        item.scope?.logicalProjectId===plan.scope.logicalProjectId && item.scope?.runtimeScope===plan.scope.runtimeScope);
      const exactTasks = before.tasks.filter(item=>item.id===taskId);
      if (sameScope.length !== 1 || sameScope[0].taskId !== taskId || sameScope[0].status !== 'pending' ||
          sameScope[0].platformAdapter !== 'codex-app' || sameScope[0].generation !== binding.generation ||
          JSON.stringify(normalizeAdminScope(sameScope[0].scope)) !== JSON.stringify(normalizeAdminScope(plan.scope)) ||
          exactTasks.length !== 1 || exactTasks[0].status !== 'active' ||
          exactTasks[0].projectId !== plan.scope.projects[0].savedProjectId)
        throw new Error('ADMIN_RETRY_CATALOG_UNVERIFIED');
      plan.bootstrapPayload.binding.generation = generation;
      const submitted = await submit(client,{taskId,payload:plan.bootstrapPayload},{pluginData,resume:true,canonicalize:value=>io.realpathSync(value)});
      const completion = await host.wait({taskId,timeoutMs:60000});
      const catalog = await host.catalog();
      const current = catalog.bindings.filter(item=>item.taskId===taskId);
      const tasks = catalog.tasks.filter(item=>item.id===taskId);
      if (completion.status !== 'complete' || completion.turnId !== submitted.turnId || current.length !== 1 ||
          current[0].status !== 'active' || current[0].agentId !== 'admin' || current[0].platformAdapter !== 'codex-app' ||
          current[0].generation !== generation || current[0].initialization?.completedTurnId !== submitted.turnId ||
          JSON.stringify(normalizeAdminScope(current[0].scope)) !== JSON.stringify(normalizeAdminScope(plan.scope)) ||
          tasks.length !== 1 || tasks[0].status !== 'active' || tasks[0].projectId !== plan.scope.projects[0].savedProjectId)
        throw new Error('ADMIN_RETRY_READINESS_UNVERIFIED');
      const release = await this.release(taskId,plan.scope.projects[0].savedProjectId);
      return {status:'ready',taskId,turnId:submitted.turnId,readinessToken:'ADMIN_READY',...release};
    } catch(error) {return {status:'blocked',reason:error.message,taskId};}
  }

  /** Register and deliver once; preserve pending evidence when acceptance is uncertain. */
  async submit({ taskId, payload }, options = this.#options) {
    const client = this.#client;
    // Supplied options replace, not merge: orchestration forwards only its exact
    // submission whitelist, so outer resume/register/rollback cannot leak in.
    const { pluginData,
      register = registerAgentInitialization, rollback = rollbackAgentInitialization,
      resume = false, canonicalize = fs.realpathSync } = options;
    const receipt = register({ sessionId: taskId, binding: payload.binding,
      prompt: payload.prompt, dataRoot: pluginData });
    let submitted;
    try {
      if (resume) {
        const resumed = await client.request('thread/resume',{threadId:taskId});
        const thread = resumed?.thread, projects = payload.binding.scope?.projects;
        if (thread?.id !== taskId || !projects?.length || thread.projectId !== projects[0].savedProjectId ||
            !projects.some(project=>canonicalize(project.root) === canonicalize(thread.cwd)) ||
            !Array.isArray(thread.turns) || thread.turns.some(turn=>turn.status==='inProgress'))
          throw new Error('ADMIN_RETRY_RESUME_UNVERIFIED');
      }
      submitted = await client.request('turn/start', { threadId: taskId, clientUserMessageId: randomUUID(),
        input: [{ type: 'text', text: payload.prompt }] });
    } catch (error) {
      // Explicit RPC rejection proves start failed. Timeout/disconnect may have
      // accepted delivery: leave the pending receipt and never blindly resend.
      if (Number.isInteger(error.code)) rollback(receipt.rollbackReceipt);
      throw error;
    }
    const turn = submitted?.turn;
    if (typeof turn?.id !== 'string' || !turn.id || !['inProgress','completed'].includes(turn.status))
      throw new Error('ADMIN_TURN_ACCEPTANCE_UNVERIFIED');
    return { taskId, status: 'submitted', turnId: turn.id };
  }

  /** Resolve canonical scope, initialize or reuse one Admin, then release native control. */
  async initialize(request) {
    const client = this.#client;
    const { pluginData, installedScripts, verifyApproval,
      verifyPluginActive, createParams = {}, submitInitialization = (client, transaction, options) => this.submit(transaction, options) } = this.#options;
    try {
      const { plan } = await prepareNativeAdmin(request, client);
      if (typeof verifyApproval !== 'function' || typeof verifyPluginActive !== 'function')
        throw new Error('NATIVE_ADMIN_TRUSTED_CONTROLLER_REQUIRED');
      const endpoint = plan.bootstrapPayload.endpoint;
      const host = buildNativeAdminHost(client, { pluginData, verifyApproval,
        selectedProjectIds: [...new Set(plan.scope.projects.map(project => project.savedProjectId))],
        createParams: { model: endpoint.model, config: { model_reasoning_effort: endpoint.reasoning }, ...createParams },
        queueInitialization: transaction => submitInitialization(client, transaction, { pluginData }),
        prerequisites: async () => {
          verifyInstalledBootstrap(installedScripts);
          if (await verifyPluginActive() !== true) throw new Error('BOOTSTRAP_PLUGIN_ACTIVE_UNVERIFIED');
          return true;
        } });
      const result = await initializeWorkflowAdmin(plan, host);
      if (result.status !== 'ready') {
        if (!result.orphanTaskId) return result;
        // This connection created the exact task. A stopped rejected INIT must
        // release that lease too; do not abandon it merely because readiness
        // failed. A running/uncertain turn is never interrupted or resent here.
        const cleanup = await this.releaseStoppedInitialization(result.orphanTaskId,
          plan.scope.projects[0].savedProjectId);
        return { ...result, ...cleanup };
      }
      // A human-facing Admin must not remain leased by this controller's client.
      const release = await this.release(result.taskId,plan.scope.projects[0].savedProjectId);
      return { ...result, ...release };
    } catch (error) { return { status: 'blocked', reason: error.message }; }
  }

  /** Release our failed creation only after fresh exact idle/terminated evidence. */
  async releaseStoppedInitialization(taskId, expectedProjectId) {
    try {
      const response = await this.#client.request('thread/read', { threadId: taskId, includeTurns: true });
      const task = response?.thread;
      if (task?.id !== taskId || task.projectId !== expectedProjectId ||
          !['idle', 'notLoaded'].includes(task.status?.type) || !Array.isArray(task.turns) ||
          task.turns.some(turn => turn.status === 'inProgress'))
        throw new Error('ADMIN_FAILED_INIT_STILL_RUNNING_OR_UNVERIFIED');
      return await this.release(taskId, expectedProjectId);
    } catch (error) {
      return { controllerReleased: false, releaseBlocker: error.message };
    }
  }

  /** Prove this controller released its native lease, not that UI input was tested. */
  async release(taskId, expectedProjectId) {
    const client = this.#client;
    const released = await client.request('thread/unsubscribe',{threadId:taskId});
    if (!['notLoaded','notSubscribed','unsubscribed'].includes(released?.status))
      throw new Error('ADMIN_CONTROLLER_RELEASE_UNVERIFIED');
    const read = await client.request('thread/read',{threadId:taskId,includeTurns:false});
    if (read.thread?.id !== taskId || read.thread.projectId !== expectedProjectId || read.thread.status?.type !== 'notLoaded')
      throw new Error('ADMIN_CONTROLLER_RELEASE_UNVERIFIED');
    const ids=new Set(),cursors=new Set();let cursor;
    do {
      const page=await client.request('thread/loaded/list',cursor===undefined?{}:{cursor});
      if (!Array.isArray(page?.data)) throw new Error('ADMIN_CONTROLLER_RELEASE_UNVERIFIED');
      for(const id of page.data){
        if(typeof id!=='string' || !id || ids.has(id) || id===taskId) throw new Error('ADMIN_CONTROLLER_RELEASE_UNVERIFIED');
        ids.add(id);
      }
      cursor=page.nextCursor;
      if(cursor===undefined || cursor===null)break;
      if(typeof cursor!=='string' || !cursor || cursors.has(cursor))throw new Error('ADMIN_CONTROLLER_RELEASE_UNVERIFIED');
      cursors.add(cursor);
    }while(true);
    return {controllerReleased:true};
  }
}

// Compatibility functions preserve existing inputs, results and injection ports.
export async function initializeNativeAdmin(request, { client, ...options } = {}) {
  return new NativeAdminLifecycle(client, options).initialize(request);
}
export async function retryNativeAdminInitialization(taskId, request, { client, ...options } = {}) {
  return new NativeAdminLifecycle(client, options).retry(taskId, request);
}
export async function submitNativeAdminInitialization(client, transaction, {
  pluginData, register = registerAgentInitialization, rollback = rollbackAgentInitialization,
  resume = false, canonicalize = fs.realpathSync,
}) {
  return new NativeAdminLifecycle(client, {pluginData,register,rollback,resume,canonicalize}).submit(transaction);
}
export async function releaseNativeAdminControl(client, taskId, expectedProjectId) {
  return new NativeAdminLifecycle(client).release(taskId, expectedProjectId);
}
