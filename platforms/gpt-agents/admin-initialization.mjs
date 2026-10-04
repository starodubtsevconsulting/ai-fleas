/**
 * Purpose: build a canonical, single-Admin initialization payload.
 * Caller: authorized controllers use AdminInitializationBuilder.build or its function wrapper;
 * launcher preflight-admin reads a request JSON. Invocation is explicit, not an automatic hook.
 * Input: exact canonical file paths, selected project IDs, logical scope and human approval.
 * Output: binding, INIT prompt and scope metadata. Effects: read-only filesystem validation.
 * This does not create tasks, register bindings, queue messages or prove host readiness.
 * The controller must verify fresh host catalogs before using the existing plugin queue.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadRegistry } from '../dispatch-plan.mjs';
import { selectLifecycleRole } from './agents/select-role-initialization.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) &&
  a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));

/** Exact controller bootstrap message; no ordinary work may be appended. */
export function buildAdminInitPrompt(scope, auditTransport = 'native-child') {
  if (!['native-child', 'ephemeral-process'].includes(auditTransport)) throw new Error('INIT_AUDIT_TRANSPORT_UNSUPPORTED');
  const auditInstructions = auditTransport === 'ephemeral-process'
    ? 'FIRST read every canonical source and complete your exact identity, scope and effective model/reasoning verification. Do not call the audit while verification is planned, incomplete, or in future tense. ' +
      'ONLY AFTER those reads, call ai_fleas_init_audit exactly once with preflightSummary describing completed findings and preflight={completed:true,sourceRefs:[every exact canonical source ref from your binding],effectiveModel:the resolved model,reasoning:the resolved effort}. ' +
      'The source list is your completed-read attestation, not a claim that the controller can observe your cognition. Use the profile command override over the adapter default when resolving the model. ' +
      'This is the required bounded utility subagent audit: the controller uses your configured model and reasoning in a tool-disabled ephemeral process and verifies process exit before returning. ' +
      'Do not spawn a persistent audit child or replace this transport. If the tool is absent, fails, or returns a blocked verdict, report a concrete blocker without ADMIN_READY. Verify its findings and exact audit receipt before readiness. '
    : 'Before spawning the required read-only INIT audit, verify that your actual transport provides an owning child-close operation. ' +
      'If unavailable, report BLOCKED_INIT_AUDIT_CLEANUP_UNSUPPORTED without spawning. ' +
      'After verifying the audit result, close your exact child through that operation and verify it is notLoaded and absent from the complete loaded catalog before ADMIN_READY. ' +
      'A completed audit is not released; never use a daemon restart, deletion, or another connection unsubscribe as child cleanup. ';
  return `The human approved initialization of exactly one Admin for this scope: ${JSON.stringify(scope)}. ` +
    'This is human-designated Admin bootstrap authorization, not permission for subsequent Governor messages. ' +
    'INIT. Read and verify every canonical source and your exact host binding and task identity. ' +
    'Initialize only yourself; do not create any other role, Router or System. ' +
    auditInstructions +
    'Report ADMIN_READY only after all identity, scope and prerequisite checks pass; otherwise report a concrete blocker. ' +
    'Admin readiness is not full-roster readiness. Subsequent direction must come from the human.';
}

/** Expand only the current user's home shorthand; never evaluate shell syntax. */
export function resolveProjectRoot(value, manifestPath, homeDirectory = os.homedir()) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('PROJECT_ROOT_INVALID');
  if (value === '~' || value.startsWith('~/')) {
    if (!path.isAbsolute(homeDirectory)) throw new Error('PROJECT_HOME_INVALID');
    return path.resolve(homeDirectory, value === '~' ? '.' : value.slice(2));
  }
  if (value.startsWith('~')) throw new Error('PROJECT_HOME_SYNTAX_UNSUPPORTED');
  return path.resolve(path.dirname(manifestPath), value);
}

/** Owns canonical-source dependencies, never task or binding state. */
export class AdminInitializationBuilder {
  #io;
  #registry;
  #registryLoader;

  /** Dependency capture only: construction performs no filesystem reads. */
  constructor({ fs: io = fs, registry, registryLoader = loadRegistry } = {}) {
    this.#io = io || fs;
    this.#registry = registry;
    this.#registryLoader = registryLoader;
  }

