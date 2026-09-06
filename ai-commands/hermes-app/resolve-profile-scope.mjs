#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseDocument } from 'yaml';

const [profileRoot, workProfileId, workflowSelector = '', projectSelector = ''] = process.argv.slice(2);

function fail(message) {
  console.error(`HERMES_PROFILE_SCOPE_INVALID: ${message}`);
  process.exit(1);
}

function safeId(value, label) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) fail(`${label} is unsafe or missing.`);
  return value;
}

function readYaml(file) {
  let text;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 256 * 1024) fail(`invalid YAML source: ${file}`);
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${file}: ${error.message}`);
  }
  const document = parseDocument(text, { prettyErrors: true, strict: true, uniqueKeys: true });
  if (document.errors.length) fail(`${file}: ${document.errors.map((error) => error.message).join('; ')}`);
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${file} must contain a mapping.`);
  return value;
}

function inside(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail(`${label} escapes its profile boundary.`);
  }
  return resolvedTarget;
}

function resolveCatalogRoot(configured, label) {
  if (!configured) fail(`${label} is missing.`);
  const resolved = path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(selectedProfileRoot, configured);
  if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`${label} is not a readable directory: ${resolved}`);
  }
  return resolved;
}

safeId(workProfileId, 'work-profile ID');
const selectedProfileRoot = inside(profileRoot, path.join(profileRoot, workProfileId), 'work profile');
const profileFile = inside(
  selectedProfileRoot,
  path.join(selectedProfileRoot, `${workProfileId}-work-profile.yml`),
  'work-profile file',
);
const profile = readYaml(profileFile);
if (String(profile.name || '') !== workProfileId) fail(`profile name does not match ${workProfileId}.`);
const configuredAgentInstructions = String(profile.agent_instructions_path || '');
let agentInstructions = '';
if (configuredAgentInstructions) {
  agentInstructions = path.isAbsolute(configuredAgentInstructions)
    ? path.resolve(configuredAgentInstructions)
    : path.resolve(selectedProfileRoot, configuredAgentInstructions);
  const instructionsStat = fs.statSync(agentInstructions, { throwIfNoEntry: false });
  if (!instructionsStat?.isFile()) fail(`agent_instructions_path is not a readable regular file: ${agentInstructions}`);
}

const workflows = Array.isArray(profile.workflows) ? profile.workflows : [];
const desiredWorkflow = workflowSelector || String(profile.default_workflow || '');
const workflowMatches = workflows.filter((item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const configuredPath = String(item.path || '');
  const id = path.basename(configuredPath).replace(/\.workflow\.md$/, '').replace(/\.md$/, '');
  return configuredPath === desiredWorkflow || id === desiredWorkflow;
});
if (workflowMatches.length !== 1) fail(`workflow '${desiredWorkflow}' did not resolve exactly once.`);
const workflow = workflowMatches[0];
if (workflow.harness !== 'hermes') fail(`workflow '${desiredWorkflow}' does not select the Hermes harness.`);
const commandsRoot = resolveCatalogRoot(String(profile.ai_commands_root || ''), 'ai_commands_root');
const workflowsRoot = resolveCatalogRoot(String(profile.ai_workflows_root || ''), 'ai_workflows_root');
const platformsRoot = resolveCatalogRoot(String(profile.ai_platforms_root || ''), 'ai_platforms_root');
const workflowId = path.basename(String(workflow.path)).replace(/\.workflow\.md$/, '').replace(/\.md$/, '');
const workflowInstructions = path.join(workflowsRoot, workflowId, `${workflowId}.workflow.md`);
if (!fs.statSync(workflowInstructions, { throwIfNoEntry: false })?.isFile()) {
  fail(`workflow contract is not a readable file: ${workflowInstructions}`);
}
const rosterFile = path.join(platformsRoot, 'hermes', 'workflows', workflowId, 'agents.yml');
const roster = readYaml(rosterFile);
if (roster.platform !== 'hermes' || roster.workflow !== workflowId || !Array.isArray(roster.bindings)) {
  fail(`Hermes roster does not match workflow '${workflowId}'.`);
}
const roleBindings = roster.bindings.map((binding) => {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) fail('Hermes role binding must be a mapping.');
  const role = safeId(String(binding.role || ''), 'Hermes role');
  const suffix = safeId(String(binding.profile_suffix || ''), 'Hermes profile suffix');
  return `${role}:${suffix}`;
});
if (roleBindings.length === 0 || new Set(roleBindings).size !== roleBindings.length) {
  fail(`Hermes roster for '${workflowId}' is empty or contains duplicates.`);
}
const commandIds = Array.isArray(workflow.commands)
  ? workflow.commands.map((value) => safeId(String(value || ''), 'command ID'))
  : [];
