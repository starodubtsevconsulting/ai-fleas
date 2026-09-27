#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { fileURLToPath } from 'node:url';

class BoundedCoderDelegate {
  constructor() {
    this.profileRoot = path.resolve(process.env.AI_PROFILE_ROOT || '');
    this.profileId = process.env.AI_WORK_PROFILE_ID;
    this.workflow = process.env.AI_FLOW_WORKFLOW;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(this.profileId || '') || this.workflow !== 'dev.workflow.md') throw new Error('Exact profile and Dev workflow are required');
    this.profileDir = path.join(this.profileRoot, this.profileId);
    this.profile = this.read(`${this.profileDir}/${this.profileId}-work-profile.yml`);
    if (this.profile.name !== this.profileId) throw new Error('Profile identity mismatch');
    this.workflowConfig = this.profile.workflows?.find((item) => item.path === this.workflow);
    if (!this.workflowConfig) throw new Error('Dev workflow is not configured');
    const commandConfig = this.read(path.join(this.profileDir, 'commands-config/hermes-agents/config.yml'));
    this.binding = commandConfig.bounded_coder;
    if (!this.binding) throw new Error('Bounded Coder is not configured');
    const gptConfig = this.read(path.join(this.profileDir, 'commands-config/gpt-agents/config.yml'));
    this.route = gptConfig.execution_delegates?.dev?.coder;
    if (this.route?.platform !== 'bounded-model' || this.route?.transport !== 'direct-model' || this.route?.output !== 'proposal-only' || this.route?.model !== this.binding.model || this.route?.launcher !== 'bounded-coder-delegate.sh') throw new Error('GPT Coder route does not match this bounded model');
  }
  read(file) {
    const document = parseDocument(fs.readFileSync(file, 'utf8'), { uniqueKeys: true, strict: true });
    if (document.errors.length) throw new Error(`Invalid YAML: ${file}`);
    return document.toJS();
  }
  project(id) {
    if (!this.route.projects?.includes(id)) throw new Error('Project is not authorized for this Coder route');
    const projects = this.workflowConfig.projects.map(({ ref }) => this.read(path.join(this.profileDir, ref)));
    const matches = projects.filter((project) => project.id === id);
    if (matches.length !== 1) throw new Error('Project is not authorized for Dev workflow');
    const root = matches[0].repo_path.replace(/^~(?=\/)/, process.env.HOME);
    if (path.resolve(root) !== fs.realpathSync(process.cwd())) throw new Error('Run in the visible selected project checkout');
    const branch = spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' });
    if (branch.status !== 0 || !branch.stdout.trim()) throw new Error('A named Git branch is required');
    return { root, branch: branch.stdout.trim() };
  }
  model() {
    const catalog = this.read(path.join(this.profileDir, this.workflowConfig.local_ai.providers_config));
    const providers = catalog.providers.filter((item) => item.id === this.binding.provider);
    if (providers.length !== 1) throw new Error('Bounded Coder provider is missing or ambiguous');
    const models = providers[0].models.filter((item) => item.id === this.binding.model);
    if (models.length !== 1) throw new Error('Bounded Coder model is missing or ambiguous');
    const connection = providers[0].endpoint.connections?.[this.binding.connection || providers[0].endpoint.default];
    if (!connection?.url || connection.headers) throw new Error('Bounded Coder endpoint is unavailable');
    return { endpoint: connection.url, model: models[0].provider_model };
  }
  execute(operation, projectId, assignment) {
    const project = this.project(projectId);
    const target = this.model();
    if (operation === 'check') {
      const response = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'bounded-model.command.mjs'), 'ask', '--endpoint', target.endpoint, '--model', target.model, '--max-output-tokens', '4'], { input: 'Reply READY.', encoding: 'utf8', timeout: 30000 });
      if (response.status !== 0) throw new Error(`Model check failed: ${response.stderr.trim()}`);
      process.stdout.write(`BOUNDED_CODER_READY: project=${projectId} branch=${project.branch} model=${target.model}\n`);
      return;
    }
    if (operation !== 'run' || !assignment?.trim()) throw new Error('A bounded assignment is required');
    const response = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'bounded-model.command.mjs'), 'ask', '--endpoint', target.endpoint, '--model', target.model, '--max-input-chars', String(this.binding.max_input_chars), '--max-output-tokens', String(this.binding.max_output_tokens), '--timeout-ms', String(this.binding.timeout_ms)], { input: assignment, encoding: 'utf8', timeout: this.binding.timeout_ms + 5000 });
    if (response.status !== 0) throw new Error(`Model run failed: ${response.stderr.trim()}`);
    process.stdout.write(response.stdout);
  }
}

try {
  const [operation, flag, projectId, assignment, ...rest] = process.argv.slice(2);
  if (!['check', 'run'].includes(operation) || flag !== '--project' || !projectId || rest.length || (operation === 'check' && assignment)) throw new Error('Usage: bounded-model.delegate.mjs check|run --project ID [assignment]');
  new BoundedCoderDelegate().execute(operation, projectId, assignment);
} catch (error) { process.stderr.write(`BOUNDED_CODER_BLOCKED: ${error.message}\n`); process.exitCode = 1; }
