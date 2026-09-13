import assert from 'node:assert/strict';
import test from 'node:test';
import { createToolRegistry } from '../src/registry.mjs';
import { startWorkflowHttpMcpServer } from '../src/http-server.mjs';

function registryWithPrivateWorkflow() {
  return createToolRegistry({
    workflow: {
      id: 'fixture',
      version: '1.2.3',
      purpose: 'private purpose text',
      backend: { argv: ['node', 'server.mjs'] },
      provider: { dataRoot: '/secret/provider/root' },
      credentials: { token: 'do-not-leak' },
      nested: {
        environment: { API_KEY: 'secret' }
      }
    },
    tools: [
      {
        name: 'workflow.fixture.v1',
        title: 'Fixture Tool',
        description: 'Public fixture operation.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {}
        },
        publicClassification: { capabilityKind: 'command-extension', definitionOwner: 'ai-command', scope: 'reusable' },
        invoke: async () => ({ ok: true })
      }
    ]
  });
}

test('registry permits only complete approved public annotations for native tools', () => {
  const annotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
  const registry = createToolRegistry({
    workflow: { id: 'fixture', version: '1.0.0' },
    tools: [
      { name: 'workflow.native.v1', title: 'Native', description: 'Native tool', inputSchema: {}, native: true, publicAnnotations: { ...annotations, backend: 'private' }, publicClassification: { capabilityKind: 'workflow-common', definitionOwner: 'workflow-common', scope: 'all-workflows' }, invoke: async () => ({ ok: true }) }
    ]
  });
  assert.throws(() => registry.listTools(), /invalid public annotations/);
  const valid = createToolRegistry({
    workflow: { id: 'fixture', version: '1.0.0' },
    tools: [{ name: 'workflow.native.v1', title: 'Native', description: 'Native tool', inputSchema: {}, native: true, publicAnnotations: annotations, publicClassification: { capabilityKind: 'workflow-common', definitionOwner: 'workflow-common', scope: 'all-workflows' }, invoke: async () => ({ ok: true }) }]
  });
  assert.deepEqual(valid.listTools()[0].annotations, annotations);
  const mounted = createToolRegistry({
    workflow: { id: 'fixture', version: '1.0.0' },
    tools: [{ name: 'workflow.mounted.v1', title: 'Mounted', description: 'Mounted tool', inputSchema: {}, publicAnnotations: annotations, publicClassification: { capabilityKind: 'command-extension', definitionOwner: 'ai-command', scope: 'reusable' }, invoke: async () => ({ ok: true }) }]
  });
  assert.deepEqual(mounted.listTools()[0].annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
});

test('browser tools endpoint exposes exact public schema without raw workflow metadata', async () => {
  const running = await startWorkflowHttpMcpServer({
    registry: registryWithPrivateWorkflow(),
    host: '127.0.0.1',
    port: 0
  });
  try {
    const response = await fetch(new URL('/tools', running.url));
    assert.equal(response.ok, true);
    const body = await response.json();

    assert.deepEqual(Object.keys(body).sort(), [
      'capabilityGroups', 'mountedToolCount',
      'ok',
      'tools',
      'transport',
      'workflow'
    ].sort());
    assert.deepEqual(Object.keys(body.workflow).sort(), ['id', 'version']);
    assert.deepEqual(body.workflow, { id: 'fixture', version: '1.2.3' });
    assert.equal(body.mountedToolCount, 1);
    assert.equal(body.tools.length, 1);
    assert.deepEqual(Object.keys(body.tools[0]).sort(), [
      'annotations',
      'description',
      'inputSchema',
      'name',
      'title', 'classification'
    ].sort());
    const serialized = JSON.stringify(body);
    for (const forbidden of [
      'private purpose text',
      'backend',
      'argv',
      'provider',
      'dataRoot',
      'credentials',
      'token',
      'environment',
      'API_KEY',
      'secret'
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  } finally {
    await running.close();
  }
});

test('browser tools endpoint rejects non-GET methods without invoking tools', async () => {
  let invoked = false;
  const registry = createToolRegistry({
    workflow: { id: 'fixture', version: '1.2.3' },
    tools: [
      {
        name: 'workflow.fixture.v1',
        title: 'Fixture Tool',
        description: 'Public fixture operation.',
        inputSchema: { type: 'object', additionalProperties: false },
        publicClassification: { capabilityKind: 'command-extension', definitionOwner: 'ai-command', scope: 'reusable' },
        invoke: async () => {
          invoked = true;
          return { ok: true };
        }
      }
    ]
  });
  const running = await startWorkflowHttpMcpServer({
    registry,
    host: '127.0.0.1',
    port: 0
  });
  try {
    for (const method of ['POST', 'PUT']) {
      const response = await fetch(new URL('/tools', running.url), { method });
      assert.equal(response.status, 404, method);
      const body = await response.json();
      assert.deepEqual(body, { ok: false, errorCode: 'NOT_FOUND' });
    }
    assert.equal(invoked, false);
  } finally {
    await running.close();
  }
});

test('workflow-specific provenance is bound to the registry workflow, not Development', () => {
  const tool = { name: 'workflow.billing.v1', title: 'Billing', description: 'Billing', inputSchema: {}, publicClassification: { capabilityKind: 'workflow-specific', definitionOwner: 'workflow:billing', scope: 'billing' }, invoke: async () => ({ ok: true }) };
  const registry = createToolRegistry({ workflow: { id: 'billing', version: '1.0.0' }, tools: [tool] });
  assert.deepEqual(registry.publicToolGroups()[2], { id: 'workflowSpecific', capabilityKind: 'workflow-specific', definitionOwner: 'workflow:billing', scope: 'billing', toolCount: 1, toolNames: ['workflow.billing.v1'] });
  assert.throws(() => createToolRegistry({ workflow: { id: 'billing', version: '1.0.0' }, tools: [{ ...tool, publicClassification: { capabilityKind: 'workflow-specific', definitionOwner: 'workflow:dev', scope: 'dev' } }] }), /invalid public classification/);
});

test('registry validates every public classification at construction', () => {
  const base = { title: 'Tool', description: 'Tool', inputSchema: {}, invoke: async () => ({ ok: true }) };
  const registry = createToolRegistry({
    workflow: { id: 'fixture', version: '1.0.0' },
    tools: [
      { ...base, name: 'workflow.command.v1', publicClassification: { capabilityKind: 'command-extension', definitionOwner: 'ai-command', scope: 'reusable' } },
      { ...base, name: 'workflow.common.v1', publicClassification: { capabilityKind: 'workflow-common', definitionOwner: 'workflow-common', scope: 'all-workflows' } },
      { ...base, name: 'workflow.specific.v1', publicClassification: { capabilityKind: 'workflow-specific', definitionOwner: 'workflow:fixture', scope: 'fixture' } },
    ]
  });
  assert.deepEqual(registry.publicToolGroups().map(({ id, toolCount }) => ({ id, toolCount })), [
    { id: 'commandExtensions', toolCount: 1 },
    { id: 'workflowCommon', toolCount: 1 },
    { id: 'workflowSpecific', toolCount: 1 },
  ]);
  assert.throws(() => createToolRegistry({ workflow: { id: 'fixture', version: '1.0.0' }, tools: [{ ...base, name: 'workflow.missing.v1' }] }), /invalid public classification/);
  for (const publicClassification of [
    { capabilityKind: 'command-extension', definitionOwner: 'workflow-common', scope: 'reusable' },
    { capabilityKind: 'workflow-common', definitionOwner: 'workflow-common', scope: 'reusable' },
    { capabilityKind: 'workflow-specific', definitionOwner: 'workflow:fixture', scope: 'other' },
    { capabilityKind: 'workflow-specific', definitionOwner: 'workflow:other', scope: 'fixture' },
    { capabilityKind: 'workflow-specific', definitionOwner: 'workflow:fixture', scope: 'fixture', backend: 'private' },
  ]) {
    assert.throws(() => createToolRegistry({ workflow: { id: 'fixture', version: '1.0.0' }, tools: [{ ...base, name: 'workflow.invalid.v1', publicClassification }] }), /invalid public classification/);
  }
});
