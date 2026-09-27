#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

class CommandRunnerRoute {
  constructor(profileDirectory, callerRole) {
    this.profileDirectory = fs.realpathSync(profileDirectory);
    this.profileId = path.basename(this.profileDirectory);
    this.callerRole = callerRole;
    this.profile = this.read(path.join(this.profileDirectory, `${this.profileId}-work-profile.yml`));
    if (this.profile.name !== this.profileId) throw new Error('Profile identity mismatch');
    this.workflow = this.profile.workflows?.find((item) => item.path === 'dev.workflow.md');
    if (!this.workflow) throw new Error('Dev workflow is not configured');
    this.config = this.read(path.join(this.profileDirectory, 'commands-config/hermes-agents/config.yml')).command_runner_route;
    if (!this.config || !this.config.callers?.includes(callerRole)) throw new Error('Caller is not authorized for Command Runner route');
    this.allowedCommands = this.config.allowed_commands?.[callerRole];
    if (!Array.isArray(this.allowedCommands) || !this.allowedCommands.length || this.allowedCommands.some((id) => !this.workflow.commands.includes(id))) throw new Error('Invalid authorized command list');
    this.commandsRoot = fs.realpathSync(path.resolve(this.profileDirectory, this.profile.ai_commands_root));
    this.privateCommandsRoot = this.profile.ai_private_commands_root ? fs.realpathSync(path.resolve(this.profileDirectory, this.profile.ai_private_commands_root)) : null;
  }
  read(file) {
    const document = parseDocument(fs.readFileSync(file, 'utf8'), { uniqueKeys: true, strict: true });
    if (document.errors.length) throw new Error(`Invalid YAML: ${file}`);
    return document.toJS();
  }
  project(id) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id || '')) throw new Error('Invalid project ID');
    const projects = this.workflow.projects.map(({ ref }) => this.read(path.join(this.profileDirectory, ref)));
    const matches = projects.filter((item) => item.id === id);
    if (matches.length !== 1) throw new Error('Project is not authorized for Dev workflow');
    const root = fs.realpathSync(matches[0].repo_path.replace(/^~(?=\/)/, process.env.HOME));
    const branch = spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' });
    if (branch.status !== 0 || !branch.stdout.trim()) throw new Error('A named branch is required');
    return { root, branch: branch.stdout.trim() };
  }
  command(id) {
    if (!this.allowedCommands.includes(id)) throw new Error(`Command is not authorized for ${this.callerRole}`);
    const found = [];
    for (const root of [this.commandsRoot, this.privateCommandsRoot].filter(Boolean)) {
      const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const target = path.join(directory, entry.name);
          if (entry.isDirectory()) visit(target);
          else if (entry.isFile() && [id + '.command.sh', id + '.command.mjs'].includes(entry.name)) found.push(target);
        }
      };
      visit(root);
    }
    if (found.length !== 1) throw new Error(`Command '${id}' has ${found.length} executable registrations`);
    return found[0];
  }
  run(projectId, commandId, argv) {
    const project = this.project(projectId);
    const executable = this.command(commandId);
    if (!Array.isArray(argv) || argv.length > 32 || argv.some((value) => typeof value !== 'string' || value.length > 512 || /[\0\r\n]/.test(value))) throw new Error('Invalid command arguments');
    if (commandId === 'test' && argv.includes('--project-dir')) throw new Error('Test project override is not allowed');
    if (commandId === 'source-control' && (argv.length !== 3 || argv[1] !== '--repo' || !fs.existsSync(argv[2]) || fs.realpathSync(argv[2]) !== project.root)) throw new Error('Source-control repository must match the selected project');
    if (!['test', 'source-control'].includes(commandId)) throw new Error('Command needs a reviewed route adapter');
    const env = { ...process.env, AI_CONFIG_PROJECT: path.dirname(path.dirname(this.profileDirectory)), AI_WORK_PROFILE_ID: this.profileId, AI_FLOW_WORKFLOW: 'dev.workflow.md', AI_FLOW_PROJECT_DIR: project.root };
    const command = executable.endsWith('.mjs') ? process.execPath : '/bin/bash';
    const result = spawnSync(command, [executable, ...argv], { cwd: project.root, env, encoding: 'utf8', timeout: this.config.timeout_ms, maxBuffer: 1024 * 1024 });
    return { project: projectId, branch: project.branch, commandId, argv, exitCode: result.status, signal: result.signal, stdout: (result.stdout || '').slice(0, 12000), stderr: (result.stderr || '').slice(0, 12000), error: result.error?.message || null };
  }
  plan(task) {
    if (typeof task !== 'string' || !task.trim() || task.length > 12000) throw new Error('Invalid planning task');
    const catalog = this.read(path.join(this.profileDirectory, this.workflow.local_ai.providers_config));
    const providers = catalog.providers.filter((item) => item.id === this.config.provider);
    if (providers.length !== 1) throw new Error('Planner provider is missing or ambiguous');
    const models = providers[0].models.filter((item) => item.id === this.config.model);
    if (models.length !== 1) throw new Error('Planner model is missing or ambiguous');
    const connection = providers[0].endpoint.connections?.[this.config.connection || providers[0].endpoint.default];
    if (!connection?.url || connection.headers) throw new Error('Planner endpoint is unavailable');
    const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bounded-model.command.mjs');
    const input = `Suggest one exact registered command ID and argument vector for this task. Allowed IDs: ${this.allowedCommands.join(', ')}. Do not claim execution. Task: ${task}`;
    const result = spawnSync(process.execPath, [helper, 'ask', '--endpoint', connection.url, '--model', models[0].provider_model, '--max-input-chars', '12000', '--max-output-tokens', '1024', '--timeout-ms', '60000'], { input, encoding: 'utf8', timeout: 65000 });
    if (result.status !== 0) throw new Error(`Planner failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
  }
}

class CommandRunnerMcpServer {
  constructor(route) { this.route = route; }
  reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
  error(id, code, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`); }
  async handle(line) {
    let request;
    try { request = JSON.parse(line); } catch { this.error(null, -32700, 'Invalid JSON'); return; }
    if (request.id === undefined) return;
    const params = request.params || {}, args = params.arguments || {};
    try {
      switch (request.method) {
        case 'initialize': this.reply(request.id, { protocolVersion: params.protocolVersion || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'command-runner-route', version: '1.0.0' } }); break;
        case 'ping': this.reply(request.id, {}); break;
        case 'tools/list': this.reply(request.id, { tools: [
          { name: 'plan_registered_command', description: 'Ask the selected local model to suggest a command. This never executes it.', inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'], additionalProperties: false } },
          { name: 'run_registered_command', description: 'Execute one exact profile-authorized registered command with an argument vector; returns real exit status and terminal evidence. Inspect the command and its effects before calling.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, commandId: { type: 'string' }, argv: { type: 'array', items: { type: 'string' } } }, required: ['projectId', 'commandId', 'argv'], additionalProperties: false } },
        ] }); break;
        case 'tools/call': {
          try {
            if (params.name === 'plan_registered_command') this.reply(request.id, { content: [{ type: 'text', text: this.route.plan(args.task) }] });
            else if (params.name === 'run_registered_command') {
              const result = this.route.run(args.projectId, args.commandId, args.argv);
              this.reply(request.id, { isError: result.exitCode !== 0, content: [{ type: 'text', text: JSON.stringify(result) }] });
            } else this.error(request.id, -32602, 'Unknown tool');
          } catch (error) { this.reply(request.id, { isError: true, content: [{ type: 'text', text: `Command Runner route failed: ${error.message}` }] }); }
          break;
        }
        default: this.error(request.id, -32601, 'Unknown method');
      }
    } catch (error) { this.error(request.id, -32603, error.message); }
  }
  async serve() { for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) if (line.trim()) await this.handle(line); }
}

try {
  const [mode, profileDirectory, callerRole, ...args] = process.argv.slice(2);
  const route = new CommandRunnerRoute(profileDirectory, callerRole);
  if (mode === 'serve-mcp' && args.length === 0) await new CommandRunnerMcpServer(route).serve();
  else if (mode === 'check' && args.length === 1) { const project = route.project(args[0]); process.stdout.write(`COMMAND_RUNNER_ROUTE_READY: project=${args[0]} branch=${project.branch} allowed=${route.allowedCommands.join(',')}\n`); }
  else if (mode === 'run' && args.length >= 2) { const result = route.run(args[0], args[1], args.slice(2)); process.stdout.write(`${JSON.stringify(result)}\n`); if (result.exitCode !== 0) process.exitCode = result.exitCode || 1; }
  else if (mode === 'plan' && args.length === 1) process.stdout.write(`${route.plan(args[0])}\n`);
  else throw new Error('Usage: command-runner-route.mjs serve-mcp|check|run|plan PROFILE_DIRECTORY CALLER_ROLE ...');
} catch (error) { process.stderr.write(`COMMAND_RUNNER_ROUTE_BLOCKED: ${error.message}\n`); process.exitCode = 1; }
