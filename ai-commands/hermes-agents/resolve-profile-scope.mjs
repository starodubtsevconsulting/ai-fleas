#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseDocument } from 'yaml';

const [profileRoot, workProfileId, workflowSelector = '', projectSelector = ''] = process.argv.slice(2);
function fail(message) { console.error(`HERMES_PROFILE_SCOPE_INVALID: ${message}`); process.exit(1); }
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
const availablePlatforms = Array.isArray(profile.agent_platforms?.available) ? profile.agent_platforms.available : [];
if (!availablePlatforms.includes('hermes')) fail(`work profile '${workProfileId}' does not declare Hermes as an available agent platform.`);

const commandsRoot = resolveCatalogRoot(String(profile.ai_commands_root || ''), 'ai_commands_root');
const workflowsRoot = resolveCatalogRoot(String(profile.ai_workflows_root || ''), 'ai_workflows_root');
const workflowId = path.basename(String(workflow.path)).replace(/\.workflow\.md$/, '').replace(/\.md$/, '');
const workflowInstructions = path.join(workflowsRoot, workflowId, `${workflowId}.workflow.md`);
if (!fs.statSync(workflowInstructions, { throwIfNoEntry: false })?.isFile()) fail(`workflow contract is not a readable file: ${workflowInstructions}`);

// The workflow owns the role roster. Platform adapters realize it; they do not redefine it.
const logicalAgentsFile = path.join(workflowsRoot, workflowId, 'agents.yml');
const logicalAgents = readYaml(logicalAgentsFile);
if (logicalAgents.workflowId !== workflowId || !Array.isArray(logicalAgents.agents)) fail(`logical role configuration does not match workflow '${workflowId}'.`);
const roleDefinitions = [logicalAgents.initializer, ...logicalAgents.agents].filter(Boolean);

const localAi = workflow.local_ai;
if (!localAi || typeof localAi !== 'object' || Array.isArray(localAi)) fail('workflow local_ai mapping is required.');
const providersConfig = String(localAi.providers_config || '');
if (!providersConfig || path.isAbsolute(providersConfig)) fail('local_ai.providers_config must be a relative path.');
const catalog = readYaml(inside(selectedProfileRoot, path.join(selectedProfileRoot, providersConfig), 'provider catalog'));
const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
function resolveProvider(alias) {
  const matches = providers.filter((item) => item && typeof item === 'object' && item.id === alias);
  if (matches.length !== 1) fail(`provider '${alias}' did not resolve exactly once.`);
  const provider = matches[0];
  if (provider.protocol !== 'openai-compatible') fail(`provider '${alias}' is not OpenAI-compatible.`);
  const endpointEnv = String(provider.endpoint?.environment_variable || '');
  const endpoint = (endpointEnv && process.env[endpointEnv]) || String(provider.endpoint?.url || '');
  if (!/^https?:\/\/[^\s]+$/.test(endpoint)) fail(`provider '${alias}' has no usable endpoint.`);
  return { provider, endpoint: endpoint.replace(/\/$/, '') };
}

