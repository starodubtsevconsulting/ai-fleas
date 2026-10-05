#!/usr/bin/env node
/**
 * Purpose: validate and resolve a profile-owned Hermes workflow before lifecycle work.
 * Caller: hermes-agents.command.sh runs this automatically during initialization and
 * connection selection; this is an executable preflight, not an agent instruction file.
 * Usage: node resolve-workflow-scope.mjs PROFILE_ROOT PROFILE_ID WORKFLOW PROJECT CONNECTION
 * The final three selectors may be omitted where their configured defaults apply.
 * Result: tab-separated resolved scope and role/provider settings for the shell caller.
 * Effects: reads canonical configuration and environment bindings; writes no profiles
 * and creates no agents. Its shell caller owns subsequent initialization effects.
 * Platform gate: rejects an adapter mismatch or unsupported mixed-platform roster
 * before the caller can realize roles. Platform selects the app with its bundled harness;
 * model/provider configuration does not override that application selection.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseDocument } from 'yaml';
import { loadRegistry, resolveDispatchPlan, requireAdapter } from '../../../../platforms/dispatch-plan.mjs';

const [profileRoot, workProfileId, workflowSelector = '', projectSelector = '', connectionSelector = ''] = process.argv.slice(2);
function fail(message) { console.error(`HERMES_PROFILE_SCOPE_INVALID: ${message}`); process.exit(1); }
function configurationError(summary, reason, source, available, nextStep) {
  console.error(`HERMES_CONFIGURATION_ERROR: ${summary}`);
  console.error(`Reason: ${reason}`);
  console.error(`Configuration file: ${source}`);
  console.error(`Currently configured: ${available}`);
  console.error(`How to fix: ${nextStep}`);
  console.error('Model availability was not checked because the configuration could not be resolved.');
  console.error('Safety: initialization stopped before Hermes was changed; no profiles or groups were created or updated.');
  process.exit(1);
}
function safeId(value, label) { if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) fail(`${label} is unsafe or missing.`); return value; }
function readYaml(file) {
  let text;
  try { const stat = fs.statSync(file); if (!stat.isFile() || stat.size > 256 * 1024) fail(`invalid YAML source: ${file}`); text = fs.readFileSync(file, 'utf8'); }
  catch (error) { fail(`cannot read ${file}: ${error.message}`); }
  const document = parseDocument(text, { prettyErrors: true, strict: true, uniqueKeys: true });
  if (document.errors.length) fail(`${file}: ${document.errors.map((error) => error.message).join('; ')}`);
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${file} must contain a mapping.`);
  return value;
}
function inside(root, target, label) { const rr = path.resolve(root), rt = path.resolve(target); if (rt !== rr && !rt.startsWith(`${rr}${path.sep}`)) fail(`${label} escapes its profile boundary.`); return rt; }
function expandHome(value) { return value === '~' ? process.env.HOME : value.startsWith('~/') ? path.join(process.env.HOME || '', value.slice(2)) : value; }
function resolveCatalogRoot(configured, label) { if (!configured) fail(`${label} is missing.`); const r = path.isAbsolute(configured) ? path.resolve(configured) : path.resolve(selectedProfileRoot, configured); if (!fs.statSync(r, { throwIfNoEntry: false })?.isDirectory()) fail(`${label} is not a readable directory: ${r}`); return r; }

safeId(workProfileId, 'work-profile ID');
const selectedProfileRoot = inside(profileRoot, path.join(profileRoot, workProfileId), 'work profile');
const profileFile = inside(selectedProfileRoot, path.join(selectedProfileRoot, `${workProfileId}-work-profile.yml`), 'work-profile file');
const profile = readYaml(profileFile);
if (String(profile.name || '') !== workProfileId) fail(`profile name does not match ${workProfileId}.`);
const configuredAgentInstructions = String(profile.agent_instructions_path || '');
let agentInstructions = '';
if (configuredAgentInstructions) { agentInstructions = path.isAbsolute(configuredAgentInstructions) ? path.resolve(configuredAgentInstructions) : path.resolve(selectedProfileRoot, configuredAgentInstructions); if (!fs.statSync(agentInstructions, { throwIfNoEntry: false })?.isFile()) fail(`agent_instructions_path is not a readable regular file: ${agentInstructions}`); }

const workflows = Array.isArray(profile.workflows) ? profile.workflows : [];
const desiredWorkflow = workflowSelector || String(profile.default_workflow || '');
const workflowMatches = workflows.filter((item) => { if (!item || typeof item !== 'object' || Array.isArray(item)) return false; const p = String(item.path || ''); const id = path.basename(p).replace(/\.workflow\.md$/, '').replace(/\.md$/, ''); return p === desiredWorkflow || id === desiredWorkflow; });
if (workflowMatches.length !== 1) fail(`workflow '${desiredWorkflow}' did not resolve exactly once.`);
const workflow = workflowMatches[0];
const availablePlatforms = Array.isArray(profile.platforms?.available) ? profile.platforms.available : [];
if (!availablePlatforms.some(id => ['hermes-app', 'hermes-cli'].includes(id))) fail(`work profile '${workProfileId}' does not declare Hermes as an available platform.`);

const commandsRoot = resolveCatalogRoot(String(profile.ai_commands_root || ''), 'ai_commands_root');
const workflowsRoot = resolveCatalogRoot(String(profile.ai_workflows_root || ''), 'ai_workflows_root');
const platformsRoot = resolveCatalogRoot(String(profile.ai_platforms_root || ''), 'ai_platforms_root');
const workflowId = path.basename(String(workflow.path)).replace(/\.workflow\.md$/, '').replace(/\.md$/, '');
const workflowInstructions = path.join(workflowsRoot, workflowId, `${workflowId}.workflow.md`);
if (!fs.statSync(workflowInstructions, { throwIfNoEntry: false })?.isFile()) fail(`workflow contract is not a readable file: ${workflowInstructions}`);

const hermesCommandEntries = (Array.isArray(profile.commands) ? profile.commands : []).filter((entry) => entry?.id === 'hermes-agents');
if (hermesCommandEntries.length !== 1) fail('work profile must reference exactly one hermes-agents command config.');
const hermesConfigRef = String(hermesCommandEntries[0].config || '');
if (!hermesConfigRef || path.isAbsolute(hermesConfigRef)) fail('hermes-agents command config must be a relative path.');
const hermesConfigFile = inside(selectedProfileRoot, path.join(selectedProfileRoot, hermesConfigRef), 'hermes-agents command config');
const hermesConfig = readYaml(hermesConfigFile);
if (hermesConfig.schema_version !== 'hermes-agents-command-config.v1' || hermesConfig.capability !== 'hermes-agents' ||
    !['hermes-app', 'hermes-cli'].includes(hermesConfig.platform)) fail('hermes-agents command config identity or platform is invalid.');

// The workflow owns the role roster. Platform adapters realize it; they do not redefine it.
const logicalAgentsFile = path.join(workflowsRoot, workflowId, 'agents.yml');
const logicalAgents = readYaml(logicalAgentsFile);
if (logicalAgents.workflowId !== workflowId || !Array.isArray(logicalAgents.agents)) fail(`logical role configuration does not match workflow '${workflowId}'.`);
const declaredRoleDefinitions = [logicalAgents.initializer, ...logicalAgents.agents].filter(Boolean);
const configuredRoles = hermesConfig.workflow_agents?.[workflowId]?.roles;
if (configuredRoles !== undefined && (!Array.isArray(configuredRoles) || !configuredRoles.length)) fail(`workflow_agents.${workflowId}.roles must be a nonempty list.`);
const selectedRoleIds = configuredRoles === undefined ? null : configuredRoles.map((role) => safeId(String(role || ''), 'Hermes workflow role'));
if (selectedRoleIds && new Set(selectedRoleIds).size !== selectedRoleIds.length) fail(`workflow_agents.${workflowId}.roles contains duplicates.`);
const roleDefinitions = selectedRoleIds === null ? declaredRoleDefinitions : selectedRoleIds.map((roleId) => {
  const matches = declaredRoleDefinitions.filter((definition) => definition?.agentId === roleId);
  if (matches.length !== 1) fail(`Hermes workflow role '${roleId}' is not declared exactly once by workflow '${workflowId}'.`);
  return matches[0];
});
try {
  const registry = loadRegistry(path.join(platformsRoot, 'registry.yml'));
  const dispatchWorkflow = selectedRoleIds === null ? workflow : { platform: hermesConfig.platform };
  const lifecyclePlan = resolveDispatchPlan(profile, dispatchWorkflow, registry,
    { operation: 'full-roster', declaredAgentIds: roleDefinitions.map(role => role.agentId) });
  const selectedPlatform = lifecyclePlan.agents[0].platformId;
  if (!['hermes-app', 'hermes-cli'].includes(selectedPlatform)) throw new Error('LIFECYCLE_ADAPTER_MISMATCH: hermes');
  requireAdapter(lifecyclePlan, selectedPlatform);
} catch (error) { fail(error.message); }

const localAi = workflow.local_ai;
if (!localAi || typeof localAi !== 'object' || Array.isArray(localAi)) fail('workflow local_ai mapping is required.');
const providersConfig = String(localAi.providers_config || '');
if (!providersConfig || path.isAbsolute(providersConfig)) fail('local_ai.providers_config must be a relative path.');
const catalogFile = inside(selectedProfileRoot, path.join(selectedProfileRoot, providersConfig), 'provider catalog');
const catalog = readYaml(catalogFile);
const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
function resolveProvider(alias) {
  const matches = providers.filter((item) => item && typeof item === 'object' && item.id === alias);
  if (matches.length === 0) {
    const available = providers.map((item) => String(item?.id || '')).filter(Boolean).sort().join(',') || 'none';
    configurationError(
      `Cannot initialize Hermes workflow '${workflowId}' for work profile '${workProfileId}'.`,
      `The workflow requests AI provider '${alias}', but that provider is not defined in this profile's provider catalog.`,
      catalogFile,
      `providers: ${available}`,
      `Add exactly one provider with id '${alias}', including its real endpoint and model definitions, then run initialization again.`,
    );
  }
  if (matches.length > 1) fail(`work_profile=${workProfileId} workflow=${workflowId} provider=${alias}; provider is declared ${matches.length} times in ${catalogFile}; exactly one declaration is required; no profile changes were made.`);
  const provider = matches[0];
  if (provider.protocol !== 'openai-compatible') fail(`provider '${alias}' is not OpenAI-compatible.`);
  const endpointConfig = provider.endpoint || {};
  const connections = endpointConfig.connections;
  let selectedEndpoint = endpointConfig;
  if (connections !== undefined) {
    if (!connections || typeof connections !== 'object' || Array.isArray(connections)) fail(`provider '${alias}' endpoint.connections must be a mapping.`);
    const connection = connectionSelector || String(endpointConfig.default || 'local');
    safeId(connection, 'provider connection');
    selectedEndpoint = connections[connection];
    if (!selectedEndpoint || typeof selectedEndpoint !== 'object' || Array.isArray(selectedEndpoint)) {
      const available = Object.keys(connections).sort().join(',') || 'none';
      fail(`provider '${alias}' has no connection '${connection}' (available: ${available}).`);
    }
  } else if (connectionSelector && connectionSelector !== 'default' && connectionSelector !== 'local') {
    fail(`provider '${alias}' does not define named connections; cannot select '${connectionSelector}'.`);
  }
  const endpointEnv = String(selectedEndpoint.environment_variable || '');
  const endpoint = (endpointEnv && process.env[endpointEnv]) || String(selectedEndpoint.url || '');
  if (!/^https?:\/\/[^\s]+$/.test(endpoint)) fail(`provider '${alias}' has no usable endpoint.`);
  const configuredHeaders = selectedEndpoint.headers || {};
  if (!configuredHeaders || typeof configuredHeaders !== 'object' || Array.isArray(configuredHeaders)) fail(`provider '${alias}' endpoint headers must be a mapping.`);
  const headers = {}, storedHeaders = {};
  for (const [name, source] of Object.entries(configuredHeaders)) {
    if (!/^[A-Za-z0-9-]+$/.test(name)) fail(`provider '${alias}' has an unsafe HTTP header name.`);
    if (!source || typeof source !== 'object' || Array.isArray(source)) fail(`provider '${alias}' header '${name}' must use a secret environment_variable mapping.`);
    const environmentVariable = String(source.environment_variable || '');
    if (!/^[A-Z][A-Z0-9_]*$/.test(environmentVariable)) fail(`provider '${alias}' header '${name}' has an invalid secret environment variable.`);
    const value = process.env[environmentVariable];
    if (!value) fail(`provider '${alias}' connection requires secret environment variable ${environmentVariable}.`);
    if (/[\r\n]/.test(value)) fail(`provider '${alias}' header '${name}' contains unsupported control characters.`);
    headers[name] = value;
    storedHeaders[name] = `\${env:${environmentVariable}}`;
  }
  return { provider, endpoint: endpoint.replace(/\/$/, ''), headers, storedHeaders };
}

const defaultProviderAlias = safeId(String(localAi.provider || ''), 'provider alias');
const defaultProvider = resolveProvider(defaultProviderAlias);
const modelAlias = safeId(String(localAi.model || ''), 'model alias');
const modelMatches = (Array.isArray(defaultProvider.provider.models) ? defaultProvider.provider.models : []).filter((item) => item && typeof item === 'object' && item.id === modelAlias);
if (modelMatches.length !== 1) fail(`model '${modelAlias}' did not resolve exactly once.`);
function resolveModel(provider, alias) {
  const matches = (Array.isArray(provider.models) ? provider.models : []).filter((item) => item && typeof item === 'object' && item.id === alias);
  if (matches.length === 0) {
    const available = (Array.isArray(provider.models) ? provider.models : []).map((item) => String(item?.id || '')).filter(Boolean).sort().join(',') || 'none';
    configurationError(
      `Cannot initialize Hermes workflow '${workflowId}' for work profile '${workProfileId}'.`,
      `The workflow requests model alias '${alias}' from provider '${provider.id}', but that alias is not defined for the provider.`,
      catalogFile,
      `model aliases for '${provider.id}': ${available}`,
      `Add exactly one model with id '${alias}' under provider '${provider.id}', then run initialization again.`,
    );
  }
  if (matches.length > 1) fail(`work_profile=${workProfileId} workflow=${workflowId} provider=${provider.id} model=${alias}; model alias is declared ${matches.length} times in ${catalogFile}; exactly one declaration is required; no profile changes were made.`);
  const selected = matches[0];
  const providerModel = String(selected.provider_model || '');
  if (!/^[A-Za-z0-9._:/+-]+$/.test(providerModel)) fail(`model '${alias}' has an unsafe provider model ID.`);
  const hermes = selected.hermes;
  if (!hermes || typeof hermes !== 'object' || Array.isArray(hermes)) fail(`model '${alias}' has no Hermes settings.`);
  const contextWindow = String(hermes.context_window_tokens || '');
  const compressionThreshold = String(hermes.compression_threshold ?? '');
  const compressionThresholdTokens = String(hermes.compression_threshold_tokens ?? '');
  const compressionTarget = String(hermes.compression_target ?? '');
  const protectLastMessages = String(hermes.protect_last_messages || '');
  if (!/^[1-9][0-9]*$/.test(contextWindow)) fail(`model '${alias}' has an invalid Hermes context window.`);
  for (const [label, value] of [['compression threshold', compressionThreshold], ['compression target', compressionTarget]]) if (!/^(?:0(?:\.[0-9]+)?|1(?:\.0+)?)$/.test(value)) fail(`model '${alias}' has an invalid Hermes ${label}.`);
  if (compressionThresholdTokens && !/^[1-9][0-9]*$/.test(compressionThresholdTokens)) fail(`model '${alias}' has an invalid Hermes compression threshold token cap.`);
  if (compressionThresholdTokens && Number(compressionThresholdTokens) >= Number(contextWindow)) fail(`model '${alias}' Hermes compression threshold token cap must be smaller than its context window.`);
  if (!/^[1-9][0-9]*$/.test(protectLastMessages)) fail(`model '${alias}' has an invalid Hermes protected-message count.`);
  return { providerModel, contextWindow, compressionThreshold, compressionThresholdTokens, compressionTarget, protectLastMessages };
}
const defaultModel = resolveModel(defaultProvider.provider, modelAlias);
const { providerModel, contextWindow, compressionThreshold, compressionTarget, protectLastMessages } = defaultModel;

let agentProviderBindings = {};
const agentProvidersConfig = String(workflow.agent_providers_config || '');
if (agentProvidersConfig) {
  if (path.isAbsolute(agentProvidersConfig)) fail('agent_providers_config must be a relative path.');
  const bindingFile = inside(selectedProfileRoot, path.join(selectedProfileRoot, agentProvidersConfig), 'agent provider bindings');
  const bindingConfig = readYaml(bindingFile);
  if (bindingConfig.schema_version !== 'workflow-agent-providers.v1' || bindingConfig.workflow_id !== workflowId) fail(`agent provider bindings do not match workflow '${workflowId}'.`);
  if (!bindingConfig.bindings || typeof bindingConfig.bindings !== 'object' || Array.isArray(bindingConfig.bindings)) fail('agent provider bindings must contain a bindings mapping.');
  agentProviderBindings = bindingConfig.bindings;
}

const usedAgentProviderBindings = new Set();
const roleBindings = roleDefinitions.flatMap((definition) => {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) fail('workflow role configuration must be a mapping.');
  const role = safeId(String(definition.agentId || ''), 'workflow role');
  if (Object.hasOwn(definition, 'aiProvider')) fail(`workflow Agent '${role}' uses retired property 'aiProvider'; rename it to 'aiBinding' because the value selects a profile-owned provider/model binding.`);
  const declaredBinding = String(definition.aiBinding || 'profile-default');
  const bindingKey = Object.hasOwn(agentProviderBindings, role) ? role : (Object.hasOwn(agentProviderBindings, declaredBinding) ? declaredBinding : '');
  const configuredBinding = bindingKey ? agentProviderBindings[bindingKey] : undefined;
  if (bindingKey) usedAgentProviderBindings.add(bindingKey);
  if (configuredBinding !== undefined && (!configuredBinding || typeof configuredBinding !== 'object' || Array.isArray(configuredBinding))) fail(`agent provider binding for '${role}' must be a mapping.`);
  if (configuredBinding?.realization === 'bounded-route') {
    if (!['coder', 'command-runner'].includes(role)) fail(`only Coder or Command Runner may use bounded-route realization; received '${role}'.`);
    if (role === String(logicalAgents.initializer?.agentId || '')) fail('the workflow initializer cannot use bounded-route realization.');
    return [];
  }
  if (configuredBinding?.realization && configuredBinding.realization !== 'profile') fail(`unknown realization for '${role}'.`);
  const configuredProvider = String(configuredBinding?.provider || declaredBinding);
  const resolvedProvider = configuredProvider === 'profile-default' ? defaultProviderAlias : safeId(configuredProvider, `AI provider for ${role}`);
  const resolved = resolveProvider(resolvedProvider);
  const roleModelAlias = safeId(String(configuredBinding?.model || (resolvedProvider === defaultProviderAlias ? modelAlias : '')), `model alias for ${role}`);
  const roleModel = resolveModel(resolved.provider, roleModelAlias);
  const roleDefinition = String(definition.roleDefinition || '');
  const rolePath = roleDefinition ? path.resolve(path.dirname(logicalAgentsFile), roleDefinition) : '';
  if (rolePath && !rolePath.startsWith(`${path.resolve(workflowsRoot)}${path.sep}`)) fail(`role definition for '${role}' escapes the workflow catalog.`);
  if (rolePath && !fs.statSync(rolePath, { throwIfNoEntry: false })?.isFile()) fail(`role definition for '${role}' is not readable.`);
  const configuredFlow = String(definition.flow || '');
  const flowPath = configuredFlow ? path.resolve(path.dirname(logicalAgentsFile), configuredFlow) : '';
  if (flowPath && !flowPath.startsWith(`${path.resolve(workflowsRoot)}${path.sep}`)) fail(`flow for '${role}' escapes the workflow catalog.`);
  if (flowPath && !fs.statSync(flowPath, { throwIfNoEntry: false })?.isFile()) fail(`flow for '${role}' is not readable.`);
  const encode = (value) => Buffer.from(value, 'utf8').toString('base64');
  return [[role, role, resolvedProvider, encode(String(resolved.provider.label || resolvedProvider)), encode(resolved.endpoint), encode(JSON.stringify(resolved.headers)), encode(JSON.stringify(resolved.storedHeaders)), roleModel.providerModel, roleModel.contextWindow, roleModel.compressionThreshold, roleModel.compressionTarget, roleModel.protectLastMessages, encode(rolePath), encode(flowPath), roleModel.compressionThresholdTokens || '-'].join('|')];
});
if (selectedRoleIds === null) {
  for (const bindingKey of Object.keys(agentProviderBindings)) if (!usedAgentProviderBindings.has(bindingKey)) fail(`agent provider binding '${bindingKey}' is not referenced by the workflow roster.`);
}
if (roleBindings.length === 0 || new Set(roleBindings).size !== roleBindings.length) fail(`workflow '${workflowId}' role roster is empty or contains duplicates.`);

const commandIds = Array.isArray(workflow.commands) ? workflow.commands.map((value) => safeId(String(value || ''), 'command ID')) : [];
if (commandIds.length === 0) fail(`workflow '${desiredWorkflow}' has no commands.`);
function findCommandContracts(root, commandId) {
  const matches = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name === `${commandId}.command.md`) matches.push(target);
    }
  };
  visit(root);
  return matches;
}
for (const commandId of commandIds) {
  const contracts = findCommandContracts(commandsRoot, commandId);
  if (contracts.length !== 1) fail(`command '${commandId}' must resolve to exactly one readable contract under ${commandsRoot}; found ${contracts.length}.`);
}

const candidates = (Array.isArray(workflow.projects) ? workflow.projects : []).map((item) => { const ref = item && typeof item === 'object' ? String(item.ref || '') : ''; if (!ref || path.isAbsolute(ref)) fail('workflow project ref must be a relative path.'); const file = inside(selectedProfileRoot, path.join(selectedProfileRoot, ref), 'project ref'); return { file, project: readYaml(file) }; });
if (candidates.length === 0) fail(`workflow '${workflowId}' has no projects.`);
const projects = candidates.map(({ project }) => {
  const projectId = safeId(String(project.id || ''), 'project ID');
  const workspace = expandHome(String(project.repo_path || ''));
  if (!path.isAbsolute(workspace) || !fs.statSync(workspace, { throwIfNoEntry: false })?.isDirectory()) fail(`project '${projectId}' repo_path does not resolve to an existing absolute directory.`);
  return { id: projectId, label: String(project.label || projectId), repo_path: workspace };
});
if (new Set(projects.map(({ id }) => id)).size !== projects.length) fail(`workflow '${workflowId}' contains duplicate project IDs.`);
if (projectSelector && projects.filter((project) => project.id === projectSelector || project.label === projectSelector).length !== 1) fail(`project '${projectSelector}' did not resolve exactly once.`);
// The profile's ordered project set is the logical group scope on every platform.
// --project remains a compatibility validation selector; it must never narrow that set.
const primaryProject = projects[0];
const projectScope = Buffer.from(JSON.stringify(projects), 'utf8').toString('base64');

const providerLabel = String(defaultProvider.provider.label || defaultProvider.provider.id);
// Bash treats tab as whitespace and collapses an empty field during `read`, so use
// an explicit sentinel for the one optional positional field in this wire format.
const fields = [workProfileId, workflowId, primaryProject.id, defaultProviderAlias, providerLabel, defaultProvider.endpoint, Buffer.from(JSON.stringify(defaultProvider.headers), 'utf8').toString('base64'), Buffer.from(JSON.stringify(defaultProvider.storedHeaders), 'utf8').toString('base64'), providerModel, contextWindow, compressionThreshold, compressionTarget, protectLastMessages, primaryProject.repo_path, projectScope, agentInstructions || '-', commandsRoot, workflowInstructions, commandIds.join(','), roleBindings.join(',')];
if (fields.some((value) => /[\t\r\n]/.test(value))) fail('resolved values contain unsupported control characters.');
process.stdout.write(`${fields.join('\t')}\n`);
