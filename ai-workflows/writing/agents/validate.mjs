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
const adminRole = fs.readFileSync(path.join(here, 'roles/admin.md'), 'utf8');
const routing = fs.readFileSync(path.join(here, 'editorial-routing.md'), 'utf8');
const orchestration = fs.readFileSync(path.join(here, 'admin-orchestration.md'), 'utf8');
const destinationFlow = fs.readFileSync(path.join(workflowRoot, 'flows/destination-preparation.flow.md'), 'utf8');
const critiqueFlow = fs.readFileSync(path.join(workflowRoot, 'flows/independent-critique.flow.md'), 'utf8');
const releaseFlow = fs.readFileSync(path.join(workflowRoot, 'flows/release-planning.flow.md'), 'utf8');
const reviewCriteria = fs.readFileSync(path.join(workflowRoot, 'guides/review-criteria.md'), 'utf8');
const headerImageContract = fs.readFileSync(path.join(workflowRoot, 'guides/header-image-contract.md'), 'utf8');
const mediumDraftSkill = fs.readFileSync(path.join(publicRoot,
  'ai-commands/content/medium/skills/medium-draft/SKILL.md'), 'utf8');
const mediumPublicationSkill = fs.readFileSync(path.join(publicRoot,
  'ai-commands/content/medium/skills/medium-publication/SKILL.md'), 'utf8');
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
  'human-dialogue-and-canonical-packets');
