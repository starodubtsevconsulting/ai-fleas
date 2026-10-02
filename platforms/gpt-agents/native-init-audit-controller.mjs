/**
 * Purpose: authenticate one Admin INIT audit and record verified ephemeral exit.
 * Caller: NativeAdminLifecycle installs this exact dynamic tool before bootstrap.
 * Inputs: canonical prepared plan, owned task/turn IDs and bounded preflight text.
 * Output: tool findings and an exact audit receipt in the existing binding registry.
 * Effects: runs one inference-only worker and records its result after process exit.
 * No new role registry, platform change, ordinary Admin messages or financial IO.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { normalizeAdminScope } from './initialize-workflow-admin.mjs';

export const initAuditTool = {
  type: 'function', name: 'ai_fleas_init_audit',
  description: 'Run the mandatory bounded read-only INIT audit through the bootstrap controller. Only the exact current INIT is authorized; the worker exits before results return.',
  inputSchema: { type: 'object', additionalProperties: false,
    properties: { preflightSummary: { type: 'string', minLength: 1, maxLength: 12000 } }, required: ['preflightSummary'] },
};
const fail = reason => { throw new Error(reason); };

/** Owns exact bootstrap-call authorization and in-flight worker evidence. */
export class NativeInitAuditController {
  #client; #worker; #plan; #io; #registryPath; #tasks = new Map(); #calls = new Set();
  constructor(client, { worker, plan, pluginData, io = fs }) {
    if (typeof client?.request !== 'function' || typeof worker?.run !== 'function' ||
        !path.isAbsolute(pluginData || '') || plan?.bootstrapPayload?.binding?.initialization?.auditTransport !== 'ephemeral-process')
      fail('INIT_AUDIT_CONTROLLER_CONFIGURATION_INVALID');
    this.#client = client; this.#worker = worker; this.#plan = plan; this.#io = io;
    this.#registryPath = path.join(pluginData, 'agent-bindings.json');
  }

