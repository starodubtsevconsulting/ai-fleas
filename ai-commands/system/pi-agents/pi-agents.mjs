#!/usr/bin/env node
// Deterministic configuration preparation; never starts Pi or asserts agent readiness.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const fail = message => { throw new Error(message); };
const mapping = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
};
const id = (value, label) => {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) fail(`${label} is missing or unsafe`);
  return value;
};
function inside(root, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) fail(`${label} must be relative`);
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) fail(`${label} escapes its root`);
  // Reject symlinks in profile sources/output paths, including existing parent directories.
  let current = root;
  for (const part of path.relative(root, target).split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`${label} contains a symlink`);
  }
  return target;
}
function yaml(file) {
  const document = parseDocument(fs.readFileSync(file, 'utf8'), { uniqueKeys: true, strict: true });
  if (document.errors.length) fail(`${file}: ${document.errors.map(error => error.message).join('; ')}`);
  return mapping(document.toJS({ maxAliasCount: 50 }), file);
}
function one(items, predicate, label) {
  const matches = (Array.isArray(items) ? items : []).filter(predicate);
  if (matches.length !== 1) fail(`${label} must resolve exactly once`);
  return matches[0];
}
function positive(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}
function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log('Usage: pi-agents.command.sh <check|prepare> --work-profile ID --workflow dev --project ID [--profile-root PATH]');
    return;
  }
  const operation = args.shift();
  if (!['check', 'prepare'].includes(operation)) fail('supported operations: check, prepare');
  const options = {};
  while (args.length) {
    const key = args.shift();
    if (!['--work-profile', '--workflow', '--project', '--profile-root'].includes(key) || options[key] || !args.length) fail(`invalid or duplicate option: ${key}`);
    options[key] = args.shift();
  }
  const profileId = id(options['--work-profile'], 'work profile');
  if (options['--workflow'] !== 'dev') fail('only --workflow dev is supported');
  const projectId = id(options['--project'], 'project');
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const profileRoot = path.resolve(options['--profile-root'] || path.join(repository, 'ai-profile'));
  const profileDir = inside(profileRoot, profileId, 'profile');
  const profile = yaml(inside(profileDir, `${profileId}-work-profile.yml`, 'profile file'));
  if (profile.name !== profileId) fail('profile name does not match selector');
  if (!profile.platforms?.available?.includes('pi-cli')) fail('profile must declare pi-cli as available');
  const commandConfig = commandId => {
    const entry = one(profile.commands, item => item?.id === commandId, `${commandId} registration`);
    return yaml(inside(profileDir, entry.config, `${commandId} config`));
  };
  const config = commandConfig('pi-agents');
  if (config.schema_version !== 'pi-agents-command-config.v1' || config.capability !== 'pi-agents' || config.registered_command !== 'pi-agents' || config.platform !== 'pi-cli' || config.workflow !== 'dev' || config.role !== 'coder') fail('invalid pi-agents config identity');
  const workflow = one(profile.workflows, item => item?.path === 'dev.workflow.md', 'Dev workflow');
  const projects = (workflow.projects || []).map(entry => entry.ref ? yaml(inside(profileDir, entry.ref, 'project config')) : entry);
  const project = one(projects, item => item?.id === projectId, 'authorized Dev project');
  const projectPath = String(project.repo_path || '').replace(/^~(?=\/)/, os.homedir());
  if (!path.isAbsolute(projectPath) || !fs.statSync(projectPath, { throwIfNoEntry: false })?.isDirectory()) fail('project repo_path must be an existing absolute directory');
  const providers = yaml(inside(profileDir, config.providers_config, 'provider catalog'));
  if (providers.schema_version !== 'local-ai-providers.v1') fail('invalid provider catalog identity');
  const resolveModel = (binding, label) => {
    mapping(binding, `${label} model binding`);
    const providerId = id(binding.provider, 'provider');
    const provider = one(providers.providers, item => item?.id === providerId, `${label} provider`);
    if (provider.protocol !== 'openai-compatible') fail('provider must be OpenAI-compatible');
    const model = one(provider.models, item => item?.id === binding.model, `${label} model`);
    if (typeof model.provider_model !== 'string' || !/^[A-Za-z0-9._:/+-]+$/.test(model.provider_model)) fail('invalid provider model ID');
    const connection = id(binding.connection || provider.endpoint?.default || 'local', 'connection');
    const endpoint = provider.endpoint?.connections ? provider.endpoint.connections[connection] : provider.endpoint;
    mapping(endpoint, 'provider connection');
    const baseUrl = (endpoint.environment_variable && process.env[endpoint.environment_variable]) || endpoint.url;
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('endpoint must use HTTP(S) without embedded credentials');
    const headers = {};
    for (const [name, source] of Object.entries(endpoint.headers || {})) {
      if (!/^[A-Za-z0-9-]+$/.test(name) || !/^[A-Z][A-Z0-9_]*$/.test(source?.environment_variable || '')) fail('headers must use named environment variables');
      headers[name] = `\${${source.environment_variable}}`;
    }
    const contextWindow = positive(binding.context_window_tokens, `${label} context window`);
    return { providerId, modelId: model.provider_model, connection, contextWindow, definition: { baseUrl: baseUrl.replace(/\/$/, ''), api: 'openai-completions', apiKey: 'local', ...(Object.keys(headers).length ? { headers } : {}), models: [{ id: model.provider_model, contextWindow }] } };
  };
  const mainModel = resolveModel(config.models?.main, 'main');
  const auxiliaryModel = resolveModel(config.models?.auxiliary, 'auxiliary');
  const models = { providers: {} };
  for (const resolved of [mainModel, auxiliaryModel]) {
    const existing = models.providers[resolved.providerId];
    if (existing && JSON.stringify({ ...existing, models: [] }) !== JSON.stringify({ ...resolved.definition, models: [] })) fail('one provider cannot use two different connections');
    if (!existing) models.providers[resolved.providerId] = resolved.definition;
    else if (!existing.models.some(model => model.id === resolved.modelId)) existing.models.push(...resolved.definition.models);
  }
  const settings = { defaultProvider: mainModel.providerId, defaultModel: mainModel.modelId, defaultThinkingLevel: 'low', extensions: ['./auxiliary-compaction.ts'] };
  const extension = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'auxiliary-compaction.ts'), 'utf8');
  const auxiliary = { provider: auxiliaryModel.providerId, model: auxiliaryModel.modelId };
  const workflowsRoot = path.resolve(profileDir, profile.ai_workflows_root || fail('ai_workflows_root is required'));
  const rosterFile = path.join(workflowsRoot, 'dev/agents.yml');
  const roster = yaml(rosterFile);
  if (roster.workflowId !== 'dev') fail('invalid Dev roster identity');
  const role = one(roster.agents, item => item?.agentId === 'coder', 'Dev Coder role');
  const rolePath = path.resolve(path.dirname(rosterFile), role.roleDefinition || fail('Coder roleDefinition is required'));
  if (!rolePath.startsWith(`${workflowsRoot}${path.sep}`)) fail('Coder role escapes workflow catalog');
  const roleText = fs.readFileSync(rolePath, 'utf8');
  const selfCommands = path.join(workflowsRoot, '_common/agents/self-commands.md');
  if (!fs.statSync(selfCommands).isFile()) fail('self commands contract is missing');
  if (!String(config.agent_directory || '').startsWith('.local/pi-agents/')) fail('agent_directory must be under .local/pi-agents');
  const agentDir = inside(profileDir, `${config.agent_directory}/${projectId}/coder`, 'Pi agent directory');
  for (const name of ['models.json', 'settings.json', 'AGENTS.md', 'auxiliary-compaction.ts', 'auxiliary-model.json']) {
    const target = inside(agentDir, name, 'generated file');
    const stat = fs.lstatSync(target, { throwIfNoEntry: false });
    if (stat && !stat.isFile()) fail(`generated ${name} is not a regular file`);
  }
  const settingsPath = inside(agentDir, 'settings.json', 'generated settings');
  if (fs.existsSync(settingsPath)) {
    let existingSettings;
    try { existingSettings = mapping(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), 'existing Pi settings'); }
    catch { fail('existing Pi settings.json must contain a valid JSON object'); }
    if (existingSettings.extensions !== undefined && (!Array.isArray(existingSettings.extensions) || existingSettings.extensions.some(entry => typeof entry !== 'string'))) fail('existing Pi settings extensions must be an array of strings');
    const extensions = (existingSettings.extensions || []).filter(entry => entry !== './auxiliary-compaction.ts');
    Object.assign(settings, existingSettings, {
      defaultProvider: mainModel.providerId,
      defaultModel: mainModel.modelId,
      defaultThinkingLevel: 'low',
      extensions: [...extensions, './auxiliary-compaction.ts'],
    });
  }
  const instructions = `# Prepared Pi Coder configuration\n\nProfile: ${profileId}\nWorkflow: dev\nRole: coder\nProject: ${projectId}\nAuthorized repository: ${projectPath}\n\nThis directory prepares model settings and role instructions only. It does not establish a managed workflow identity or readiness. Follow repository AGENTS.md and the canonical role and self-command contracts before any work. Do not claim readiness from these files.\n\nCanonical role: ${rolePath}\nSelf commands: ${selfCommands}\n\n${roleText}`;
  if (operation === 'prepare') {
    fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
    for (const [name, value] of [['models.json', JSON.stringify(models, null, 2) + '\n'], ['settings.json', JSON.stringify(settings, null, 2) + '\n'], ['AGENTS.md', instructions], ['auxiliary-compaction.ts', extension], ['auxiliary-model.json', JSON.stringify(auxiliary, null, 2) + '\n']]) {
      const target = inside(agentDir, name, 'generated file');
      fs.writeFileSync(target, value, { mode: 0o600 });
    }
  }
  // No secrets or endpoint URLs are printed.
  console.log(JSON.stringify({ operation, profile: profileId, workflow: 'dev', role: 'coder', project: projectId, provider: mainModel.providerId, model: mainModel.modelId, connection: mainModel.connection, contextWindow: mainModel.contextWindow, auxiliary, agentDirectory: agentDir, workingDirectory: projectPath, status: operation === 'check' ? 'configuration-valid' : 'configuration-prepared' }, null, 2));
}
try { main(); } catch (error) { console.error(`PI_AGENTS_CONFIGURATION_ERROR: ${error.message}`); process.exitCode = 1; }
