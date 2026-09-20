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
const writerRole = fs.readFileSync(path.join(here, 'roles/writer.md'), 'utf8');
const reviewerRole = fs.readFileSync(path.join(here, 'roles/reviewer.md'), 'utf8');
const releaseCoordinatorRole = fs.readFileSync(path.join(here, 'roles/release-coordinator.md'), 'utf8');
const routing = fs.readFileSync(path.join(here, 'editorial-routing.md'), 'utf8');
const destinationFlow = fs.readFileSync(path.join(workflowRoot, 'flows/destination-preparation.flow.md'), 'utf8');
const critiqueFlow = fs.readFileSync(path.join(workflowRoot, 'flows/independent-critique.flow.md'), 'utf8');
const releaseFlow = fs.readFileSync(path.join(workflowRoot, 'flows/release-planning.flow.md'), 'utf8');
const reviewCriteria = fs.readFileSync(path.join(workflowRoot, 'guides/review-criteria.md'), 'utf8');
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
assert.deepEqual(capabilities.get('medium_native_scheduling'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN']);
assert.ok(capabilities.get('immediate_publication_or_submission')?.every((cell) => cell === 'PROHIBITED'));
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

assert.match(destinationFlow, /must immediately send the[\s\S]*exact archived revision and exact destination draft/);
assert.match(destinationFlow, /does not\s+require a second human prompt/);
assert.match(destinationFlow, /BLOCKED_DESTINATION_REVIEW/);
assert.match(critiqueFlow, /A prior article-only disposition does not\s+review the later destination representation/);
assert.match(writerRole, /automatically send the exact destination draft to the verified Reviewer/);
assert.match(writerRole, /destination request is incomplete until the destination-specific disposition/);
assert.match(writerRole, /Writer owns header-image search/);
assert.match(writerRole, /fixed shortlist of no more than three/);
assert.match(writerRole, /Sending the shortlist to the human is not a Reviewer handoff/);
assert.match(routing, /new or materially changed destination draft[\s\S]*no\s+second human request is required/);
assert.match(reviewCriteria, /Source equivalence alone cannot clear\s+rendered-destination QA/);
assert.match(reviewCriteria, /large empty gap between its quotation and attribution/);
assert.match(reviewCriteria, /correctly rendered picture in the wrong part of the article is a review finding/);
assert.match(reviewCriteria, /Review the header or hero image separately as an editorial choice/);
assert.match(reviewCriteria, /prefer a recognizable NAS/);
assert.match(reviewCriteria, /Writer owns image search and supplies no more than three/);
assert.match(reviewCriteria, /explicit `accept` or `reject` verdict/);
assert.match(reviewCriteria, /human-facing Writer report is not an\s+input to Reviewer/);
assert.match(reviewCriteria, /claims a diagram but renders only\s+the words describing it/);
assert.match(destinationFlow, /direct rendered\s+evidence such as screenshots/);
assert.match(critiqueFlow, /Textual\s+equivalence or metadata read-back cannot substitute for this visual pass/);
assert.match(reviewerRole, /Source equivalence is not\s+visual QA/);
assert.match(reviewerRole, /For each picture,[\s\S]*editorial location supports the nearby passage/);
assert.match(reviewerRole, /Evaluate the header image independently[\s\S]*actual destination crop/);
assert.match(reviewerRole, /compare at most three authorized candidates and recommend exactly one/);
assert.match(reviewerRole, /Writer owns search and supplies the fixed shortlist/);
assert.match(reviewerRole, /Reconcile every claimed diagram[\s\S]*actually rendered visual/);
assert.match(routing, /direct visual evidence such as screenshots/);
assert.match(routing, /For every picture,[\s\S]*editorial location supports the nearby passage/);
assert.match(routing, /separate header-image finding[\s\S]*focal point survives/);
assert.match(routing, /Writer owns search[\s\S]*fixed shortlist of at most three/);
assert.match(routing, /Creating or changing a header-image shortlist automatically triggers delivery/);
assert.match(routing, /human-facing message[\s\S]*is not\s+peer delivery/);
assert.match(routing, /visual-presence reconciliation/);
assert.match(releaseCoordinatorRole, /Never treat Medium's default profile\/home as consent/);
assert.match(releaseCoordinatorRole, /author's profile\/home or one\s+named authorized Publication/);
assert.match(releaseFlow, /BLOCKED_PUBLICATION_TARGET/);
assert.match(releaseFlow, /silently fall back to profile\/home/);

console.log('Writing managed-agent roster: PASS');
