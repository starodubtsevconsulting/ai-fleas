import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const resolver = fileURLToPath(new URL('./reconcile-roster.mjs', import.meta.url));

function resolveInventory(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-agent-roster-'));
  const input = {
    projectId: 'project-1',
    roles: ['admin', 'judge', 'writer'],
    receipts: [
      { role: 'admin', taskId: 'task-admin' },
      { role: 'judge', taskId: 'task-judge' },
      { role: 'writer', taskId: 'task-writer' },
    ],
    catalogs: { activeComplete: true, archivedComplete: true, active: [], archived: [] },
    ...overrides,
  };
  const file = path.join(root, 'inventory.json');
  fs.writeFileSync(file, JSON.stringify(input));
  const result = spawnSync(process.execPath, [resolver, file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('a completely archived exact roster resolves to one restore-all operation', () => {
  const result = resolveInventory({
    catalogs: {
      activeComplete: true,
      archivedComplete: true,
      active: [],
      archived: [
        { id: 'task-admin', projectId: 'project-1' },
        { id: 'task-judge', projectId: 'project-1' },
        { id: 'task-writer', projectId: 'project-1' },
      ],
    },
  });
  assert.equal(result.mode, 'restore-all');
  assert.deepEqual(result.create, []);
  assert.deepEqual(result.reactivate.map(({ role }) => role), ['admin', 'judge', 'writer']);
});

test('mixed active and archived exact receipts reconcile without replacement', () => {
  const result = resolveInventory({
    catalogs: {
      activeComplete: true,
      archivedComplete: true,
      active: [{ id: 'task-admin', projectId: 'project-1' }],
      archived: [
        { id: 'task-judge', projectId: 'project-1' },
        { id: 'task-writer', projectId: 'project-1' },
      ],
    },
  });
  assert.equal(result.mode, 'reconcile');
  assert.deepEqual(result.create, []);
  assert.deepEqual(result.reuse, [{ role: 'admin', taskId: 'task-admin' }]);
});

test('a receipt absent from both complete catalogs is the only case that creates a role', () => {
  const result = resolveInventory({
    catalogs: {
      activeComplete: true,
      archivedComplete: true,
      active: [
        { id: 'task-admin', projectId: 'project-1' },
        { id: 'task-judge', projectId: 'project-1' },
      ],
      archived: [],
    },
  });
  assert.equal(result.mode, 'create-missing');
  assert.deepEqual(result.create, [{ role: 'writer', reason: 'receipt task absent from complete active and archived catalogs' }]);
});

test('incomplete archived enumeration blocks instead of creating duplicates', () => {
  const result = resolveInventory({
    catalogs: { activeComplete: true, archivedComplete: false, active: [], archived: [] },
  });
  assert.equal(result.mode, 'blocked');
  assert.match(result.blockers[0], /enumerated to exhaustion/);
  assert.deepEqual(result.create, []);
});

test('a receipt-backed task in a different project blocks instead of being adopted or replaced', () => {
  const result = resolveInventory({
    catalogs: {
      activeComplete: true,
      archivedComplete: true,
      active: [{ id: 'task-admin', projectId: 'different-project' }],
      archived: [
        { id: 'task-judge', projectId: 'project-1' },
        { id: 'task-writer', projectId: 'project-1' },
      ],
    },
  });
  assert.equal(result.mode, 'blocked');
  assert.match(result.blockers.join('\n'), /different-project/);
  assert.deepEqual(result.create, []);
});

test('a roster contraction archives every exact active receipt for the retired role', () => {
  const result = resolveInventory({
    roles: ['admin', 'writer'],
    receipts: [
      { role: 'admin', taskId: 'task-admin' },
      { role: 'writer', taskId: 'task-writer' },
    ],
    retiredReceipts: [
      { role: 'judge', taskId: 'task-judge-1' },
      { role: 'judge', taskId: 'task-judge-2' },
      { role: 'judge', taskId: 'task-judge-3' },
    ],
    catalogs: {
      activeComplete: true,
      archivedComplete: true,
      active: [
        { id: 'task-admin', projectId: 'project-1' },
        { id: 'task-writer', projectId: 'project-1' },
        { id: 'task-judge-1', projectId: 'project-1' },
        { id: 'task-judge-2', projectId: 'project-1' },
      ],
      archived: [{ id: 'task-judge-3', projectId: 'project-1' }],
    },
  });
  assert.equal(result.mode, 'reconcile');
  assert.deepEqual(result.archive, [
    { role: 'judge', taskId: 'task-judge-1' },
    { role: 'judge', taskId: 'task-judge-2' },
  ]);
  assert.deepEqual(result.create, []);
});

test('a retired receipt cannot name a role that remains declared', () => {
  const result = resolveInventory({
    retiredReceipts: [{ role: 'judge', taskId: 'old-judge' }],
  });
  assert.equal(result.mode, 'blocked');
  assert.match(result.blockers.join('\n'), /still declared/);
  assert.deepEqual(result.archive, []);
});
