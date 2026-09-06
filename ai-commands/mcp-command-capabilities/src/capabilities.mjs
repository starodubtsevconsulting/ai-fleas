import fs from 'node:fs';
import path from 'node:path';
import { CapabilityConfigError, ToolInputError } from './errors.mjs';
import { commandsRoot, isWithinPath, packageRoot, repoRoot } from './paths.mjs';
import { envFromAllowlist, normalizePolicy, spawnBounded, withRuntimeTmp } from './executor.mjs';

const EMPTY_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {},
  additionalProperties: false
});

const DISCUSSION_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      maxLength: 120
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
      default: 3
    }
  },
  required: ['query'],
  additionalProperties: false
});

const INIT_PROMPT_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    task: {
      type: 'string',
      minLength: 1,
      maxLength: 160
    },
    scope: {
      type: 'string',
      minLength: 1,
      maxLength: 160
    },
    extra: {
      type: 'string',
      minLength: 1,
      maxLength: 240
    }
  },
  additionalProperties: false
});

const BACKENDS = Object.freeze({
  codeStyle: {
    definitionPath: 'code-style/code-style.command.md',
    implementationPath: 'code-style/code-style.sh',
    command: 'bash'
  },
  initPrompt: {
    definitionPath: 'init-prompt/init-prompt.command.md',
    implementationPath: 'init-prompt/init-prompt.sh',
    command: 'bash'
  },
  discussionLookup: {
    definitionPath: 'discussion/discussion.command.md',
    implementationPath: 'discussion/discussion_index.py',
    command: 'python3'
  },
  accountingTaxes: {
    definitionPath: 'taxes/taxes.command.md',
    implementationPath: 'taxes/taxes.command.sh',
    command: 'bash'
  }
});

function failConfig(message) {
  throw new CapabilityConfigError(message);
}

function failInput(message) {
  throw new ToolInputError(message);
}

function assertNoExtraKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      failInput(`${label} rejects unsupported argument: ${key}`);
    }
  }
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failInput(`${label} must be an object`);
  }
}

function assertSafeWorkflowId(workflowId) {
  if (typeof workflowId !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(workflowId)) {
    failConfig('workflowId must be a safe lowercase identifier');
  }
}

function resolveBackend(backend) {
  const implementationPath = path.resolve(commandsRoot, backend.implementationPath);
  const definitionPath = path.resolve(commandsRoot, backend.definitionPath);
  for (const [label, target] of Object.entries({ implementationPath, definitionPath })) {
    if (!isWithinPath(target, commandsRoot)) {
      failConfig(`${label} escapes ai-commands root`);
    }
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      failConfig(`${label} must be a non-symlink file`);
    }
  }
  return {
    implementationPath,
    definitionPath,
    command: backend.command
  };
}

function assertTrustedDirectory(rawPath, label) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.includes('\0')) {
    failConfig(`${label} must be a non-empty trusted directory path`);
  }
  const resolved = path.resolve(rawPath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    failConfig(`${label} must be a non-symlink directory`);
  }
  return fs.realpathSync(resolved);
}

function mountContext(context) {
  if (!context || typeof context !== 'object') {
    failConfig('mount context is required');
  }
  assertSafeWorkflowId(context.workflowId);
  return {
    workflowId: context.workflowId,
    policy: normalizePolicy(context.executionPolicy),
    config: context.config ?? {},
    providers: context.providers ?? {}
  };
}

function toolEnvelope({ workflowId, capability, toolName, result, argv }) {
  return {
    schemaVersion: 'workflow-command-capability-result.v1',
    workflow: {
      id: workflowId
    },
    capabilityId: capability.id,
    capabilityVersion: capability.version,
    tool: toolName,
    pluginId: capability.id,
    adapter: capability.adapter,
    argvShape: {
      command: argv.command,
      argc: argv.argv.length,
      shell: false
    },
    ...result
  };
}

