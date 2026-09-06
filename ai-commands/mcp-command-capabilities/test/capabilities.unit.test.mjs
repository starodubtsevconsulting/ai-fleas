import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {
  codeStyleCapability,
  initPromptCapability,
  discussionLookupCapability,
  accountingTaxesUsageCapability,
  mountCapabilities
} from '../src/capabilities.mjs';
import { spawnBounded } from '../src/executor.mjs';
import { normalizePolicy } from '../src/executor.mjs';

function writeFixture(root, name, body) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, name), body);
}

test('shared capabilities mount as reusable tool providers with no copied schema per workflow', () => {
  const tools = mountCapabilities({
    workflowId: 'dev',
    mounts: [
      { capabilityId: 'code-style', config: { toolName: 'workflow.code_style_checklist.v1' } },
      { capabilityId: 'init-prompt', config: { toolName: 'workflow.init_prompt.v1' } }
    ],
    executionPolicy: { envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }
  });
  assert.deepEqual(tools.map((tool) => tool.name), [
    'workflow.code_style_checklist.v1',
    'workflow.init_prompt.v1'
  ]);
  assert.equal(tools[0].metadata.capabilityId, 'code-style');
  assert.equal(tools[1].inputSchema.additionalProperties, false);
});

test('composition rejects unknown capability and duplicate mounted tool names', () => {
  assert.throws(
    () => mountCapabilities({
      workflowId: 'dev',
      mounts: [{ capabilityId: 'bug-fix' }]
    }),
    /unknown command capability/
  );

  assert.throws(
    () => mountCapabilities({
      workflowId: 'dev',
      mounts: [
        { capabilityId: 'code-style', config: { toolName: 'workflow.same.v1' } },
        { capabilityId: 'init-prompt', config: { toolName: 'workflow.same.v1' } }
      ]
    }),
    /duplicate MCP tool name/
  );
});

test('code-style rejects extras and succeeds through fixed harmless wrapper argv', async () => {
  const [tool] = codeStyleCapability().mount({
    workflowId: 'dev',
    config: { toolName: 'workflow.code_style_checklist.v1' },
    executionPolicy: { envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }
  });
  await assert.rejects(() => tool.invoke({ root: '/tmp' }), /unsupported argument/);
  const result = await tool.invoke({});
  assert.equal(result.ok, true);
  assert.equal(result.argvShape.shell, false);
  assert.equal(result.errorCode, null);
  assert.match(result.stdout, /code-style\.command\.md/);
});

test('init-prompt exposes bounded semantic text only and succeeds through fixed workflow project identity', async () => {
  const [tool] = initPromptCapability().mount({
    workflowId: 'dev',
    config: {
      toolName: 'workflow.init_prompt.v1',
      projectDir: path.resolve('../..'),
      projectLabel: 'example-project'
    },
    executionPolicy: { envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }
  });
  await assert.rejects(() => tool.invoke({ projectDir: '/tmp' }), /unsupported argument/);
  await assert.rejects(() => tool.invoke({ task: 'bad;rm' }), /shell metacharacters/);
  const result = await tool.invoke({
    task: 'Validate MCP init prompt',
    scope: 'Part 1',
    extra: 'No filesystem discovery fallback'
  });
  assert.equal(result.argvShape.shell, false);
  assert.equal(result.argvShape.command, 'bash');
  assert.equal(result.ok, true);
  assert.match(result.stdout, /Project already selected: example-project/);
  assert.match(result.stdout, /Session task: Validate MCP init prompt/);
});

test('accounting taxes usage runs the managed shell command with fixed harmless argv', async () => {
  const [tool] = accountingTaxesUsageCapability().mount({
    workflowId: 'accounting',
    config: { toolName: 'workflow.accounting.taxes_usage.v1' },
    executionPolicy: { envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }
  });
  await assert.rejects(() => tool.invoke({ reportsRoot: '/tmp' }), /unsupported argument/);
  const result = await tool.invoke({});
  assert.equal(result.ok, true);
  assert.equal(result.workflow.id, 'accounting');
  assert.equal(result.capabilityId, 'accounting-taxes-usage');
  assert.equal(result.argvShape.command, 'bash');
  assert.match(result.stdout, /taxes\.command\.sh summary/);
});

