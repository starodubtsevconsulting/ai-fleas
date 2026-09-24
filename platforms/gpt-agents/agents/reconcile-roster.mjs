import fs from 'node:fs';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [inputFile] = process.argv.slice(2);
if (!inputFile) fail('usage: node reconcile-roster.mjs <inventory.json>');
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
if (!input.projectId) fail('inventory requires projectId');
if (!Array.isArray(input.roles) || !input.roles.length) fail('inventory requires a non-empty roles array');
if (!input.catalogs?.activeComplete || !input.catalogs?.archivedComplete) {
  process.stdout.write(`${JSON.stringify({
    mode: 'blocked',
    blockers: ['active and archived catalogs must both be enumerated to exhaustion'],
    reuse: [],
    reactivate: [],
    create: [],
    archive: [],
  }, null, 2)}\n`);
  process.exit(0);
}

const blockers = [];
const declaredRoles = new Set();
for (const role of input.roles) {
  if (typeof role !== 'string' || !role) blockers.push('declared roles must be non-empty strings');
  else if (declaredRoles.has(role)) blockers.push(`duplicate declared role: ${role}`);
  else declaredRoles.add(role);
}

const receipts = new Map();
const receiptTaskIds = new Set();
for (const receipt of input.receipts ?? []) {
  if (!declaredRoles.has(receipt.role)) {
    blockers.push(`receipt has undeclared role: ${receipt.role}`);
    continue;
  }
  if (!receipt.taskId) {
    blockers.push(`receipt for ${receipt.role} has no taskId`);
    continue;
  }
  if (receipts.has(receipt.role)) blockers.push(`duplicate receipt role: ${receipt.role}`);
  if (receiptTaskIds.has(receipt.taskId)) blockers.push(`duplicate receipt taskId: ${receipt.taskId}`);
  receipts.set(receipt.role, receipt);
  receiptTaskIds.add(receipt.taskId);
}

function indexCatalog(items, name) {
  const index = new Map();
  for (const item of items ?? []) {
    if (!item?.id) {
      blockers.push(`${name} catalog contains a task without id`);
      continue;
    }
    if (index.has(item.id)) blockers.push(`${name} catalog contains duplicate task: ${item.id}`);
    index.set(item.id, item);
  }
  return index;
}

const active = indexCatalog(input.catalogs.active, 'active');
const archived = indexCatalog(input.catalogs.archived, 'archived');
const reuse = [];
const reactivate = [];
const create = [];
const archive = [];

const retiredTaskIds = new Set();
for (const receipt of input.retiredReceipts ?? []) {
  if (!receipt?.role || !receipt?.taskId) {
    blockers.push('retired receipts require non-empty role and taskId');
    continue;
  }
  if (declaredRoles.has(receipt.role)) {
    blockers.push(`retired receipt role is still declared: ${receipt.role}`);
    continue;
  }
  if (receiptTaskIds.has(receipt.taskId) || retiredTaskIds.has(receipt.taskId)) {
    blockers.push(`duplicate retired receipt taskId: ${receipt.taskId}`);
    continue;
  }
  retiredTaskIds.add(receipt.taskId);
  const activeTask = active.get(receipt.taskId);
  const archivedTask = archived.get(receipt.taskId);
  if (activeTask && archivedTask) {
    blockers.push(`retired ${receipt.role} task appears in both active and archived catalogs: ${receipt.taskId}`);
    continue;
  }
  const task = activeTask ?? archivedTask;
  if (!task) {
    blockers.push(`retired ${receipt.role} task is absent from complete active and archived catalogs: ${receipt.taskId}`);
    continue;
  }
  if (task.projectId !== input.projectId) {
    blockers.push(`retired ${receipt.role} task ${receipt.taskId} is bound to project ${task.projectId ?? '(none)'}, expected ${input.projectId}`);
    continue;
  }
  if (activeTask) archive.push({ role: receipt.role, taskId: receipt.taskId });
}

for (const role of declaredRoles) {
  const receipt = receipts.get(role);
  if (!receipt) {
    create.push({ role, reason: 'no trusted receipt' });
    continue;
  }
  const activeTask = active.get(receipt.taskId);
  const archivedTask = archived.get(receipt.taskId);
  if (activeTask && archivedTask) {
    blockers.push(`${role} task appears in both active and archived catalogs: ${receipt.taskId}`);
    continue;
  }
  const task = activeTask ?? archivedTask;
  if (task && task.projectId !== input.projectId) {
    blockers.push(`${role} task ${receipt.taskId} is bound to project ${task.projectId ?? '(none)'}, expected ${input.projectId}`);
    continue;
  }
  if (activeTask) reuse.push({ role, taskId: receipt.taskId });
  else if (archivedTask) reactivate.push({ role, taskId: receipt.taskId });
  else create.push({ role, reason: 'receipt task absent from complete active and archived catalogs' });
}

const mode = blockers.length
  ? 'blocked'
  : reactivate.length === declaredRoles.size
    ? 'restore-all'
    : create.length
      ? 'create-missing'
      : reactivate.length || archive.length
        ? 'reconcile'
        : 'reuse-all';

process.stdout.write(`${JSON.stringify({ mode, blockers, reuse, reactivate, create, archive }, null, 2)}\n`);
