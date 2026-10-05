#!/usr/bin/env node
/**
 * Purpose: validate and configure profile-owned Hermes auxiliary task models after workflow realization.
 * Caller: hermes-agents.command.sh invokes this for initialize/reconcile using PROFILE_DIRECTORY GROUP_ID WORKFLOW.
 * Inputs/output: reads the selected profile, provider catalog, model strategy/expertise, and auxiliary_models config;
 * reports preflight/configuration status. Effects: preflight is read-only; configure edits only realized Hermes config files.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseDocument } from 'yaml';

const [profileDirectoryArg, groupId, workflowId, option] = process.argv.slice(2);
const preflightOnly = option === '--preflight-only';
function fail(message) { throw new Error(message); }
function read(file) {
  const document = parseDocument(fs.readFileSync(file, 'utf8'), { uniqueKeys: true, strict: true });
  if (document.errors.length) fail(`Invalid YAML: ${file}`);
  return { document, value: document.toJS() };
}
function inside(root, target, label) {
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} is outside its canonical catalog`);
  return target;
}
function safeId(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) fail(`Invalid ${label}`);
  return value;
}
function validStrings(value) { return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim()); }

try {
  if (!profileDirectoryArg || !groupId || !workflowId || (option && !preflightOnly) || !/^[a-z0-9][a-z0-9-]*$/.test(groupId)) {
    fail('Usage: configure-auxiliary-models.mjs PROFILE_DIRECTORY GROUP_ID WORKFLOW [--preflight-only]');
  }
  safeId(workflowId, 'workflow ID');
  const profileDirectory = fs.realpathSync(profileDirectoryArg);
  const profileId = path.basename(profileDirectory);
  const commandFile = path.join(profileDirectory, 'commands-config/hermes-agents/config.yml');
  const command = read(commandFile).value;
  const binding = command.auxiliary_models?.[workflowId];
  if (!binding) process.exit(0);
  const providerId = safeId(binding.provider, 'auxiliary provider');
  const modelAlias = safeId(binding.model, 'auxiliary model alias');
  const connectionId = safeId(binding.connection || 'local', 'auxiliary connection');
  if (!validStrings(binding.callers) || new Set(binding.callers).size !== binding.callers.length) fail('Auxiliary model callers must be a nonempty unique role list');
  const selectedRoles = command.workflow_agents?.[workflowId]?.roles;
  if (!validStrings(selectedRoles)) fail(`workflow_agents.${workflowId}.roles must select the auxiliary callers`);
  for (const caller of binding.callers) {
    safeId(caller, 'auxiliary caller');
    if (!selectedRoles.includes(caller)) fail(`Auxiliary caller '${caller}' is not selected for workflow '${workflowId}'`);
  }
  const tasks = binding.tasks;
  if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks) || !Object.keys(tasks).length) fail('Auxiliary model tasks must be a nonempty mapping');

  const workProfile = read(path.join(profileDirectory, `${profileId}-work-profile.yml`)).value;
  const workflow = workProfile.workflows?.filter((item) => item.path === `${workflowId}.workflow.md`);
  if (!Array.isArray(workflow) || workflow.length !== 1) fail('Auxiliary workflow is missing or ambiguous');
  const providersFile = path.resolve(profileDirectory, workflow[0].local_ai?.providers_config || '');
  inside(profileDirectory, providersFile, 'provider catalog');
  const providers = read(providersFile).value.providers;
  const providerMatches = providers?.filter((item) => item.id === providerId) || [];
  if (providerMatches.length !== 1) fail('Auxiliary provider is missing or ambiguous');
  const provider = providerMatches[0];
  const modelMatches = provider.models?.filter((item) => item.id === modelAlias) || [];
  if (modelMatches.length !== 1) fail('Auxiliary model is missing or ambiguous');
  const model = modelMatches[0];
  if (!Number.isSafeInteger(model.hermes?.context_window_tokens) || model.hermes.context_window_tokens < 1) fail('Auxiliary model Hermes context window is invalid');
  const connection = provider.endpoint?.connections?.[connectionId];
  if (!connection?.url || connection.headers) fail('Auxiliary model currently requires an unprotected configured endpoint');
  const endpoint = connection.url.replace(/\/$/, '');

  const workflowsRoot = fs.realpathSync(path.resolve(profileDirectory, workProfile.ai_workflows_root));
  const strategyRef = model.delegation?.strategy_config;
  if (typeof strategyRef !== 'string' || !strategyRef || path.isAbsolute(strategyRef) || strategyRef.split(/[\\/]/).includes('..')) fail('Auxiliary model strategy is missing or unsafe');
  const strategyPath = fs.realpathSync(path.resolve(workflowsRoot, strategyRef));
  inside(workflowsRoot, strategyPath, 'auxiliary strategy');
  const strategy = read(strategyPath).value;
  if (strategy.schema_version !== 'local-auxiliary-model-strategy.v1' || strategy.applies_to?.provider_model !== model.provider_model) fail('Auxiliary strategy does not match the model');
  const allowedTasks = strategy.tasks?.allowed;
  if (!validStrings(allowedTasks)) fail('Auxiliary strategy has no allowed tasks');
  for (const task of Object.keys(tasks)) {
    safeId(task, 'auxiliary task');
    if (!allowedTasks.includes(task)) fail(`Auxiliary task '${task}' is not allowed by the model strategy`);
    const settings = tasks[task];
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) fail(`Auxiliary task '${task}' settings must be a mapping`);
    if (!Number.isSafeInteger(settings.timeout_seconds) || settings.timeout_seconds < 1 || settings.timeout_seconds > 300) fail(`Auxiliary task '${task}' timeout is invalid`);
  }
  const modelsRoot = fs.realpathSync(path.join(path.dirname(workflowsRoot), 'models'));
  const expertisePath = fs.realpathSync(path.resolve(path.dirname(strategyPath), strategy.expertise_profile || ''));
  inside(modelsRoot, expertisePath, 'auxiliary expertise profile');
  const expertise = read(expertisePath).value;
  const communication = expertise.communication;
  if (expertise.schema_version !== 'ai-fleas-model-expertise.v1' || !expertise.applies_to?.provider_models?.includes(model.provider_model) ||
      !communication || !validStrings(communication.direct_starting_language) || !validStrings(communication.translate_first) ||
      typeof communication.handoff_rule !== 'string' || !communication.handoff_rule.trim() ||
      typeof communication.verification_rule !== 'string' || !communication.verification_rule.trim()) fail('Auxiliary expertise profile is invalid or mismatched');

  const response = await fetch(`${endpoint}/models`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) fail(`Auxiliary endpoint returned HTTP ${response.status}`);
  const advertised = (await response.json())?.data;
  if (!Array.isArray(advertised) || !advertised.some((item) => item.id === model.provider_model)) fail('Auxiliary model is not advertised');
  if (preflightOnly) {
    process.stdout.write(`HERMES_AUXILIARY_PREFLIGHT_READY: group=${groupId} model=${model.provider_model} tasks=${Object.keys(tasks).join(',')} strategy=${strategyPath} expertise=${expertisePath}\n`);
    process.exit(0);
  }

  const hermesHome = process.env.HERMES_HOME || path.join(process.env.HOME, '.hermes');
  for (const caller of binding.callers) {
    const configFile = path.join(hermesHome, 'profiles', `${groupId}-${caller}`, 'config.yaml');
    if (!fs.statSync(configFile, { throwIfNoEntry: false })?.isFile()) fail(`Auxiliary caller profile is missing: ${caller}`);
    const { document } = read(configFile);
    document.setIn(['providers', providerId], {
      name: provider.label || providerId,
      base_url: endpoint,
      model: model.provider_model,
      discover_models: false,
      models: { [model.provider_model]: {} },
    });
    for (const [task, settings] of Object.entries(tasks)) {
      document.setIn(['auxiliary', task, 'provider'], providerId);
      document.setIn(['auxiliary', task, 'model'], model.provider_model);
      document.setIn(['auxiliary', task, 'base_url'], endpoint);
      document.setIn(['auxiliary', task, 'api_key'], '');
      document.setIn(['auxiliary', task, 'timeout'], settings.timeout_seconds);
      if (task === 'compression') document.setIn(['auxiliary', task, 'context_length'], model.hermes?.context_window_tokens);
    }
    fs.writeFileSync(configFile, String(document), { mode: 0o600 });
    process.stdout.write(`HERMES_AUXILIARY_CONFIGURED: profile=${groupId}-${caller} model=${model.provider_model} tasks=${Object.keys(tasks).join(',')}\n`);
  }
} catch (error) {
  process.stderr.write(`HERMES_AUXILIARY_CONFIG_ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