  /** Validate one approved scope and return its payload, without initializing it. */
  build(request) {
    const io = this.#io;
    const file = value => this.#canonicalFile(value);
    const yaml = value => this.#readYaml(value);
    const profilePath = file(request.profilePath);
    const profile = yaml(profilePath);
    const profileId = profile.id || profile.name;
    if (!profileId || profileId !== request.profileId) throw new Error('PROFILE_ID_MISMATCH');
    const workflows = profile.workflows?.filter(w => w.path === `${request.workflowId}.workflow.md`) || [];
    if (workflows.length !== 1) throw new Error('WORKFLOW_SELECTION_AMBIGUOUS');
    const workflow = workflows[0];
    const workflowRoot = io.realpathSync(path.resolve(path.dirname(profilePath), profile.ai_workflows_root));
    const platformRoot = io.realpathSync(path.resolve(path.dirname(profilePath), profile.ai_platforms_root));
    const manifestPath = file(path.join(workflowRoot, request.workflowId, 'agents.yml'));
    const adapterPath = file(path.join(platformRoot, 'gpt-agents/workflows', request.workflowId, 'agents.yml'));
    const registryPath = file(path.join(platformRoot, 'registry.yml'));
    const manifest = yaml(manifestPath);
    const adapter = yaml(adapterPath);
    if (manifest.workflowId !== request.workflowId || adapter.workflow !== request.workflowId ||
        manifest.initializer?.agentId !== 'admin' ||
        manifest.agents?.some(a => a.agentId === 'admin') ||
        manifest.initializer.lifecycle !== 'persistent-control' ||
        manifest.initializer.humanFacing !== 'human-owned' ||
        manifest.initializer.readinessToken !== 'ADMIN_READY') throw new Error('ADMIN_DECLARATION_INVALID');
    const rolePath = file(path.resolve(path.dirname(manifestPath), manifest.initializer.roleDefinition));
    const adapterRole = file(path.resolve(path.dirname(adapterPath), adapter.role_contracts?.admin || ''));
    const canonicalRole = file(path.join(repository, 'ai-workflows/_common/roles/admin.md'));
    if (rolePath !== adapterRole) throw new Error('ADMIN_CONTRACT_MISMATCH');
    const commonAdminContract = rolePath === canonicalRole ? null :
      manifest.initializer.commonRoleDefinition
        ? file(path.resolve(path.dirname(manifestPath), manifest.initializer.commonRoleDefinition)) : null;
    if (rolePath !== canonicalRole && commonAdminContract !== canonicalRole)
      throw new Error('ADMIN_COMMON_CONTRACT_REQUIRED');
    const registry = this.#registry || this.#registryLoader(registryPath);
    selectLifecycleRole(profile, workflow, registry, manifest, adapter, 'admin');
    const commandDeclarations = profile.commands?.filter(command => command.id === 'gpt-agents') || [];
    if (commandDeclarations.length > 1) throw new Error('GPT_COMMAND_CONFIG_AMBIGUOUS');
    const commandConfigPath = commandDeclarations[0]?.config
      ? file(path.resolve(path.dirname(profilePath), commandDeclarations[0].config)) : null;
    const commandConfig = commandConfigPath ? yaml(commandConfigPath) : null;
    const endpoint = { ...adapter.role_endpoints.find(e => e.role === 'admin') };
    const modelOverride = commandConfig?.role_overrides?.admin;
    for (const field of ['model', 'reasoning']) {
      if (modelOverride && Object.hasOwn(modelOverride, field)) endpoint[field] = modelOverride[field];
    }
    if (typeof endpoint.model !== 'string' || typeof endpoint.reasoning !== 'string')
      throw new Error('ADMIN_MODEL_BINDING_INVALID');
    if (!Array.isArray(request.projectIds) || !request.projectIds.length ||
        new Set(request.projectIds).size !== request.projectIds.length) throw new Error('PROJECT_SUBSET_REQUIRED');
    const authorized = (workflow.projects || []).map(entry => {
      const ref = file(path.resolve(path.dirname(profilePath), entry.ref));
      const config = yaml(ref);
      return { id: config.id, root: config.repo_path, ref, declaredRef: entry.ref };
    });
    if (new Set(authorized.map(p => p.id)).size !== authorized.length) throw new Error('PROJECT_ID_AMBIGUOUS');
    const projects = request.projectIds.map(id => {
      const project = authorized.find(p => p.id === id);
      if (!project?.root) throw new Error('PROJECT_NOT_AUTHORIZED');
      const root = io.realpathSync(resolveProjectRoot(project.root, project.ref));
      if (!io.statSync(root).isDirectory()) throw new Error('PROJECT_ROOT_UNUSABLE');
      return { ...project, root };
    });
    if (typeof request.savedProjectId !== 'string' || !request.savedProjectId ||
        typeof request.logicalProjectId !== 'string' ||
        !(request.logicalProjectId === `${profileId}-${request.workflowId}` ||
          request.logicalProjectId.startsWith(`${profileId}-${request.workflowId}-`)) ||
        !Number.isInteger(request.generation) || request.generation < 1) throw new Error('EXACT_SCOPE_REQUIRED');
    const authorization = request.authorization;
    if (authorization?.humanApproved !== true || authorization.profileId !== profileId ||
        authorization.workflowId !== request.workflowId || authorization.logicalProjectId !== request.logicalProjectId ||
        !sameSet(authorization.projectIds, request.projectIds)) throw new Error('HUMAN_BOOTSTRAP_APPROVAL_REQUIRED');
    if (!Array.isArray(request.savedProjects) || request.savedProjects.length !== projects.length ||
        new Set(request.savedProjects.map(p => p.projectId)).size !== projects.length) {
      throw new Error('SAVED_PROJECT_ID_REQUIRED');
    }
    const scopedProjects = projects.map(p => {
      const savedProjectId = request.savedProjects?.find(s => s.projectId === p.id)?.savedProjectId;
      if (typeof savedProjectId !== 'string' || !savedProjectId) throw new Error('SAVED_PROJECT_ID_REQUIRED');
      return { id: p.id, savedProjectId, root: p.root };
    });
    if (scopedProjects[0].savedProjectId !== request.savedProjectId ||
        typeof request.runtimeScope !== 'string' || !request.runtimeScope) throw new Error('EXACT_SCOPE_REQUIRED');
    const scope = { kind: 'workflow', profileId, workflowId: request.workflowId,
      logicalProjectId: request.logicalProjectId, savedProjectId: request.savedProjectId,
      runtimeScope: request.runtimeScope, projects: scopedProjects };
    const sources = [
      ['portable-role', rolePath], ['portable-manifest', manifestPath], ['platform-adapter', adapterPath],
      ...(commonAdminContract ? [['common-admin-role', commonAdminContract]] : []),
      ['work-profile', profilePath], ['platform-registry', registryPath],
      ['workflow', file(path.join(workflowRoot, request.workflowId, `${request.workflowId}.workflow.md`))],
      ['lifecycle', file(path.join(workflowRoot, '_common/agents/lifecycle.md'))],
      ['self-commands', file(path.join(workflowRoot, '_common/agents/self-commands.md'))],
      ['admin-only-initializer', file(path.join(repository, 'platforms/gpt-agents/agents/admin-only-initialization.md'))],
      ['platform-contract', file(path.join(platformRoot, 'gpt-agents/platform.yml'))],
      ['rules', file(path.join(repository, 'AGENTS.md'))],
      ...(commandConfigPath ? [['gpt-command-config', commandConfigPath]] : []),
      ...projects.map(p => [`project-${p.id}`, p.ref]),
    ].map(([id, ref]) => ({ id, ref }));
    const bootstrapPayload = {
      binding: { platformAdapter: 'codex-app', agentId: 'admin', generation: request.generation, scope,
        initialization: { readinessToken: 'ADMIN_READY', sources,
          ...(request.auditTransport ? { auditTransport: request.auditTransport } : {}),
          bootstrapAuthorization: { ...authorization, verified: false, purpose: 'one-time-admin-initialization' } } },
      prompt: buildAdminInitPrompt(scope, request.auditTransport),
      endpoint,
    };
    // Replacement is a separately human-approved, exact predecessor transaction,
    // never an automatic response to missing presentation or uncertain INIT.
    if (request.replaceTaskId !== undefined || request.replaceGeneration !== undefined) {
      if (typeof request.replaceTaskId !== 'string' || !request.replaceTaskId ||
          !Number.isInteger(request.replaceGeneration) || request.replaceGeneration < 1 ||
          authorization.replaceTaskId !== request.replaceTaskId ||
          authorization.replaceGeneration !== request.replaceGeneration ||
          request.generation !== request.replaceGeneration + 1)
        throw new Error('ADMIN_REPLACEMENT_APPROVAL_REQUIRED');
      bootstrapPayload.binding.replaces = { taskId: request.replaceTaskId,
        generation: request.replaceGeneration, strategy: 'successor-first' };
    }
    const sourceMap = Object.fromEntries(sources.map(source => [source.id, source.ref]));
    const preparedSources = {
      profile: profilePath, workflow: sourceMap.workflow, manifest: manifestPath, adapter: adapterPath,
      adminContract: rolePath, selfCommands: sourceMap['self-commands'], lifecycle: sourceMap.lifecycle,
      ...(commonAdminContract ? { commonAdminContract } : {}),
      platformContract: file(path.join(platformRoot, 'gpt-agents/platform.yml')),
      registry: registryPath, initializer: sourceMap['admin-only-initializer'],
      rules: file(path.join(repository, 'AGENTS.md')),
      projectManifests: projects.map(p => p.ref),
      ...(commandConfigPath ? { commandConfig: commandConfigPath } : {}),
    };
    return { profile, workflow, registry, manifest, adapter, approval: authorization,
      sources: preparedSources, scope,
      projectDeclarations: projects.map(p => ({ id: p.id, ref: p.ref, declaredRef: p.declaredRef, root: p.root })),
      bootstrapPayload };
  }

  // Private implementation

  /** Resolve an existing canonical file; no writes or directory creation. */
  #canonicalFile(value) {
    const result = this.#io.realpathSync(value);
    if (!this.#io.statSync(result).isFile()) throw new Error('CANONICAL_FILE_REQUIRED');
    return result;
  }

  /** Read current YAML, deliberately avoiding a stale cross-request cache. */
  #readYaml(value) {
    return parse(this.#io.readFileSync(value, 'utf8'));
  }
}

/** Compatibility entry point for existing launcher/controller callers. */
export function buildAdminInitialization(request, options = {}) {
  return new AdminInitializationBuilder(options).build(request);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: admin-initialization.mjs REQUEST.json');
    process.stdout.write(`${JSON.stringify(buildAdminInitialization(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))))}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