if (commandIds.length === 0) fail(`workflow '${desiredWorkflow}' has no commands.`);
for (const commandId of commandIds) {
  const contract = path.join(commandsRoot, commandId, `${commandId}.command.md`);
  if (!fs.statSync(contract, { throwIfNoEntry: false })?.isFile()) {
    fail(`command contract is not a readable file: ${contract}`);
  }
}

const localAi = workflow.local_ai;
if (!localAi || typeof localAi !== 'object' || Array.isArray(localAi)) fail('workflow local_ai mapping is required.');
const providersConfig = String(localAi.providers_config || '');
if (!providersConfig || path.isAbsolute(providersConfig)) fail('local_ai.providers_config must be a relative path.');
const providerFile = inside(selectedProfileRoot, path.join(selectedProfileRoot, providersConfig), 'provider catalog');
const catalog = readYaml(providerFile);
const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
const providerAlias = safeId(String(localAi.provider || ''), 'provider alias');
const providerMatches = providers.filter((item) => item && typeof item === 'object' && item.id === providerAlias);
if (providerMatches.length !== 1) fail(`provider '${providerAlias}' did not resolve exactly once.`);
const provider = providerMatches[0];
if (provider.protocol !== 'openai-compatible') fail(`provider '${providerAlias}' is not OpenAI-compatible.`);

const endpointEnv = String(provider.endpoint?.environment_variable || '');
const endpoint = (endpointEnv && process.env[endpointEnv]) || String(provider.endpoint?.url || '');
if (!/^https?:\/\/[^\s]+$/.test(endpoint)) fail(`provider '${providerAlias}' has no usable endpoint.`);
const modelAlias = safeId(String(localAi.model || ''), 'model alias');
const models = Array.isArray(provider.models) ? provider.models : [];
const modelMatches = models.filter((item) => item && typeof item === 'object' && item.id === modelAlias);
if (modelMatches.length !== 1) fail(`model '${modelAlias}' did not resolve exactly once.`);
const selectedModel = modelMatches[0];
const providerModel = String(selectedModel.provider_model || '');
if (!/^[A-Za-z0-9._:/+-]+$/.test(providerModel)) fail(`model '${modelAlias}' has an unsafe provider model ID.`);
const hermes = selectedModel.hermes;
if (!hermes || typeof hermes !== 'object' || Array.isArray(hermes)) fail(`model '${modelAlias}' has no Hermes settings.`);
const contextWindow = String(hermes.context_window_tokens || '');
const compressionThreshold = String(hermes.compression_threshold ?? '');
const compressionTarget = String(hermes.compression_target ?? '');
const protectLastMessages = String(hermes.protect_last_messages || '');
if (!/^[1-9][0-9]*$/.test(contextWindow)) fail(`model '${modelAlias}' has an invalid Hermes context window.`);
for (const [label, value] of [['compression threshold', compressionThreshold], ['compression target', compressionTarget]]) {
  if (!/^(?:0(?:\.[0-9]+)?|1(?:\.0+)?)$/.test(value)) fail(`model '${modelAlias}' has an invalid Hermes ${label}.`);
}
if (!/^[1-9][0-9]*$/.test(protectLastMessages)) fail(`model '${modelAlias}' has an invalid Hermes protected-message count.`);

const projectRefs = Array.isArray(workflow.projects) ? workflow.projects : [];
const candidates = projectRefs.map((item) => {
  const ref = item && typeof item === 'object' ? String(item.ref || '') : '';
  if (!ref || path.isAbsolute(ref)) fail('workflow project ref must be a relative path.');
  const file = inside(selectedProfileRoot, path.join(selectedProfileRoot, ref), 'project ref');
  return { file, project: readYaml(file) };
});
const projectMatches = projectSelector
  ? candidates.filter(({ project }) => project.id === projectSelector || project.label === projectSelector)
  : candidates;
if (projectMatches.length !== 1) {
  fail(projectSelector ? `project '${projectSelector}' did not resolve exactly once.` : 'workflow does not have exactly one project; use --project.');
}
const project = projectMatches[0].project;
const projectId = safeId(String(project.id || ''), 'project ID');
const workspace = String(project.repo_path || '');
if (!path.isAbsolute(workspace) || !fs.statSync(workspace, { throwIfNoEntry: false })?.isDirectory()) {
  fail(`project '${projectId}' repo_path is not an existing absolute directory.`);
}

const providerLabel = String(provider.label || provider.id);
const fields = [workProfileId, workflowId, projectId, providerAlias, providerLabel, endpoint.replace(/\/$/, ''), providerModel, contextWindow, compressionThreshold, compressionTarget, protectLastMessages, workspace, agentInstructions, commandsRoot, workflowInstructions, commandIds.join(','), roleBindings.join(',')];
if (fields.some((value) => /[\t\r\n]/.test(value))) fail('resolved values contain unsupported control characters.');
process.stdout.write(`${fields.join('\t')}\n`);