const defaultProviderAlias = safeId(String(localAi.provider || ''), 'provider alias');
const defaultProvider = resolveProvider(defaultProviderAlias);
const modelAlias = safeId(String(localAi.model || ''), 'model alias');
const modelMatches = (Array.isArray(defaultProvider.provider.models) ? defaultProvider.provider.models : []).filter((item) => item && typeof item === 'object' && item.id === modelAlias);
if (modelMatches.length !== 1) fail(`model '${modelAlias}' did not resolve exactly once.`);
function resolveModel(provider, alias) {
  const matches = (Array.isArray(provider.models) ? provider.models : []).filter((item) => item && typeof item === 'object' && item.id === alias);
  if (matches.length !== 1) fail(`model '${alias}' did not resolve exactly once for provider '${provider.id}'.`);
  const selected = matches[0];
  const providerModel = String(selected.provider_model || '');
  if (!/^[A-Za-z0-9._:/+-]+$/.test(providerModel)) fail(`model '${alias}' has an unsafe provider model ID.`);
  const hermes = selected.hermes;
  if (!hermes || typeof hermes !== 'object' || Array.isArray(hermes)) fail(`model '${alias}' has no Hermes settings.`);
  const contextWindow = String(hermes.context_window_tokens || '');
  const compressionThreshold = String(hermes.compression_threshold ?? '');
  const compressionTarget = String(hermes.compression_target ?? '');
  const protectLastMessages = String(hermes.protect_last_messages || '');
  if (!/^[1-9][0-9]*$/.test(contextWindow)) fail(`model '${alias}' has an invalid Hermes context window.`);
  for (const [label, value] of [['compression threshold', compressionThreshold], ['compression target', compressionTarget]]) if (!/^(?:0(?:\.[0-9]+)?|1(?:\.0+)?)$/.test(value)) fail(`model '${alias}' has an invalid Hermes ${label}.`);
  if (!/^[1-9][0-9]*$/.test(protectLastMessages)) fail(`model '${alias}' has an invalid Hermes protected-message count.`);
  return { providerModel, contextWindow, compressionThreshold, compressionTarget, protectLastMessages };
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
const roleBindings = roleDefinitions.map((definition) => {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) fail('workflow role configuration must be a mapping.');
  const role = safeId(String(definition.agentId || ''), 'workflow role');
  const declaredBinding = String(definition.aiProvider || 'profile-default');
  const bindingKey = Object.hasOwn(agentProviderBindings, role) ? role : (Object.hasOwn(agentProviderBindings, declaredBinding) ? declaredBinding : '');
  const configuredBinding = bindingKey ? agentProviderBindings[bindingKey] : undefined;
  if (bindingKey) usedAgentProviderBindings.add(bindingKey);
  if (configuredBinding !== undefined && (!configuredBinding || typeof configuredBinding !== 'object' || Array.isArray(configuredBinding))) fail(`agent provider binding for '${role}' must be a mapping.`);
  const configuredProvider = String(configuredBinding?.provider || declaredBinding);
  const aiProvider = configuredProvider === 'profile-default' ? defaultProviderAlias : safeId(configuredProvider, `AI provider for ${role}`);
  const resolved = resolveProvider(aiProvider);
  const roleModelAlias = safeId(String(configuredBinding?.model || (aiProvider === defaultProviderAlias ? modelAlias : '')), `model alias for ${role}`);
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
  return [role, role, aiProvider, encode(String(resolved.provider.label || aiProvider)), encode(resolved.endpoint), roleModel.providerModel, roleModel.contextWindow, roleModel.compressionThreshold, roleModel.compressionTarget, roleModel.protectLastMessages, encode(rolePath), encode(flowPath)].join('|');
});
for (const bindingKey of Object.keys(agentProviderBindings)) if (!usedAgentProviderBindings.has(bindingKey)) fail(`agent provider binding '${bindingKey}' is not referenced by the workflow roster.`);
if (roleBindings.length === 0 || new Set(roleBindings).size !== roleBindings.length) fail(`workflow '${workflowId}' role roster is empty or contains duplicates.`);

const commandIds = Array.isArray(workflow.commands) ? workflow.commands.map((value) => safeId(String(value || ''), 'command ID')) : [];
if (commandIds.length === 0) fail(`workflow '${desiredWorkflow}' has no commands.`);
for (const commandId of commandIds) { const contract = path.join(commandsRoot, commandId, `${commandId}.command.md`); if (!fs.statSync(contract, { throwIfNoEntry: false })?.isFile()) fail(`command contract is not a readable file: ${contract}`); }

const candidates = (Array.isArray(workflow.projects) ? workflow.projects : []).map((item) => { const ref = item && typeof item === 'object' ? String(item.ref || '') : ''; if (!ref || path.isAbsolute(ref)) fail('workflow project ref must be a relative path.'); const file = inside(selectedProfileRoot, path.join(selectedProfileRoot, ref), 'project ref'); return { file, project: readYaml(file) }; });
if (candidates.length === 0) fail(`workflow '${workflowId}' has no projects.`);
const projects = candidates.map(({ project }) => {
  const projectId = safeId(String(project.id || ''), 'project ID');
  const workspace = String(project.repo_path || '');
  if (!path.isAbsolute(workspace) || !fs.statSync(workspace, { throwIfNoEntry: false })?.isDirectory()) fail(`project '${projectId}' repo_path is not an existing absolute directory.`);
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
const fields = [workProfileId, workflowId, primaryProject.id, defaultProviderAlias, providerLabel, defaultProvider.endpoint, providerModel, contextWindow, compressionThreshold, compressionTarget, protectLastMessages, primaryProject.repo_path, projectScope, agentInstructions || '-', commandsRoot, workflowInstructions, commandIds.join(','), roleBindings.join(',')];
if (fields.some((value) => /[\t\r\n]/.test(value))) fail('resolved values contain unsupported control characters.');
process.stdout.write(`${fields.join('\t')}\n`);
