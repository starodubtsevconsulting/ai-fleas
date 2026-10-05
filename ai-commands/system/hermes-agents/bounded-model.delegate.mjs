#!/usr/bin/env node
// Purpose: validate and invoke the configured proposal-only Coder with its target-model strategy and extracted expertise.
// Caller/invocation: the profile launcher calls check|run --project ID [assignment]; check is read-only and run performs one model request.
// Inputs/outputs/effects: reads canonical profile/model YAML, reports validated bindings, and prints a proposal without editing repository files.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { fileURLToPath } from 'node:url';
import { BoundedModelSampling } from './bounded-model.sampling.mjs';

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
    this.sampling = new BoundedModelSampling(this.binding.sampling);
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
    const strategyRef = models[0].delegation?.strategy_config;
    const workflowsRef = this.profile.ai_workflows_root;
    if (typeof strategyRef !== 'string' || !strategyRef || path.isAbsolute(strategyRef) ||
        strategyRef.split(/[\\/]/).includes('..') || typeof workflowsRef !== 'string' || !workflowsRef) {
      throw new Error('Bounded Coder target strategy is missing or unsafe');
    }
    const workflowsRoot = fs.realpathSync(path.resolve(this.profileDir, workflowsRef));
    const strategyPath = fs.realpathSync(path.resolve(workflowsRoot, strategyRef));
    const relative = path.relative(workflowsRoot, strategyPath);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
        !fs.statSync(strategyPath).isFile()) throw new Error('Bounded Coder strategy is outside the workflow catalog');
    const strategy = this.read(strategyPath);
    if (strategy.applies_to?.provider_model !== models[0].provider_model ||
        strategy.strategy?.transport !== 'bounded-model' || strategy.strategy?.output !== 'proposal-only' ||
        strategy.assignment?.limits?.max_input_chars !== this.binding.max_input_chars ||
        strategy.assignment?.limits?.max_output_tokens !== this.binding.max_output_tokens) {
      throw new Error('Bounded Coder target strategy does not match the route');
    }
    const expertiseRef = strategy.expertise_profile;
    if (typeof expertiseRef !== 'string' || !expertiseRef || path.isAbsolute(expertiseRef)) {
      throw new Error('Bounded Coder target expertise profile is missing or unsafe');
    }
    const repositoryRoot = path.dirname(workflowsRoot);
    const modelsRoot = fs.realpathSync(path.join(repositoryRoot, 'models'));
    const expertisePath = fs.realpathSync(path.resolve(path.dirname(strategyPath), expertiseRef));
    const expertiseRelative = path.relative(modelsRoot, expertisePath);
    if (!expertiseRelative || expertiseRelative === '..' || expertiseRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(expertiseRelative) || !fs.statSync(expertisePath).isFile()) {
      throw new Error('Bounded Coder target expertise profile is outside the canonical model catalog');
    }
    const expertise = this.read(expertisePath);
    const communication = expertise.communication;
    const validList = (value) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim());
    const expertiseModels = expertise.applies_to?.provider_models;
    if (expertise.schema_version !== 'ai-fleas-model-expertise.v1' || typeof expertise.model_family !== 'string' || !expertise.model_family.trim() ||
        !validList(expertiseModels) || !expertiseModels.includes(models[0].provider_model) ||
        !communication || !validList(communication.direct_starting_language) || !validList(communication.translate_first) ||
        typeof communication.handoff_rule !== 'string' || !communication.handoff_rule.trim() ||
        typeof communication.verification_rule !== 'string' || !communication.verification_rule.trim()) {
      throw new Error('Bounded Coder target expertise communication contract is invalid');
    }
    const expertiseContract = [
      'Target-model expertise contract (apply throughout this assignment):',
      `- Model family: ${expertise.model_family}`,
      `- Observed scope: ${communication.observed_scope || ''}`,
      `- Direct language: ${communication.direct_starting_language.join(' ')}`,
      `- Translate first: ${communication.translate_first.join(' ')}`,
      `- Handoff rule: ${communication.handoff_rule}`,
      `- Verification rule: ${communication.verification_rule}`,
    ].join('\n');
    return { endpoint: connection.url, model: models[0].provider_model, strategyPath, expertisePath, expertiseContract };
  }
  execute(operation, projectId, assignment) {
    const project = this.project(projectId);
    const target = this.model();
    if (operation === 'check') {
      const response = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'bounded-model.command.mjs'), 'ask', '--endpoint', target.endpoint, '--model', target.model, '--max-output-tokens', '4', ...this.sampling.commandArguments()], { input: 'Reply READY.', encoding: 'utf8', timeout: 30000 });
      if (response.status !== 0) throw new Error(`Model check failed: ${response.stderr.trim()}`);
      process.stdout.write(`BOUNDED_CODER_READY: project=${projectId} branch=${project.branch} model=${target.model} strategy=${target.strategyPath} expertise=${target.expertisePath}\n`);
      return;
    }
    if (operation !== 'run' || !assignment?.trim()) throw new Error('A bounded assignment is required');
    const prompt = `${target.expertiseContract}\n\nConcrete assignment (already adapted by the caller using this contract):\n${assignment}`;
    const response = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'bounded-model.command.mjs'), 'ask', '--endpoint', target.endpoint, '--model', target.model, '--max-input-chars', String(this.binding.max_input_chars), '--max-output-tokens', String(this.binding.max_output_tokens), '--timeout-ms', String(this.binding.timeout_ms), ...this.sampling.commandArguments()], { input: prompt, encoding: 'utf8', timeout: this.binding.timeout_ms + 5000 });
    if (response.status !== 0) throw new Error(`Model run failed: ${response.stderr.trim()}`);
    process.stdout.write(response.stdout);
  }
}

try {
  const [operation, flag, projectId, assignment, ...rest] = process.argv.slice(2);
  if (!['check', 'run'].includes(operation) || flag !== '--project' || !projectId || rest.length || (operation === 'check' && assignment)) throw new Error('Usage: bounded-model.delegate.mjs check|run --project ID [assignment]');
  new BoundedCoderDelegate().execute(operation, projectId, assignment);
} catch (error) { process.stderr.write(`BOUNDED_CODER_BLOCKED: ${error.message}\n`); process.exitCode = 1; }
