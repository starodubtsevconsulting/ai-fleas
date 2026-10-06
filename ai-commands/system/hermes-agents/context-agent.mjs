#!/usr/bin/env node
// Purpose: inspect or reconcile one exact initialized Hermes agent's context window across its source catalog, local bot, and configured model service.
// Caller: hermes-agents.command.sh `context`; profile configuration supplies only the private service connection details.
// Input/output: `status --agent NAME` reports the three observed limits; `set --agent NAME --tokens N` updates and verifies all three.
// Effects: `status` is read-only. `set` changes the selected profile catalog, Hermes profile, and the configured remote service override, then restarts that service.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';

const usage = () => {
  console.error('Usage: hermes-agents context status --agent EXACT_NAME');
  console.error('       hermes-agents context set --agent EXACT_NAME --tokens POSITIVE_INTEGER');
  process.exit(2);
};
const fail = (message) => { console.error(message); process.exit(2); };
const id = /^[a-z0-9][a-z0-9-]*$/;
const tokens = /^[1-9][0-9]*$/;

const [action, ...arguments_] = process.argv.slice(2);
let agent = '';
let requestedTokens = '';
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index];
  if (argument === '--agent') { agent = arguments_[++index] ?? ''; continue; }
  if (argument === '--tokens') { requestedTokens = arguments_[++index] ?? ''; continue; }
  usage();
}
if (!['status', 'set'].includes(action) || !id.test(agent) || (action === 'set' && !tokens.test(requestedTokens)) || (action === 'status' && requestedTokens)) usage();

const profileRoot = process.env.AI_PROFILE_ROOT;
const commandConfig = process.env.AI_COMMAND_CONFIG_PATH;
if (!profileRoot || !path.isAbsolute(profileRoot) || !fs.statSync(profileRoot, { throwIfNoEntry: false })?.isDirectory()) fail('HERMES_CONTEXT_PROFILE_ROOT_REQUIRED: select an active profile.');
if (!commandConfig || !path.isAbsolute(commandConfig) || !fs.statSync(commandConfig, { throwIfNoEntry: false })?.isFile()) fail('HERMES_CONTEXT_COMMAND_CONFIG_REQUIRED: hermes-agents needs an active private command configuration.');
const readYaml = (file) => {
  const document = parseDocument(fs.readFileSync(file, 'utf8'));
  if (document.errors.length) fail(`HERMES_CONTEXT_CONFIGURATION_INVALID: ${file}`);
  return document;
};
const bindingCandidates = [];
for (const entry of fs.readdirSync(profileRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const bindingFile = path.join(profileRoot, entry.name, '.local', 'hermes-agents', 'bindings.yml');
  if (!fs.statSync(bindingFile, { throwIfNoEntry: false })?.isFile()) continue;
  const bindings = readYaml(bindingFile).toJSON() ?? {};
  for (const [groupId, group] of Object.entries(bindings.workflow_groups ?? {})) {
    if (group?.readiness === 'ready' && Array.isArray(group.profiles) && group.profiles.includes(agent)) bindingCandidates.push({ profile: entry.name, groupId });
  }
}
if (bindingCandidates.length !== 1) fail(`HERMES_CONTEXT_AGENT_BINDING_${bindingCandidates.length ? 'AMBIGUOUS' : 'MISSING'}: ${agent}`);
const binding = bindingCandidates[0];
const expectedPrefix = `${binding.profile}-`;
if (!binding.groupId.startsWith(expectedPrefix) || !agent.startsWith(`${binding.groupId}-`)) fail(`HERMES_CONTEXT_AGENT_BINDING_INVALID: ${agent}`);
const workflowId = binding.groupId.slice(expectedPrefix.length);
const profileFile = path.join(profileRoot, binding.profile, `${binding.profile}-work-profile.yml`);
const profile = readYaml(profileFile).toJSON() ?? {};
const workflow = (profile.workflows ?? []).filter((candidate) => candidate?.path === `${workflowId}.workflow.md`)[0];
if (!workflow?.local_ai?.provider || !workflow.local_ai.model || typeof workflow.local_ai.providers_config !== 'string') fail(`HERMES_CONTEXT_WORKFLOW_CONFIGURATION_INVALID: ${binding.groupId}`);
const catalogFile = path.resolve(path.dirname(profileFile), workflow.local_ai.providers_config);
if (!catalogFile.startsWith(`${path.dirname(profileFile)}${path.sep}`)) fail('HERMES_CONTEXT_CONFIGURATION_INVALID: provider catalog escapes profile root.');
const catalogDocument = readYaml(catalogFile);
const catalog = catalogDocument.toJSON() ?? {};
const provider = (catalog.providers ?? []).filter((candidate) => candidate?.id === workflow.local_ai.provider)[0];
const model = (provider?.models ?? []).filter((candidate) => candidate?.id === workflow.local_ai.model)[0];
if (!provider || !model?.provider_model || !tokens.test(String(model?.hermes?.context_window_tokens ?? ''))) fail(`HERMES_CONTEXT_MODEL_CONFIGURATION_INVALID: ${agent}`);
const catalogTokens = String(model.hermes.context_window_tokens);
const endpoint = String((provider.endpoint?.connections?.local ?? provider.endpoint?.connections?.[provider.endpoint?.default] ?? {}).url ?? '');
if (!/^http:\/\/(?:127\.0\.0\.1|localhost|(?:[0-9]{1,3}\.){3}[0-9]{1,3})(?::[0-9]+)?\/v1$/.test(endpoint)) fail('HERMES_CONTEXT_ENDPOINT_INVALID: only a configured LAN OpenAI endpoint is supported.');

const command = readYaml(commandConfig).toJSON() ?? {};
const service = command.context_window_service;
if (!service || typeof service !== 'object') fail('HERMES_CONTEXT_SERVICE_CONFIGURATION_REQUIRED: configure context_window_service in the private hermes-agents command configuration.');
const sshTarget = String(service.ssh_target ?? '');
const unit = String(service.unit ?? '');
const overrideFile = String(service.override_file ?? '');
if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(sshTarget) || !/^[A-Za-z0-9@._-]+\.service$/.test(unit) || !/^\/[A-Za-z0-9._/-]+\.conf$/.test(overrideFile)) fail('HERMES_CONTEXT_SERVICE_CONFIGURATION_INVALID: unsafe service connection values.');

