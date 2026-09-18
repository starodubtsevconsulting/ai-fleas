#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(here, '..');
const publicRoot = path.resolve(workflowRoot, '../..');
const portablePath = path.join(workflowRoot, 'agents.yml');
const gptPath = path.join(publicRoot, 'platforms/gpt-agents/workflows/writing/agents.yml');
const portable = parse(fs.readFileSync(portablePath, 'utf8'));
const gpt = parse(fs.readFileSync(gptPath, 'utf8'));
const roster = [portable.initializer, ...portable.agents];
const ids = roster.map(({ agentId }) => agentId);
const expected = ['admin', 'judge', 'writer', 'reviewer', 'release-coordinator'];

assert.equal(portable.workflowId, 'writing');
assert.equal(gpt.workflow, 'writing');
assert.deepEqual(ids, expected);
assert.deepEqual(gpt.agents.map(({ role }) => role), expected);
assert.deepEqual(Object.keys(gpt.role_contracts), expected);
assert.equal(new Set(roster.map(({ readinessToken }) => readinessToken)).size, expected.length);
assert.ok(roster.every(({ scope, schedule }) => scope === 'workflow' && schedule?.enabled === false));
assert.equal(portable.policy.routing, 'agents/editorial-routing.md');
assert.equal(roster.find(({ agentId }) => agentId === 'writer')?.communicationMode,
  'human-dialogue-and-canonical-packets');
assert.equal(roster.find(({ agentId }) => agentId === 'reviewer')?.communicationMode,
  'human-dialogue-and-canonical-packets');
assert.equal(roster.find(({ agentId }) => agentId === 'judge')?.communicationMode,
  'direct-human-governance-only');
assert.equal(roster.find(({ agentId }) => agentId === 'release-coordinator')?.communicationMode,
  'direct-human-only');
assert.deepEqual(portable.dependencies, [
  { consumerAgentId: 'writer', providerAgentId: 'reviewer', kind: 'capability-provider',
    requirement: 'capability-bound', capabilities: ['independent_critique'] },
  { consumerAgentId: 'reviewer', providerAgentId: 'writer', kind: 'return-coordinator',
    requirement: 'capability-bound', capabilities: ['critique_disposition'] },
]);

for (const relative of [portable.teamPolicy, ...Object.values(portable.policy)]) {
  assert.ok(fs.existsSync(path.resolve(workflowRoot, relative)), `missing portable policy: ${relative}`);
}
for (const member of roster) {
  const rolePath = path.resolve(workflowRoot, member.roleDefinition);
  assert.ok(fs.existsSync(rolePath), `missing role: ${member.agentId}`);
}
for (const [role, relative] of Object.entries(gpt.role_contracts)) {
  assert.ok(fs.existsSync(path.resolve(path.dirname(gptPath), relative)), `missing GPT role contract: ${role}`);
}
for (const field of ['initialization', 'portable_contract', 'portable_manifest', 'team_policy']) {
  assert.ok(fs.existsSync(path.resolve(path.dirname(gptPath), gpt[field])), `missing GPT ${field}`);
}

function matrix(relative, rowKey) {
  const lines = fs.readFileSync(path.resolve(workflowRoot, relative), 'utf8').trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  assert.deepEqual(header, [rowKey, ...roster.map(({ matrixColumn }) => matrixColumn)]);
  const rows = new Map();
  for (const line of lines) {
    const cells = line.split(',');
    assert.equal(cells.length, header.length, `matrix width: ${line}`);
    assert.ok(cells[0] && !rows.has(cells[0]), `duplicate/empty matrix row: ${line}`);
    rows.set(cells[0], cells.slice(1));
  }
  return rows;
}

const capabilities = matrix(portable.policy.capabilityOwnershipMatrix, 'capability');
for (const [name, cells] of capabilities) {
  assert.ok(cells.every((cell) => ['OWN', 'PROHIBITED'].includes(cell)), `invalid capability: ${name}`);
  assert.ok(cells.filter((cell) => cell === 'OWN').length <= 1, `multiple owners: ${name}`);
}
assert.ok(capabilities.get('publication_or_scheduling')?.every((cell) => cell === 'PROHIBITED'));
assert.deepEqual(capabilities.get('review_assignment'), ['PROHIBITED', 'PROHIBITED', 'OWN', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(capabilities.get('review_findings_return'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN', 'PROHIBITED']);

const routes = matrix(portable.policy.communicationMatrix, 'route');
for (const [name, cells] of routes) {
  assert.ok(cells.every((cell) => ['AUTHORIZED', 'PROHIBITED'].includes(cell)), `invalid route: ${name}`);
}
assert.deepEqual([...routes.keys()], [
  'human_to_admin', 'human_to_judge', 'human_to_writer', 'human_to_reviewer',
  'human_to_release_coordinator', 'writer_to_reviewer', 'reviewer_to_writer',
]);
for (const [index, id] of expected.entries()) {
  const route = routes.get(`human_to_${roster[index].matrixColumn}`);
  assert.ok(route, `missing human route: ${id}`);
  assert.equal(route.filter((cell) => cell === 'AUTHORIZED').length, 1);
  assert.equal(route[index], 'AUTHORIZED');
}
assert.deepEqual(routes.get('writer_to_reviewer'),
  ['PROHIBITED', 'PROHIBITED', 'AUTHORIZED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(routes.get('reviewer_to_writer'),
  ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'AUTHORIZED', 'PROHIBITED']);

console.log('Writing managed-agent roster: PASS');
