#!/usr/bin/env node
/**
 * Purpose: reusable human-authorized native Admin-only controller command.
 * Caller: human or an authorized Governor following the common bootstrap rules.
 * Invocation: node initialize-admin-command.mjs --request REQUEST.json (or - for stdin).
 * Input: canonical request with exact human approval attestation; output: JSON result.
 * Effects: discovers native scope/trusted installed hook, creates or reuses only
 * Admin, dispatches exact INIT/audit and verifies controller release. New stopped
 * Admin handoff uses a reversible native archive/unarchive cycle retaining history;
 * reuse does not perform the cycle. No ordinary
 * messages, plugin installation, restart, END, or financial-data writes.
 * Complete success also requires an injected owning-app project verifier. The
 * standalone CLI cannot inspect that catalog and reports a handoff blocker,
 * retaining the exact initialized task instead of creating a replacement.
 * The approval attestation is controller-followed, not cryptographic human proof.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { connectNativeAppServer } from './native-app-server.mjs';
import { prepareNativeAdmin } from './prepare-native-admin.mjs';
import { initializeNativeAdmin, verifyNativeBootstrapActive } from './initialize-native-admin.mjs';
import { normalizeAdminScope } from './initialize-workflow-admin.mjs';

/** Owns discovery/connection dependencies; construction performs no IO. */
export class AdminControllerCommand {
  #io; #env; #home; #connect; #prepare; #initialize; #verifyAppProject;
  constructor({ io = fs, env = process.env, home = os.homedir(), connect = connectNativeAppServer,
    prepare = prepareNativeAdmin, initialize = initializeNativeAdmin, verifyAppProject } = {}) {
    this.#io = io; this.#env = env; this.#home = home;
    this.#connect = connect; this.#prepare = prepare; this.#initialize = initialize;
    this.#verifyAppProject = verifyAppProject;
  }

  /** Explicit operation only; never infers approval from a title or saved project. */
  async run(request) {
    const approval = request?.authorization;
    if (approval?.humanApproved !== true || approval.profileId !== request.profileId ||
        approval.workflowId !== request.workflowId || !Array.isArray(approval.projectIds) || !approval.projectIds.length)
      return { status: 'blocked', reason: 'HUMAN_BOOTSTRAP_APPROVAL_REQUIRED' };
    let client;
    try {
      const runtimeHome = this.#env.CODEX_HOME || path.join(this.#home, '.codex');
      if (!path.isAbsolute(runtimeHome)) throw new Error('NATIVE_RUNTIME_HOME_INVALID');
      const auditExecutable = this.#executable();
      client = await this.#connect({ socketPath: path.join(runtimeHome, 'app-server-control/app-server-control.sock') });
      const selected = { ...request, projectIds: request.projectIds || approval.projectIds, auditTransport: 'ephemeral-process' };
      const { plan } = await this.#prepare(selected, client);
      const cwd = plan.scope.projects[0].root;
      const hooks = await client.request('hooks/list', { cwds: [cwd] });
      const entries = hooks?.data?.filter(entry => entry.cwd === cwd);
      if (entries?.length !== 1 || entries[0].errors?.length || entries[0].warnings?.length) throw new Error('BOOTSTRAP_PLUGIN_ACTIVE_UNVERIFIED');
      const commands = [...new Set(entries[0].hooks?.filter(hook => hook.pluginId === 'ai-fleas-gpt@ai-fleas' &&
        hook.enabled === true && hook.trustStatus === 'trusted' &&
        ['sessionStart', 'userPromptSubmit', 'stop'].includes(hook.eventName) &&
        hook.command?.endsWith('/agent-bootstrap-hook.mjs')).map(hook => hook.command) || [])];
      const suffix = '/agent-bootstrap-hook.mjs';
      if (commands.length !== 1 || !commands[0].startsWith('node /') || !commands[0].endsWith(suffix))
        throw new Error('BOOTSTRAP_PLUGIN_LOCATION_UNVERIFIED');
      const installedScripts = this.#io.realpathSync(path.dirname(commands[0].slice(5)));
      const result = await this.#initialize(selected, { client, auditExecutable, installedScripts,
        pluginData: path.join(runtimeHome, 'plugins/data/ai-fleas-gpt-ai-fleas'),
        verifyApproval: async evidence => evidence.operation === 'initialize-admin-only' &&
          isDeepStrictEqual(evidence.approval, approval) && isDeepStrictEqual(normalizeAdminScope(evidence.scope), normalizeAdminScope(plan.scope)),
        verifyPluginActive: () => verifyNativeBootstrapActive(client, { cwd, installedScripts }) });
      return await this.#verifyHandoff(result, plan.scope);
    } catch (error) { return { status: 'blocked', reason: error.message }; }
    finally { client?.close(); }
  }

  // Private implementation

  /** Native authority and app presentation use different immutable project IDs.
   * Only a trusted owning-app adapter may join them; request JSON, names, cwd,
   * and native projectId alone never prove sidebar attachment. No repair effects
   * are performed here. A failed check preserves the initialized task for repair.
   */
  async #verifyHandoff(result, scope) {
    if (result.status !== 'ready' || result.controllerReleased !== true)
      return { ...result, appProjectAttached: false, appProjectAttachmentStatus: 'not-verified' };
    try {
      if (typeof this.#verifyAppProject !== 'function') throw new Error('ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED');
      const evidence = await this.#verifyAppProject({ taskId: result.taskId, scope });
      if (!result.taskId || evidence?.taskId !== result.taskId || evidence.attached !== true ||
          evidence.nativeProjectId !== scope.projects[0].savedProjectId ||
          evidence.logicalProjectId !== scope.logicalProjectId ||
          typeof evidence.appProjectId !== 'string' || !evidence.appProjectId.trim())
        throw new Error('ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED');
      return { ...result, appProjectAttached: true, appProjectAttachmentStatus: 'verified',
        appProjectId: evidence.appProjectId };
    } catch {
      // Do not expose the native token as an overall success token on failure.
      const { token, ...retained } = result;
      return { ...retained, status: 'blocked', reason: 'ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED',
        adminInitialized: true, appProjectAttached: false, appProjectAttachmentStatus: 'blocked' };
    }
  }

  #executable() {
    const app = this.#env.AI_FLEAS_CHATGPT_APP || '/Applications/ChatGPT.app';
    const candidates = this.#env.AI_FLEAS_CODEX_BIN ? [this.#env.AI_FLEAS_CODEX_BIN] : [
      path.join(app, 'Contents/Resources/codex-cli/bin/codex'),
      path.join(app, 'Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex'),
      path.join(app, 'Contents/Resources/codex'),
      path.join(this.#home, 'Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'),
    ];
    for (const candidate of candidates) {
      if (!path.isAbsolute(candidate)) continue;
      try { this.#io.accessSync(candidate, fs.constants.X_OK); return this.#io.realpathSync(candidate); } catch {}
    }
    throw new Error('INIT_AUDIT_EXECUTABLE_UNAVAILABLE');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--request') throw new Error('Usage: initialize-admin-command.mjs --request REQUEST.json|-');
    const request = JSON.parse(fs.readFileSync(args[1] === '-' ? 0 : args[1], 'utf8'));
    const result = await new AdminControllerCommand().run(request);
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status !== 'ready' || result.controllerReleased !== true) process.exitCode = 2;
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 'blocked', reason: error.message }) + '\n'); process.exitCode = 2;
  }
}
