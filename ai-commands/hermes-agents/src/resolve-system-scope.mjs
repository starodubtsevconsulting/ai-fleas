#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseDocument } from 'yaml';

const [profileRoot, workProfileId] = process.argv.slice(2);
function fail(message) { console.error(`HERMES_SYSTEM_SCOPE_INVALID: ${message}`); process.exit(1); }
function safeId(value, label) { if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) fail(`${label} is unsafe or missing.`); return value; }
function readYaml(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (error) { fail(`cannot read ${file}: ${error.message}`); }
  const document = parseDocument(text, { prettyErrors: true, strict: true, uniqueKeys: true });
  if (document.errors.length) fail(`${file}: ${document.errors.map((error) => error.message).join('; ')}`);
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${file} must contain a mapping.`);
  return value;
}
function inside(root, target, label) { const rr = path.resolve(root), rt = path.resolve(target); if (rt !== rr && !rt.startsWith(`${rr}${path.sep}`)) fail(`${label} escapes its boundary.`); return rt; }

safeId(workProfileId, 'work-profile ID');
const selectedProfileRoot = inside(profileRoot, path.join(profileRoot, workProfileId), 'work profile');
const profile = readYaml(path.join(selectedProfileRoot, `${workProfileId}-work-profile.yml`));
if (profile.name !== workProfileId) fail('profile name does not match the selected ID.');
if (!Array.isArray(profile.agent_platforms?.available) || !profile.agent_platforms.available.includes('hermes')) fail('Hermes is not an available platform.');
const workflows = Array.isArray(profile.workflows) ? profile.workflows : [];
const watchedWorkflowGroups = workflows
  .filter((item) => item && typeof item === 'object' && !Array.isArray(item) && String(item.harness || '') === 'hermes')
  .map((item) => {
    const workflowId = path.basename(String(item.path || '')).replace(/\.workflow\.md$/, '').replace(/\.md$/, '');
    return `${workProfileId}-${safeId(workflowId, 'Hermes workflow ID')}`;
  });
if (watchedWorkflowGroups.length === 0) fail('work profile has no Hermes workflows for System to watch.');
if (new Set(watchedWorkflowGroups).size !== watchedWorkflowGroups.length) fail('work profile contains duplicate Hermes workflow IDs.');
const system = profile.system_agent;
if (!system || system.scope !== 'system' || system.cardinality !== 'one-per-platform') fail('system_agent contract is missing or invalid.');
const binding = system.platform_bindings?.hermes;
if (!binding || typeof binding !== 'object') fail('Hermes System platform binding is missing.');
const providerAlias = safeId(String(binding.provider || ''), 'System provider');
const modelAlias = safeId(String(binding.model || ''), 'System model');
const providersConfig = String(system.providers_config || '');
if (!providersConfig || path.isAbsolute(providersConfig)) fail('system_agent.providers_config must be a relative path.');
const catalog = readYaml(inside(selectedProfileRoot, path.join(selectedProfileRoot, providersConfig), 'provider catalog'));
const providerMatches = (Array.isArray(catalog.providers) ? catalog.providers : []).filter((item) => item?.id === providerAlias);
if (providerMatches.length !== 1) fail(`provider '${providerAlias}' did not resolve exactly once.`);
const provider = providerMatches[0];
if (provider.protocol !== 'openai-compatible') fail(`provider '${providerAlias}' is not OpenAI-compatible.`);
const endpointEnv = String(provider.endpoint?.environment_variable || '');
const endpoint = ((endpointEnv && process.env[endpointEnv]) || String(provider.endpoint?.url || '')).replace(/\/$/, '');
if (!/^https?:\/\/[^\s]+$/.test(endpoint)) fail(`provider '${providerAlias}' has no usable endpoint.`);
const modelMatches = (Array.isArray(provider.models) ? provider.models : []).filter((item) => item?.id === modelAlias);
if (modelMatches.length !== 1) fail(`model '${modelAlias}' did not resolve exactly once.`);
const model = modelMatches[0], hermes = model.hermes;
if (!hermes || typeof hermes !== 'object') fail(`model '${modelAlias}' has no Hermes settings.`);
const providerModel = String(model.provider_model || '');
if (!/^[A-Za-z0-9._:/+-]+$/.test(providerModel)) fail('System provider model ID is unsafe.');
const workflow = workflows.find((item) => item?.harness === 'hermes');
const projectRef = workflow?.projects?.[0]?.ref;
if (!projectRef || path.isAbsolute(projectRef)) fail('System requires the profile primary project.');
const project = readYaml(inside(selectedProfileRoot, path.join(selectedProfileRoot, projectRef), 'primary project'));
const primaryProjectPath = String(project.repo_path || '');
if (!path.isAbsolute(primaryProjectPath) || !fs.statSync(primaryProjectPath, { throwIfNoEntry: false })?.isDirectory()) fail('primary project path is unavailable.');
// System needs the profile's receipts and bindings, not a workflow's coding
// posture or project-level AGENTS.md. Use the selected profile directory as
// its isolated runtime cwd while retaining the verified project prerequisite.
const workspace = selectedProfileRoot;
const workflowsRoot = path.resolve(selectedProfileRoot, String(profile.ai_workflows_root || ''));
const rolePath = path.join(workflowsRoot, '_common/roles/system.md');
const schedulePath = path.join(workflowsRoot, String(system.schedule?.instruction || ''));
if (!fs.statSync(rolePath, { throwIfNoEntry: false })?.isFile() || !fs.statSync(schedulePath, { throwIfNoEntry: false })?.isFile()) fail('portable System role or schedule instruction is unavailable.');
const every = String(system.schedule?.every || '');
if (system.schedule?.enabled !== true || !/^[1-9][0-9]*[mhd]$/.test(every)) fail('enabled System schedule has an invalid interval.');
const title = String(binding.title || '⚙️ System');
if (!title || /[\t\r\n]/.test(title)) fail('System title is invalid.');
const values = [workProfileId, `${workProfileId}-system`, title, providerAlias, String(provider.label || providerAlias), endpoint, providerModel, String(hermes.context_window_tokens), String(hermes.compression_threshold), String(hermes.compression_target), String(hermes.protect_last_messages), workspace, rolePath, schedulePath, every, watchedWorkflowGroups.join(',')];
if (values.some((value) => !value || /[\t\r\n]/.test(value))) fail('resolved System values are empty or contain control characters.');
process.stdout.write(`${values.join('\t')}\n`);
