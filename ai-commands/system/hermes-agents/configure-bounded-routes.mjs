#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { BoundedModelSampling } from './bounded-model.sampling.mjs';

class BoundedRouteConfigurator {
  constructor(profileDirectory, groupId) {
    this.profileDirectory = path.resolve(profileDirectory);
    this.groupId = groupId;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(groupId)) throw new Error('Invalid group ID');
  }
  read(file) {
    const document = parseDocument(fs.readFileSync(file, 'utf8'), { uniqueKeys: true, strict: true });
    if (document.errors.length) throw new Error(`Invalid YAML: ${file}`);
    return document;
  }
  async configure(preflightOnly = false) {
    const commandFile = path.join(this.profileDirectory, 'commands-config/hermes-agents/config.yml');
    if (!fs.existsSync(commandFile)) return;
    const command = this.read(commandFile).toJS();
    const binding = command.bounded_coder;
    if (!binding) return;
    const runner = command.command_runner_route;
    if (!Array.isArray(binding.callers) || !binding.callers.length) throw new Error('Invalid bounded_coder callers');
    const sampling = new BoundedModelSampling(binding.sampling);
    for (const [name, value, ceiling] of [['max_input_chars', binding.max_input_chars, 24000], ['max_output_tokens', binding.max_output_tokens, 4096], ['timeout_ms', binding.timeout_ms, 120000]]) {
      if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) throw new Error(`Invalid bounded_coder ${name}`);
    }
    const profileId = path.basename(this.profileDirectory);
    const workProfile = this.read(path.join(this.profileDirectory, `${profileId}-work-profile.yml`)).toJS();
    const workflow = workProfile.workflows?.find((item) => item.path === 'dev.workflow.md');
    if (!workflow?.local_ai?.providers_config || !workflow.agent_providers_config) throw new Error('Dev workflow has no bounded Coder sources');
    const roleBindings = this.read(path.join(this.profileDirectory, workflow.agent_providers_config)).toJS();
    if (roleBindings.bindings?.coder?.realization !== 'bounded-route') throw new Error('Coder is not configured as a bounded route');
    if (runner) {
      if (roleBindings.bindings?.['command-runner']?.realization !== 'bounded-route') throw new Error('Command Runner is not configured as a bounded route');
      if (runner.provider !== binding.provider || runner.model !== binding.model || runner.connection !== binding.connection) throw new Error('Command Runner model must match the configured bounded model');
      if (!Number.isSafeInteger(runner.timeout_ms) || runner.timeout_ms < 1 || runner.timeout_ms > 300000) throw new Error('Invalid Command Runner timeout');
      if (!Array.isArray(runner.callers) || !runner.callers.length) throw new Error('Invalid Command Runner callers');
      for (const role of runner.callers) {
        const allowed = runner.allowed_commands?.[role];
        if (!binding.callers.includes(role) || !Array.isArray(allowed) || !allowed.length || allowed.some((id) => !workflow.commands.includes(id))) throw new Error(`Invalid Command Runner commands for ${role}`);
      }
    }
    const providers = this.read(path.join(this.profileDirectory, workflow.local_ai.providers_config)).toJS().providers;
    const provider = providers.filter((candidate) => candidate.id === binding.provider);
    if (provider.length !== 1) throw new Error('Bounded Coder provider is missing or ambiguous');
    const model = provider[0].models.filter((candidate) => candidate.id === binding.model);
    if (model.length !== 1) throw new Error('Bounded Coder model is missing or ambiguous');
    const connection = provider[0].endpoint.connections?.[binding.connection || provider[0].endpoint.default];
    const endpoint = connection?.url;
    if (!/^https?:\/\//.test(endpoint || '') || connection?.headers) throw new Error('Bounded Coder requires an unprotected configured endpoint');
    const modelList = await fetch(`${endpoint.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(5000) });
    if (!modelList.ok) throw new Error(`Bounded Coder model endpoint returned HTTP ${modelList.status}`);
    const availableModels = (await modelList.json())?.data;
    if (!Array.isArray(availableModels) || !availableModels.some((item) => item.id === model[0].provider_model)) throw new Error('Bounded Coder model is not advertised');
    if (preflightOnly) { process.stdout.write(`BOUNDED_ROUTES_PREFLIGHT_READY: ${this.groupId}\n`); return; }
    const executable = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bounded-model.command.mjs');
    const server = {
      command: process.execPath,
      args: [executable, 'serve-mcp', '--endpoint', endpoint, '--model', model[0].provider_model,
        '--max-input-chars', String(binding.max_input_chars), '--max-output-tokens', String(binding.max_output_tokens), '--timeout-ms', String(binding.timeout_ms), ...sampling.commandArguments()],
    };
    const hermesHome = process.env.HERMES_HOME || path.join(process.env.HOME, '.hermes');
    const updates = [];
    for (const role of binding.callers) {
      if (!['admin', 'designer-reviewer'].includes(role)) throw new Error(`Unsupported bounded Coder caller: ${role}`);
      const file = path.join(hermesHome, 'profiles', `${this.groupId}-${role}`, 'config.yaml');
      const document = this.read(file);
      const existing = document.getIn(['mcp_servers', 'bounded-coder']);
      const prior = existing?.toJSON();
      if (prior && (prior.command !== process.execPath || prior.args?.[0] !== executable || prior.args?.[1] !== 'serve-mcp')) throw new Error(`Conflicting bounded Coder server in ${file}`);
      document.setIn(['mcp_servers', 'bounded-coder'], server);
      if (runner?.callers.includes(role)) document.setIn(['mcp_servers', 'command-runner-route'], {
        command: process.execPath,
        args: [path.join(path.dirname(fileURLToPath(import.meta.url)), 'command-runner-route.mjs'), 'serve-mcp', this.profileDirectory, role],
      });
      const toolsets = document.getIn(['platform_toolsets', 'a2a'])?.toJSON() || [];
      if (toolsets.length && !toolsets.includes('mcp-bounded-coder')) document.setIn(['platform_toolsets', 'a2a'], [...toolsets, 'mcp-bounded-coder']);
      updates.push({ file, role, text: String(document) });
    }
    for (const update of updates) {
      fs.writeFileSync(update.file, update.text, { mode: 0o600 });
      const soulFile = path.join(path.dirname(update.file), 'SOUL.md');
      const marker = '<!-- AI_FLEAS_BOUNDED_CODER_ROUTE -->';
      const endMarker = '<!-- /AI_FLEAS_BOUNDED_CODER_ROUTE -->';
      const guidance = `${marker}\n## Bounded Coder route\n\nFor a Coder-owned implementation step, call the bounded_coder tool with a self-contained task, relevant file excerpts, interfaces, exact input/output examples, and a stop condition. The model proposes text only and cannot inspect or edit files. Review its proposal, apply accepted changes in the visible checkout, and verify the result. Do not treat its answer as independent review.\n${endMarker}`;
      const soul = fs.readFileSync(soulFile, 'utf8');
      const start = soul.indexOf(marker), end = soul.indexOf(endMarker, start);
      const nextSoul = start < 0 ? `${soul.trimEnd()}\n\n${guidance}\n` : end < 0 ? `${soul.slice(0, start).trimEnd()}\n\n${guidance}\n` : `${soul.slice(0, start)}${guidance}${soul.slice(end + endMarker.length)}`;
      const runnerMarker = '<!-- AI_FLEAS_COMMAND_RUNNER_ROUTE -->', runnerEnd = '<!-- /AI_FLEAS_COMMAND_RUNNER_ROUTE -->';
      const runnerGuidance = `${runnerMarker}\n## Command Runner route\n\nUse plan_registered_command with the exact projectId only for a proposal from the selected local model. It does not execute anything. Before run_registered_command, inspect the exact registered command ID and argument vector, confirm the task authorizes its effects, and select the exact project. The route executes the existing registered wrapper and returns its real exit status and terminal output. Review that evidence and stop on failure. Do not treat the model's plan as execution evidence.\n${runnerEnd}`;
      const runnerStart = nextSoul.indexOf(runnerMarker), runnerStop = nextSoul.indexOf(runnerEnd, runnerStart);
      const finalSoul = !runner?.callers.includes(update.role) ? nextSoul : runnerStart < 0 ? `${nextSoul.trimEnd()}\n\n${runnerGuidance}\n` : runnerStop < 0 ? `${nextSoul.slice(0, runnerStart).trimEnd()}\n\n${runnerGuidance}\n` : `${nextSoul.slice(0, runnerStart)}${runnerGuidance}${nextSoul.slice(runnerStop + runnerEnd.length)}`;
      fs.writeFileSync(soulFile, finalSoul, { mode: 0o600 });
      process.stdout.write(`BOUNDED_CODER_CONFIGURED: ${this.groupId}-${update.role}\n`);
    }
    const receipt = this.read(path.join(this.profileDirectory, '.local/hermes-agents/bindings.yml')).toJS();
    const members = receipt.workflow_groups?.[this.groupId]?.profiles;
    if (!Array.isArray(members)) throw new Error('Hermes group receipt is missing');
    for (const role of ['coder', ...(runner ? ['command-runner'] : [])]) {
      if (members.includes(`${this.groupId}-${role}`)) throw new Error(`${role} is still a Hermes roster member`);
      const retiredFile = path.join(hermesHome, 'profiles', `${this.groupId}-${role}`, 'profile.yaml');
      if (!fs.existsSync(retiredFile)) continue;
      const document = this.read(retiredFile);
      const metadata = document.getIn(['ui_meta', 'hermes-bots'])?.toJSON() || {};
      const groups = (metadata.groups || []).filter((group) => group !== this.groupId);
      document.setIn(['ui_meta', 'hermes-bots', 'groups'], groups);
      if (metadata.group === this.groupId) document.deleteIn(['ui_meta', 'hermes-bots', 'group']);
      document.setIn(['ui_meta', 'hermes-bots', 'hidden'], true);
      fs.writeFileSync(retiredFile, String(document), { mode: 0o600 });
      process.stdout.write(`BOUNDED_ROUTE_RETIRED_FROM_GROUP: ${this.groupId}-${role}\n`);
    }
  }
}

try {
  if (process.argv.length < 4 || process.argv.length > 5 || (process.argv[4] && process.argv[4] !== '--preflight-only')) throw new Error('Usage: configure-bounded-routes.mjs PROFILE_DIRECTORY GROUP_ID [--preflight-only]');
  await new BoundedRouteConfigurator(process.argv[2], process.argv[3]).configure(process.argv[4] === '--preflight-only');
} catch (error) {
  process.stderr.write(`BOUNDED_ROUTE_CONFIG_ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