test('one discussion adapter mounts into two fixture workflows with isolated providers/results', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-capability-reuse-'));
  try {
    const rootA = path.join(tmp, 'workflow-a');
    const rootB = path.join(tmp, 'workflow-b');
    writeFixture(rootA, 'summary.md', '# Alpha Fixture\n\nalpha-only capability boundary result.\n');
    writeFixture(rootB, 'summary.md', '# Beta Fixture\n\nbeta-only capability boundary result.\n');

    const adapter = discussionLookupCapability();
    const [toolA] = adapter.mount({
      workflowId: 'alpha',
      config: { toolName: 'alpha.discussion_lookup.v1' },
      providers: { dataRoot: rootA },
      executionPolicy: { envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }
    });
    const [toolB] = adapter.mount({
      workflowId: 'beta',
      config: { toolName: 'beta.discussion_lookup.v1' },
      providers: { dataRoot: rootB },
      executionPolicy: { envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }
    });

    const resultA = await toolA.invoke({ query: 'alpha-only', limit: 3 }, { workflowId: 'alpha' });
    const resultB = await toolB.invoke({ query: 'beta-only', limit: 3 }, { workflowId: 'beta' });
    assert.equal(resultA.ok, true);
    assert.equal(resultB.ok, true);
    assert.equal(resultA.tool, 'alpha.discussion_lookup.v1');
    assert.equal(resultB.tool, 'beta.discussion_lookup.v1');
    assert.equal(resultA.capabilityId, 'discussion-lookup');
    assert.equal(resultB.capabilityId, 'discussion-lookup');
    assert.match(resultA.stdout, /Alpha Fixture|alpha-only/);
    assert.doesNotMatch(resultA.stdout, /Beta Fixture|beta-only/);
    assert.match(resultB.stdout, /Beta Fixture|beta-only/);
    assert.doesNotMatch(resultB.stdout, /Alpha Fixture|alpha-only/);
    await assert.rejects(() => toolA.invoke({ query: 'alpha-only' }, { workflowId: 'beta' }), /cannot invoke tool mounted/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('discussion lookup rejects client-controlled roots/db and shell-like query input', () => {
  const existingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-capability-db-reject-'));
  try {
    assert.throws(
      () => discussionLookupCapability().mount({
        workflowId: 'dev',
        providers: { dataRoot: existingRoot, dbPath: '/tmp/client.sqlite' }
      }),
      /dbPath/
    );
  } finally {
    fs.rmSync(existingRoot, { recursive: true, force: true });
  }

  assert.throws(
    () => discussionLookupCapability().mount({
      workflowId: 'dev',
      providers: { dataRoot: '/definitely/missing' }
    }),
    /ENOENT|dataRoot/
  );
});

test('bounded executor enforces timeout and output limits without shell', async () => {
  const timeout = await spawnBounded(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'], {
    timeoutMs: 100,
    maxStdoutBytes: 1024,
    maxStderrBytes: 1024,
    env: {}
  });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.errorCode, 'EXECUTION_TIMEOUT');

  const output = await spawnBounded(process.execPath, ['-e', 'process.stdout.write("x".repeat(2000))'], {
    timeoutMs: 1000,
    maxStdoutBytes: 32,
    maxStderrBytes: 1024,
    env: {}
  });
  assert.equal(output.ok, true);
  assert.equal(output.stdout.length, 32);
  assert.equal(output.stdoutTruncated, true);
});

test('bounded executor escalates ignored SIGTERM to SIGKILL on timeout and cancellation', async () => {
  const ignoreTerm = 'process.on("SIGTERM",()=>{}); setInterval(()=>{}, 1000);';
  const timeout = await spawnBounded(process.execPath, ['-e', ignoreTerm], {
    timeoutMs: 100,
    killGraceMs: 100,
    maxStdoutBytes: 1024,
    maxStderrBytes: 1024,
    env: {}
  });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.errorCode, 'EXECUTION_TIMEOUT');
  assert.equal(timeout.timedOut, true);
  assert.equal(timeout.signal, 'SIGKILL');

  const controller = new AbortController();
  const pending = spawnBounded(process.execPath, ['-e', ignoreTerm], {
    timeoutMs: 5000,
    killGraceMs: 100,
    maxStdoutBytes: 1024,
    maxStderrBytes: 1024,
    env: {},
    signal: controller.signal
  });
  setTimeout(() => controller.abort(), 50);
  const cancelled = await pending;
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.errorCode, 'EXECUTION_CANCELLED');
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.signal, 'SIGKILL');
});

test('bounded executor handles already-aborted cancellation without normal completion', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await spawnBounded(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'], {
    timeoutMs: 5000,
    killGraceMs: 100,
    maxStdoutBytes: 1024,
    maxStderrBytes: 1024,
    env: {},
    signal: controller.signal
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'EXECUTION_CANCELLED');
  assert.equal(result.cancelled, true);
  assert.equal(['SIGTERM', 'SIGKILL'].includes(result.signal), true);
  assert.equal(result.durationMs < 1500, true);
});

test('execution policy rejects injection-capable environment variables', () => {
  for (const key of ['NODE_OPTIONS', 'BASH_ENV', 'ENV', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'PYTHONPATH', 'PERL5OPT', 'RUBYOPT']) {
    assert.throws(() => normalizePolicy({ envAllowlist: ['PATH', key] }), /not approved|secret-like|unsafe/);
  }
  assert.deepEqual(normalizePolicy({ envAllowlist: ['PATH', 'LANG', 'LC_ALL'] }).envAllowlist, ['PATH', 'LANG', 'LC_ALL']);
});