function mountedTool({ capability, context, descriptor, invokeBackend }) {
  return {
    name: descriptor.name,
    title: descriptor.title,
    description: descriptor.description,
    inputSchema: descriptor.inputSchema,
    metadata: {
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      workflowId: context.workflowId,
      route: descriptor.route,
      profile: descriptor.profile,
      readOnly: true
    },
    async invoke(input = {}, requestContext = {}) {
      if (requestContext.workflowId && requestContext.workflowId !== context.workflowId) {
        failInput(`request workflow ${requestContext.workflowId} cannot invoke tool mounted for ${context.workflowId}`);
      }
      return invokeBackend(input, requestContext);
    }
  };
}

export function codeStyleCapability() {
  const backend = resolveBackend(BACKENDS.codeStyle);
  const capability = {
    id: 'code-style',
    version: '1.0.0',
    adapter: 'code_style_checklist',
  };
  return {
    ...capability,
    mount(context) {
      const mounted = mountContext(context);
      const toolName = mounted.config.toolName ?? 'workflow.code_style_checklist.v1';
      return [mountedTool({
        capability,
        context: mounted,
        descriptor: {
          name: toolName,
          title: mounted.config.title ?? 'Code-style checklist',
          description: mounted.config.description ?? 'Runs the mounted code-style checklist backend with no client-supplied arguments.',
          inputSchema: EMPTY_INPUT_SCHEMA,
          route: mounted.config.route ?? { role: 'command-runner', portion: 'default' },
          profile: mounted.config.profile ?? { id: 'read-only-command', level: 'read-only' }
        },
        async invokeBackend(input, requestContext) {
          requirePlainObject(input, toolName);
          assertNoExtraKeys(input, [], toolName);
          const argv = {
            command: backend.command,
            argv: [backend.implementationPath, '--project-dir', repoRoot, '--', 'noop']
          };
          const result = await spawnBounded(argv.command, argv.argv, {
            cwd: packageRoot,
            env: envFromAllowlist(mounted.policy.envAllowlist),
            timeoutMs: mounted.policy.timeoutMs,
            maxStdoutBytes: mounted.policy.maxStdoutBytes,
            maxStderrBytes: mounted.policy.maxStderrBytes,
            signal: requestContext.signal
          });
          return toolEnvelope({ workflowId: mounted.workflowId, capability, toolName, result, argv });
        }
      })];
    }
  };
}

