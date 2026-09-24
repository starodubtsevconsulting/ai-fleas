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
const sessionReleaseAuthorization = fs.readFileSync(
  path.join(workflowRoot, 'guides/session-release-authorization.md'), 'utf8');
const mediumDraftSkill = fs.readFileSync(path.join(publicRoot,
  'ai-commands/content/medium/skills/medium-draft/SKILL.md'), 'utf8');
const mediumPublicationSkill = fs.readFileSync(path.join(publicRoot,
  'ai-commands/content/medium/skills/medium-publication/SKILL.md'), 'utf8');
const roster = [portable.initializer, ...portable.agents];
const ids = roster.map(({ agentId }) => agentId);
const expected = ['admin', 'writer', 'reviewer', 'release-coordinator'];

assert.equal(portable.workflowId, 'writing');
assert.equal(gpt.workflow, 'writing');
assert.deepEqual(ids, expected);
assert.equal(gpt.schema_version, 'gpt-agents-workflow-runtime.v2');
assert.equal(gpt.workflow_runtime.visibility, 'hidden');
assert.equal(gpt.runtime_semantics.peer_delivery, 'prohibited');
assert.deepEqual(gpt.role_endpoints.map(({ role }) => role), expected);
assert.deepEqual(Object.keys(gpt.role_contracts), expected);
assert.equal(new Set(roster.map(({ readinessToken }) => readinessToken)).size, expected.length);
assert.ok(roster.every(({ scope, schedule }) => scope === 'workflow' && schedule?.enabled === false));
assert.equal(portable.policy.routing, 'agents/editorial-routing.md');
assert.equal(portable.policy.communicationMatrix, undefined);
assert.equal(portable.policy.workflowRuntime, '../_common/runtime/workflow-router.md');
assert.equal(portable.dependencies, undefined);
assert.ok(!fs.existsSync(path.join(here, 'role-communication-matrix.csv')));
assert.equal(roster.find(({ agentId }) => agentId === 'writer')?.communicationMode,
  'human-dialogue-and-router-runtime');
assert.equal(roster.find(({ agentId }) => agentId === 'reviewer')?.communicationMode,
  'human-dialogue-and-router-runtime');
assert.equal(roster.find(({ agentId }) => agentId === 'release-coordinator')?.communicationMode,
  'human-dialogue-and-router-runtime');
assert.equal(portable.initializer.communicationMode, 'direct-human-administration-only');

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
assert.deepEqual(capabilities.get('medium_native_scheduling'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN']);
assert.deepEqual(capabilities.get('medium_publication_creation'), ['PROHIBITED', 'PROHIBITED', 'PROHIBITED', 'OWN']);
assert.deepEqual(capabilities.get('workflow_orchestration'), ['OWN', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(capabilities.get('governance_rules'), ['OWN', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(capabilities.get('release_gate_diagnosis'), ['PROHIBITED', 'PROHIBITED', 'OWN', 'PROHIBITED']);
assert.ok(capabilities.get('immediate_publication_or_submission')?.every((cell) => cell === 'PROHIBITED'));
assert.deepEqual(capabilities.get('review_assignment'), ['OWN', 'PROHIBITED', 'PROHIBITED', 'PROHIBITED']);
assert.deepEqual(capabilities.get('review_findings_return'), ['PROHIBITED', 'PROHIBITED', 'OWN', 'PROHIBITED']);

assert.match(destinationFlow, /must immediately expose the[\s\S]*exact archived revision, exact destination draft/);
assert.match(destinationFlow, /does not\s+require a second human prompt/);
assert.match(destinationFlow, /BLOCKED_DESTINATION_REVIEW/);
assert.match(critiqueFlow, /A prior article-only disposition does not\s+review the later destination representation/);
assert.match(writerRole, /never contacts Reviewer, Release Coordinator, or Admin as workflow transport/);
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
assert.match(reviewCriteria, /Cross-check every article-wide provenance, rights, and inventory claim/);
assert.match(reviewCriteria, /no third-party visuals/);
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
assert.match(reviewerRole, /reconcile article-wide provenance and inventory sentences/);
assert.match(reviewerRole, /no third-party visuals are used/);
assert.match(routing, /hidden Workflow Router is the Writing workflow runtime/);
assert.match(routing, /independent\s+role endpoints/);
assert.match(routing, /Writer does not send\s+it to Reviewer, Release Coordinator, or Admin/);
assert.match(routing, /Router assigns Reviewer/);
assert.match(routing, /Router\s+dispatches Release Coordinator/);
assert.match(routing, /echo the Router-owned `correlationId`, stage, and role byte-for-byte/);
assert.match(routing, /begin with `COPY THAT`/);
assert.match(releaseCoordinatorRole, /Never treat Medium's default profile\/home as consent/);
assert.match(releaseCoordinatorRole, /author's profile\/home or one\s+named authorized Publication/);
assert.match(releaseCoordinatorRole, /Medium Publication skill/);
assert.match(releaseCoordinatorRole, /name, description, or avatar/);
assert.match(releaseCoordinatorRole, /event through the Router result contract/);
assert.match(reviewerRole, /REVIEW_REQUIRED/);
assert.match(orchestration, /Runtime state machine/);
assert.match(orchestration, /exactly one active receipt/);
assert.match(orchestration, /Router assigns Writer/);
assert.match(orchestration, /`BLOCKED_DELIVERY_UNACKNOWLEDGED`/);
assert.match(orchestration, /review\s+rounds and dispositions/);
assert.match(orchestration, /requested and verified timing/);
assert.match(orchestration, /lifecycle repairs/);
assert.match(orchestration, /session-scoped release authorization/);
assert.match(sessionReleaseAuthorization, /authorize one bounded Writing run once/);
assert.match(sessionReleaseAuthorization, /must not ask the human to\s+repeat it/);
assert.match(sessionReleaseAuthorization, /review correction produced a new hash/);
assert.match(sessionReleaseAuthorization, /only its\s+author profile\/home is eligible/);
assert.match(sessionReleaseAuthorization, /Listen-through is a review aid, not a second release authorization/);
assert.match(orchestration, /supported heartbeat/);
assert.match(orchestration, /never dispatches stages/);
assert.match(orchestration, /creates or archives endpoints/);
assert.match(adminRole, /starts or resumes the hidden Router/);
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