const run = (program, args, options = {}) => {
  const stdio = options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'];
  return execFileSync(program, args, { encoding: 'utf8', stdio, ...options }).trim();
};
const hermes = process.env.HERMES_BIN || 'hermes';
const localTokens = () => run(hermes, ['-p', agent, 'config', 'get', 'model.context_length']);
const remoteTokens = () => run('ssh', [sshTarget, `curl --fail --silent --show-error http://127.0.0.1:8000/v1/models`]);
const apiTokens = () => {
  const data = JSON.parse(remoteTokens());
  const found = (data.data ?? []).filter((item) => item?.id === model.provider_model);
  if (found.length !== 1 || !tokens.test(String(found[0].meta?.n_ctx ?? found[0].n_ctx ?? ''))) fail(`HERMES_CONTEXT_SERVER_MODEL_INVALID: ${model.provider_model}`);
  return String(found[0].meta?.n_ctx ?? found[0].n_ctx);
};
const waitForApi = () => {
  let lastError = '';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { return apiTokens(); } catch (error) { lastError = String(error.stderr ?? error.message ?? error).trim(); }
    execFileSync('sleep', ['2']);
  }
  fail(`HERMES_CONTEXT_SERVER_NOT_READY: ${lastError || 'model service did not become ready within 60 seconds.'}`);
};
const report = () => {
  const result = { agent, profile: binding.profile, workflow: workflowId, model: model.provider_model, catalog: catalogTokens, hermes: localTokens(), server: apiTokens() };
  console.log(`HERMES_CONTEXT_STATUS: agent=${result.agent} profile=${result.profile} workflow=${result.workflow} model=${result.model} catalog=${result.catalog} hermes=${result.hermes} server=${result.server}`);
  return result;
};

if (action === 'status') {
  const result = report();
  if (new Set([result.catalog, result.hermes, result.server]).size !== 1) fail(`HERMES_CONTEXT_DRIFT: agent=${agent}; use 'context set --agent ${agent} --tokens N' to reconcile.`);
  process.exit(0);
}

// Do remote restart first; catalog and Hermes are changed only after the remote command succeeds.
const remoteScript = String.raw`set -eu
file="$1"; value="$2"; unit="$3"
python3 - "$file" "$value" <<'PY'
import os, re, sys
from pathlib import Path
file, value = map(Path, sys.argv[1:3])
text = file.read_text()
updated, count = re.subn(r'(?<=--ctx-size\s)\d+', str(value), text)
if count != 1:
    raise SystemExit('HERMES_CONTEXT_SERVICE_OVERRIDE_INVALID: expected exactly one --ctx-size value.')
temporary = file.with_suffix(file.suffix + '.tmp')
temporary.write_text(updated)
os.replace(temporary, file)
PY
systemctl --user daemon-reload
systemctl --user restart "$unit"
systemctl --user is-active --quiet "$unit"`;
try { run('ssh', [sshTarget, 'bash', '-s', '--', overrideFile, requestedTokens, unit], { input: remoteScript }); } catch (error) { fail(`HERMES_CONTEXT_SERVICE_RESTART_FAILED: ${String(error.stderr ?? '').trim() || 'remote service update failed.'}`); }

const node = catalogDocument.getIn(['providers', catalog.providers.indexOf(provider), 'models', provider.models.indexOf(model), 'hermes', 'context_window_tokens'], true);
if (!node) fail('HERMES_CONTEXT_MODEL_CONFIGURATION_INVALID: context token field is missing.');
node.value = Number(requestedTokens);
fs.writeFileSync(catalogFile, String(catalogDocument));
try { run(hermes, ['-p', agent, 'config', 'set', 'model.context_length', requestedTokens]); } catch (error) { fail(`HERMES_CONTEXT_LOCAL_UPDATE_FAILED: ${String(error.stderr ?? '').trim() || 'Hermes refused the context update.'}`); }
waitForApi();
const result = report();
if (new Set([result.catalog, result.hermes, result.server]).size !== 1 || result.catalog !== requestedTokens) fail(`HERMES_CONTEXT_RECONCILE_FAILED: requested=${requestedTokens}`);
console.log(`HERMES_CONTEXT_READY: agent=${agent} tokens=${requestedTokens}`);