function boundedSemanticText(input, key, limit) {
  const value = input[key];
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > limit) {
    failInput(`${key} must be non-empty bounded text`);
  }
  if (/[\0\r\n`$<>|;&]/.test(value)) {
    failInput(`${key} contains unsupported control or shell metacharacters`);
  }
  return value.trim();
}

export function initPromptCapability() {
  const backend = resolveBackend(BACKENDS.initPrompt);
  const capability = {
    id: 'init-prompt',
    version: '1.0.0',
    adapter: 'init_prompt',
  };
  return {
    ...capability,
    mount(context) {
      const mounted = mountContext(context);
      const toolName = mounted.config.toolName ?? 'workflow.init_prompt.v1';
      const projectDir = path.resolve(mounted.config.projectDir ?? repoRoot);
      const projectLabel = mounted.config.projectLabel ?? 'example-project';
      if (!fs.existsSync(projectDir) || !fs.lstatSync(projectDir).isDirectory()) {
        failConfig('init-prompt projectDir must be a fixed workflow-supplied existing directory');
      }
      if (typeof projectLabel !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/.test(projectLabel)) {
        failConfig('init-prompt projectLabel must be fixed bounded display text');
      }
      return [mountedTool({
        capability,
        context: mounted,
        descriptor: {
          name: toolName,
          title: mounted.config.title ?? 'Init prompt',
          description: mounted.config.description ?? 'Generates a deterministic startup prompt using workflow-supplied project identity and bounded semantic text.',
          inputSchema: INIT_PROMPT_INPUT_SCHEMA,
          route: mounted.config.route ?? { role: 'command-runner', portion: 'default' },
          profile: mounted.config.profile ?? { id: 'read-only-command', level: 'read-only' }
        },
        async invokeBackend(input, requestContext) {
          requirePlainObject(input, toolName);
          assertNoExtraKeys(input, ['task', 'scope', 'extra'], toolName);
          const argvItems = [backend.implementationPath, '--project-dir', projectDir, '--project-label', projectLabel];
          for (const [flag, key, limit] of [
            ['--task', 'task', 160],
            ['--scope', 'scope', 160],
            ['--extra', 'extra', 240]
          ]) {
            const value = boundedSemanticText(input, key, limit);
            if (value !== null) {
              argvItems.push(flag, value);
            }
          }
          const argv = {
            command: backend.command,
            argv: argvItems
          };
          const result = await spawnBounded(argv.command, argv.argv, {
            cwd: packageRoot,
            env: envFromAllowlist(mounted.policy.envAllowlist),
            timeoutMs: mounted.policy.timeoutMs,
            maxStdoutBytes: mounted.policy.maxStdoutBytes,
            maxStderrBytes: mounted.policy.maxStderrBytes,
            signal: requestContext.signal
          });
          return toolEnvelope({ workflowId: mounted.workflowId, capability, toolName, result, argv });
        }
      })];
    }
  };
}

export function discussionLookupCapability() {
  const backend = resolveBackend(BACKENDS.discussionLookup);
  const capability = {
    id: 'discussion-lookup',
    version: '1.0.0',
    adapter: 'discussion_fixture_lookup',
  };
  return {
    ...capability,
    mount(context) {
      const mounted = mountContext(context);
      const toolName = mounted.config.toolName ?? 'workflow.discussion_fixture_lookup.v1';
      const dataRoot = assertTrustedDirectory(mounted.providers.dataRoot, 'discussion providers.dataRoot');
      if (mounted.providers.dbPath !== undefined) {
        failConfig('discussion lookup dbPath is server-owned runtime state and is not injectable by clients');
      }
      return [mountedTool({
        capability,
        context: mounted,
        descriptor: {
          name: toolName,
          title: mounted.config.title ?? 'Discussion lookup',
          description: mounted.config.description ?? 'Looks up bounded workflow-owned discussion data through the mounted discussion helper.',
          inputSchema: DISCUSSION_INPUT_SCHEMA,
          route: mounted.config.route ?? { role: 'command-runner', portion: 'default' },
          profile: mounted.config.profile ?? { id: 'fixture-read-only-command', level: 'fixture-read-only' }
        },
        async invokeBackend(input, requestContext) {
          requirePlainObject(input, toolName);
          assertNoExtraKeys(input, ['query', 'limit'], toolName);
          if (typeof input.query !== 'string' || input.query.trim().length === 0) {
            failInput('query must be a non-empty string');
          }
          if (input.query.length > 120) {
            failInput('query must be at most 120 characters');
          }
          if (/[\0\r\n`$<>|;&]/.test(input.query)) {
            failInput('query contains unsupported control or shell metacharacters');
          }
          const limit = input.limit === undefined ? 3 : input.limit;
          if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
            failInput('limit must be an integer from 1 to 5');
          }
          return withRuntimeTmp('mcp-command-discussion-', async (runtimeTmp) => {
            const argv = {
              command: backend.command,
              argv: [
                backend.implementationPath,
                'lookup',
                '--db',
                path.join(runtimeTmp, 'discussion-index.sqlite'),
                '--root',
                dataRoot,
                '--query',
                input.query.trim(),
                '--limit',
                String(limit),
                '--json',
                '--no-index'
              ]
            };
            const result = await spawnBounded(argv.command, argv.argv, {
              cwd: packageRoot,
              env: envFromAllowlist(mounted.policy.envAllowlist),
              timeoutMs: mounted.policy.timeoutMs,
              maxStdoutBytes: mounted.policy.maxStdoutBytes,
              maxStderrBytes: mounted.policy.maxStderrBytes,
              signal: requestContext.signal
            });
            let structured = null;
            if (result.ok) {
              structured = JSON.parse(result.stdout);
            }
            return {
              ...toolEnvelope({ workflowId: mounted.workflowId, capability, toolName, result, argv }),
              structured
            };
          });
        }
      })];
    }
  };
}