  /** Called only by the verified native creation/submission route, before INIT. */
  bindTask(taskId, binding) {
    if (!taskId || this.#tasks.has(taskId) || binding.agentId !== 'admin' ||
        binding.generation !== this.#plan.bootstrapPayload.binding.generation ||
        !isDeepStrictEqual(normalizeAdminScope(binding.scope), normalizeAdminScope(this.#plan.scope)))
      fail('INIT_AUDIT_TASK_AUTHORIZATION_INVALID');
    this.#tasks.set(taskId, { generation: binding.generation });
  }

  #readBinding(taskId, turnId) {
    const registry = JSON.parse(this.#io.readFileSync(this.#registryPath, 'utf8'));
    const binding = registry.instances?.[taskId], authorized = this.#tasks.get(taskId);
    if (!authorized || binding?.status !== 'pending' || binding.agentId !== 'admin' ||
        binding.platformAdapter !== 'codex-app' || binding.generation !== authorized.generation ||
        binding.initialization?.auditTransport !== 'ephemeral-process' ||
        binding.initialization.turnId !== turnId || !binding.initialization.nonce ||
        !Number.isFinite(Date.parse(binding.initialization.expiresAt)) ||
        Date.parse(binding.initialization.expiresAt) <= Date.now() ||
        !isDeepStrictEqual(binding.initialization.sources, this.#plan.bootstrapPayload.binding.initialization.sources) ||
        !isDeepStrictEqual(normalizeAdminScope(binding.scope), normalizeAdminScope(this.#plan.scope)))
      fail('INIT_AUDIT_EXACT_BINDING_UNVERIFIED');
    return { registry, binding };
  }

  /** Actual native tool requests only; no arbitrary controller/model callback. */
  async handle(request) {
    const params = request.params;
    if (request.method !== 'item/tool/call' || params?.tool !== initAuditTool.name ||
        params.namespace != null || !params.threadId || !params.turnId || !params.callId)
      fail('INIT_AUDIT_TOOL_REQUEST_INVALID');
    const args = typeof params.arguments === 'string' ? JSON.parse(params.arguments) : params.arguments;
    if (!args || Object.keys(args).length !== 1 || !Object.hasOwn(args, 'preflightSummary') || typeof args.preflightSummary !== 'string' ||
        !args.preflightSummary.trim() || args.preflightSummary.length > 12000)
      fail('INIT_AUDIT_ARGUMENTS_INVALID');
    const { binding } = this.#readBinding(params.threadId, params.turnId);
    if (this.#calls.has(params.threadId) || binding.initialization.audit) fail('INIT_AUDIT_DUPLICATE_FORBIDDEN');
    this.#calls.add(params.threadId); // reserve before any await; uncertainty never authorizes resend
    const parent = (await this.#client.request('thread/read', { threadId: params.threadId, includeTurns: true }))?.thread;
    if (parent?.id !== params.threadId || parent.projectId !== this.#plan.scope.projects[0].savedProjectId ||
        parent.cwd !== this.#plan.scope.projects[0].root ||
        parent.turns?.filter(turn => turn.id === params.turnId && turn.status === 'inProgress').length !== 1)
      fail('INIT_AUDIT_PARENT_TURN_UNVERIFIED');
    const contracts = [this.#plan.sources.adminContract, this.#plan.sources.selfCommands, this.#plan.sources.lifecycle,
      path.resolve(path.dirname(this.#plan.sources.adminContract), '../agents/utility-subagents.md')]
      .map(ref => ({ ref, text: this.#io.readFileSync(ref, 'utf8') }));
    const endpoint = this.#plan.bootstrapPayload.endpoint;
    const result = await this.#worker.run({ cwd: this.#plan.scope.projects[0].root,
      model: endpoint.model, reasoning: endpoint.reasoning,
      evidence: { scope: this.#plan.scope, selectedPlatform: 'codex-app', effectiveModel: endpoint.model,
        reasoning: endpoint.reasoning, adminDeclaration: this.#plan.manifest.initializer,
        bootstrapAuthorization: this.#plan.approval, canonicalSourceReferences: this.#plan.bootstrapPayload.binding.initialization.sources,
        contracts, parentPreflightSummary: args.preflightSummary,
        controllerVerifiedHostEvidence: {
          task: { id: parent.id, savedProjectId: parent.projectId, cwd: parent.cwd },
          initializationTurn: { id: params.turnId, status: 'inProgress' },
          exactBinding: { taskId: params.threadId, agentId: binding.agentId, platformAdapter: binding.platformAdapter,
            status: binding.status, generation: binding.generation, scope: binding.scope },
          oneUsePermit: { noncePresent: true, expiresAt: binding.initialization.expiresAt,
            consumedByTurnId: binding.initialization.turnId, startedAt: binding.initialization.startedAt,
            auditCallReserved: true, previousAuditAbsent: true },
          canonicalPreflight: 'Prepared scope verified against the complete native saved-project attached roots; exact parent read matched the pending binding and current turn.' },
        auditTransport: 'controller-owned ephemeral inference process; no tools, files, nested agents or role authority' } });
    if (result.workerClosed !== true || result.exitCode !== 0 || !result.workerThreadId ||
        !['pass', 'blocked'].includes(result.result?.verdict)) fail('INIT_AUDIT_WORKER_RELEASE_UNVERIFIED');
    const fresh = this.#readBinding(params.threadId, params.turnId);
    if (fresh.binding.initialization.nonce !== binding.initialization.nonce || fresh.binding.initialization.audit)
      fail('INIT_AUDIT_BINDING_CHANGED');
    const receipt = { transport: 'ephemeral-process', callId: params.callId, turnId: params.turnId,
      generation: fresh.binding.generation, workerThreadId: result.workerThreadId,
      workerClosed: true, exitCode: 0, verdict: result.result.verdict, completedAt: new Date().toISOString() };
    fresh.binding.initialization.audit = receipt;
    const temporary = `${this.#registryPath}.${process.pid}.tmp`;
    this.#io.writeFileSync(temporary, JSON.stringify(fresh.registry, null, 2) + '\n', { mode: 0o600 });
    this.#io.renameSync(temporary, this.#registryPath);
    return { success: true, contentItems: [{ type: 'inputText', text: JSON.stringify({
      audit: receipt, result: result.result,
      instruction: 'Verify these findings before readiness. This utility worker has exited; do not spawn a persistent replacement or claim full-roster readiness.' }) }] };
  }
}