assert.equal(portable.initializer.communicationMode, 'human-administration-and-workflow-orchestration');
assert.deepEqual(portable.dependencies, [
  { consumerAgentId: 'admin', providerAgentId: 'writer', kind: 'workflow-stage-provider',
    requirement: 'capability-bound', capabilities: ['article_intake', 'article_drafting', 'editorial_verification',
      'article_archive', 'destination_draft_preparation', 'critique_disposition'] },
  { consumerAgentId: 'admin', providerAgentId: 'reviewer', kind: 'workflow-stage-provider',
    requirement: 'capability-bound', capabilities: ['independent_critique', 'review_findings_return',
      'review_presentation', 'human_listen_through', 'release_gate_diagnosis'] },
  { consumerAgentId: 'admin', providerAgentId: 'release-coordinator', kind: 'workflow-stage-provider',
    requirement: 'capability-bound', capabilities: ['release_planning', 'release_recommendation',
      'medium_native_scheduling', 'medium_publication_creation'] },
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
assert.deepEqual(capabilities.get('medium_publication_creation'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN']);
assert.deepEqual(capabilities.get('workflow_orchestration'), ['OWN', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(capabilities.get('release_gate_diagnosis'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN', 'PROHIBITED']);
assert.ok(capabilities.get('immediate_publication_or_submission')?.every((cell) => cell === 'PROHIBITED'));
assert.deepEqual(capabilities.get('review_assignment'), ['OWN', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(capabilities.get('review_findings_return'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN', 'PROHIBITED']);

const routes = matrix(portable.policy.communicationMatrix, 'route');
for (const [name, cells] of routes) {
  assert.ok(cells.every((cell) => ['AUTHORIZED', 'PROHIBITED'].includes(cell)), `invalid route: ${name}`);
}
assert.deepEqual([...routes.keys()], [
  'human_to_admin', 'human_to_judge', 'human_to_writer', 'human_to_reviewer',
  'human_to_release_coordinator',
  'admin_to_writer', 'writer_to_admin', 'admin_to_reviewer', 'reviewer_to_admin',
  'admin_to_release_coordinator', 'release_coordinator_to_admin',
]);
for (const [index, id] of expected.entries()) {
  const route = routes.get(`human_to_${roster[index].matrixColumn}`);
  assert.ok(route, `missing human route: ${id}`);
  assert.equal(route.filter((cell) => cell === 'AUTHORIZED').length, 1);
  assert.equal(route[index], 'AUTHORIZED');
}
assert.deepEqual(routes.get('admin_to_writer'),
  ['AUTHORIZED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(routes.get('admin_to_reviewer'),
  ['AUTHORIZED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(routes.get('admin_to_release_coordinator'),
  ['AUTHORIZED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(routes.get('writer_to_admin'),
  ['PROHIBITED', 'PROHIBITED', 'AUTHORIZED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(routes.get('reviewer_to_admin'),
  ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'AUTHORIZED', 'PROHIBITED']);
assert.deepEqual(routes.get('release_coordinator_to_admin'),
  ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'AUTHORIZED']);

assert.match(destinationFlow, /must immediately return the[\s\S]*exact archived revision, exact destination draft/);
assert.match(destinationFlow, /does not\s+require a second human prompt/);
assert.match(destinationFlow, /BLOCKED_DESTINATION_REVIEW/);
assert.match(critiqueFlow, /A prior article-only disposition does not\s+review the later destination representation/);
assert.match(writerRole, /Writer never contacts Reviewer or Release Coordinator directly/);
assert.match(writerRole, /destination request is incomplete until the destination-specific disposition/);
assert.match(writerRole, /Writer owns header-image search/);
assert.match(writerRole, /fixed shortlist of no more than three/);
assert.match(writerRole, /header-image selection contract/);
assert.match(writerRole, /canonical contract path, and exact content hash/);
assert.match(writerRole, /Sending the shortlist to the human is not a review handoff/);
assert.match(writerRole, /Writer owns conversion of source visuals/);
assert.match(writerRole, /BLOCKED_DIAGRAM_RENDERING/);
assert.match(writerRole, /Do not stop after one successful replacement/);
assert.match(writerRole, /BLOCKED_DIAGRAM_RECONCILIATION/);
assert.match(reviewCriteria, /Source equivalence alone cannot clear\s+rendered-destination QA/);
assert.match(reviewCriteria, /large empty gap between its quotation and attribution/);
assert.match(reviewCriteria, /correctly rendered picture in the wrong part of the article is a review finding/);
assert.match(reviewCriteria, /general review guide does not duplicate that contract/);
assert.match(reviewCriteria, /claims a diagram but renders only\s+the words describing it/);
assert.match(reviewCriteria, /Independently inventory the source revision's Mermaid fences/);
assert.match(reviewCriteria, /another diagram was converted successfully/);
assert.match(destinationFlow, /direct rendered\s+evidence such as screenshots/);
assert.match(destinationFlow, /Mermaid or another non-native\s+diagram format/);
assert.match(mediumDraftSkill, /fenced Mermaid block must be converted/);
assert.match(mediumDraftSkill, /header-image selection contract/);
assert.match(mediumDraftSkill, /caption as the visual/);
assert.match(mediumDraftSkill, /complete source-diagram inventory/);
assert.match(mediumDraftSkill, /BLOCKED_DIAGRAM_RECONCILIATION/);
assert.match(critiqueFlow, /Textual\s+equivalence or metadata read-back cannot substitute for this visual pass/);
assert.match(critiqueFlow, /header-image selection contract/);
assert.match(critiqueFlow, /flow does not restate its criteria/);
assert.match(reviewerRole, /Source equivalence is not\s+visual QA/);
assert.match(reviewerRole, /For each picture,[\s\S]*editorial location supports the nearby passage/);
assert.match(reviewerRole, /header-image selection contract/);
assert.match(reviewerRole, /contract path and exact\s+content hash/);
assert.match(reviewerRole, /Reconcile every claimed diagram[\s\S]*actually rendered visual/);
assert.match(reviewerRole, /Never infer completeness from one\s+successful replacement/);
assert.match(routing, /Admin is the sole inter-agent coordinator/);
assert.match(routing, /No specialist-to-specialist route is authorized/);
assert.match(routing, /Writer does not contact Reviewer or Release Coordinator/);
assert.match(routing, /Reviewer does not contact Writer or\s+Release Coordinator/);
assert.match(routing, /Release\s+Coordinator does not contact Writer or Reviewer/);
assert.match(releaseCoordinatorRole, /Never treat Medium's default profile\/home as consent/);
assert.match(releaseCoordinatorRole, /author's profile\/home or one\s+named authorized Publication/);
assert.match(releaseCoordinatorRole, /Medium Publication skill/);
assert.match(releaseCoordinatorRole, /name, description, or avatar/);
assert.match(releaseCoordinatorRole, /Return one bounded blocker[\s\S]*exact verified Admin/);
assert.match(reviewerRole, /REVIEW_REQUIRED/);
assert.match(orchestration, /End-to-end state machine/);
assert.match(orchestration, /exactly one active receipt/);
assert.match(orchestration, /Every canonical agent packet starts[\s\S]*from Admin/);
assert.match(orchestration, /empty completed turn is `BLOCKED_DELIVERY_UNACKNOWLEDGED`/);
assert.match(orchestration, /how many independent review rounds occurred/);
assert.match(orchestration, /verified scheduled local date, time, and time zone/);
assert.match(orchestration, /proof that exactly one active binding remains per role/);
assert.match(orchestration, /periodic heartbeat rather than\s+continuously polling agents/);
assert.match(orchestration, /more than one active visible task for one role/);
assert.match(orchestration, /heartbeat reports evidence[\s\S]*never creates, replaces, archives/);
assert.match(adminRole, /owns orchestration from the current verified\s+state until a terminal outcome/);
assert.match(releaseFlow, /BLOCKED_PUBLICATION_TARGET/);
assert.match(releaseFlow, /silently fall back to profile\/home/);
assert.match(headerImageContract, /single canonical header\/hero-image contract/);
assert.match(headerImageContract, /at most one image commissioned/);
assert.match(headerImageContract, /Generic AI “cozy productivity” filler/);
assert.match(headerImageContract, /explicit `accept` or `reject` verdict/);
assert.match(headerImageContract, /cinematic editorial infographic/);
assert.match(headerImageContract, /Treat every subtitle, tagline, caption/);
assert.match(headerImageContract, /exact article promise/);
assert.match(headerImageContract, /character-by-character inspection/);
assert.match(mediumPublicationSkill, /active Medium membership/);
assert.match(mediumPublicationSkill, /limit of seven owned Publications/);
assert.match(mediumPublicationSkill, /BLOCKED_MEDIUM_PUBLICATION_CREATION/);

console.log('Writing managed-agent roster: PASS');