export function accountingTaxesUsageCapability() {
  const backend = resolveBackend(BACKENDS.accountingTaxes);
  const capability = {
    id: 'accounting-taxes-usage',
    version: '1.0.0',
    adapter: 'accounting_taxes_usage'
  };
  return {
    ...capability,
    mount(context) {
      const mounted = mountContext(context);
      const toolName = mounted.config.toolName ?? 'workflow.financial_insights.taxes_usage.v1';
      return [mountedTool({
        capability,
        context: mounted,
        descriptor: {
          name: toolName,
          title: mounted.config.title ?? 'Accounting taxes command usage',
          description: mounted.config.description ?? 'Shows the managed accounting taxes command usage without reading reports or creating artifacts.',
          inputSchema: EMPTY_INPUT_SCHEMA,
          route: mounted.config.route ?? { role: 'command-runner', portion: 'default' },
          profile: mounted.config.profile ?? { id: 'accounting-command-usage', level: 'read-only' }
        },
        async invokeBackend(input, requestContext) {
          requirePlainObject(input, toolName);
          assertNoExtraKeys(input, [], toolName);
          const argv = {
            command: backend.command,
            argv: [backend.implementationPath, 'summary', '--help']
          };
          const result = await spawnBounded(argv.command, argv.argv, {
            cwd: packageRoot,
            // The legacy command's tracked defaults reference HOME before it
            // parses --help. Use a fixed inert value so MCP does not inherit
            // a user report location or source a user-local configuration.
            env: { ...envFromAllowlist(mounted.policy.envAllowlist), HOME: '/nonexistent' },
            timeoutMs: mounted.policy.timeoutMs,
            maxStdoutBytes: mounted.policy.maxStdoutBytes,
            maxStderrBytes: mounted.policy.maxStderrBytes,
            signal: requestContext.signal
          });
          return toolEnvelope({ workflowId: mounted.workflowId, capability, toolName, result, argv });
        }
      })];
    }
  };
}

export function availableCapabilities() {
  return new Map([
    ['code-style', codeStyleCapability()],
    ['init-prompt', initPromptCapability()],
    ['discussion-lookup', discussionLookupCapability()],
    ['accounting-taxes-usage', accountingTaxesUsageCapability()]
  ]);
}

export function mountCapabilities({ workflowId, mounts, providers = {}, executionPolicy = {}, registry = availableCapabilities() }) {
  if (!Array.isArray(mounts) || mounts.length === 0) {
    failConfig('workflow composition must mount at least one capability');
  }
  const mountedTools = [];
  const names = new Set();
  for (const entry of mounts) {
    const capability = registry.get(entry.capabilityId);
    if (!capability) {
      failConfig(`unknown command capability: ${entry.capabilityId}`);
    }
    const provider = providers[entry.providerRef] ?? providers[entry.capabilityId] ?? {};
    const tools = capability.mount({
      workflowId,
      config: entry.config ?? {},
      providers: provider,
      executionPolicy: entry.executionPolicy ?? executionPolicy
    });
    for (const tool of tools) {
      if (names.has(tool.name)) {
        failConfig(`duplicate MCP tool name in workflow composition: ${tool.name}`);
      }
      names.add(tool.name);
      mountedTools.push(tool);
    }
  }
  return mountedTools;
}

export const schemas = Object.freeze({
  EMPTY_INPUT_SCHEMA,
  INIT_PROMPT_INPUT_SCHEMA,
  DISCUSSION_INPUT_SCHEMA
});
