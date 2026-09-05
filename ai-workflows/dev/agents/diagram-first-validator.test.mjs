import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateFile, validatePackage } from './diagram-first-validator.mjs';

const source = path.dirname(new URL(import.meta.url).pathname);
const commonRoles = path.resolve(source, '../../_common/roles');
const commonJudge = path.join(commonRoles, 'judge.md');
const commonPolicy = path.resolve(source, '../../_common/policy');
const agentsManifest = path.resolve(source, '../agents.yml');

function fixture(mutator) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-first-'));
  fs.cpSync(source, root, { recursive: true, filter: (item) => !item.endsWith('node_modules') });
  fs.cpSync(commonRoles, path.join(root, '_common-roles'), { recursive: true });
  fs.cpSync(commonPolicy, path.join(root, '_common-policy'), { recursive: true });
  fs.copyFileSync(agentsManifest, path.join(root, 'agents.yml'));
  mutator(root);
  return root;
}

function replace(root, relative, from, to) {
  const file = path.join(root, relative);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(from, to));
}

function replaceAll(root, relative, from, to) {
  const file = path.join(root, relative);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split(from).join(to));
}

test('recursively validates every workflow Markdown file plus every common role definition', () => {
  const files = validatePackage(source);
  const discovered = fs.globSync('**/*.md', { cwd: source }).sort();
  const discoveredCommonRoles = fs.globSync('**/*.md', { cwd: commonRoles }).sort();
  const discoveredCommonPolicy = fs.globSync('**/*.md', { cwd: commonPolicy }).sort();
  assert.equal(files.length, discovered.length + discoveredCommonRoles.length + discoveredCommonPolicy.length);
  assert(files.some((file) => file.endsWith('manager.md')));
  assert(files.includes(commonJudge));
});

test('Team policy selects the canonical Diagram First Principle instead of copying its rules', () => {
  const team = fs.readFileSync(path.join(source, 'team.md'), 'utf8');
  const normalizedTeam = team.replace(/\s+/g, ' ');
  assert.match(team, /^# Development workflow agent team\s+## Included rules\s+\| Included rule \| Required application \|/);
  assert.match(team, /\[Diagram First Principle\]\(\.\.\/\.\.\/\.\.\/ai-commands\/doc\/principles\/diagram-first-principle\.md\)/);
  assert.match(team, /\[Included Rules Principle\]\(\.\.\/\.\.\/\.\.\/ai-commands\/doc\/principles\/included-rules-principle\.md\)/);
  assert.match(team, /\[Agent access matrix mechanism\]\(\.\.\/\.\.\/_common\/policy\/access-matrix\.md\)/);
  assert.match(team, /\[Common Agent contract\]\(\.\.\/\.\.\/agents\.md\)/);
  assert.match(team, /\[Development workflow\]\(\.\.\/dev\.workflow\.md\)/);
  assert.match(team, /\[Agent manifest\]\(\.\.\/agents\.yml\)/);
  assert.match(team, /\[Shared execution routing\]\(shared-execution-routing\.md\)/);
  assert.match(team, /\[Elastic Agent Pool\]\(elastic-agent-pool\.md\)/);
  assert.match(team, /\[Role Context Clone\]\(role-context-clone\.md\)/);
  assert.match(team, /\[Manifest-selected common Role\]\(\.\.\/\.\.\/_common\/roles\/\)/);
  assert.match(normalizedTeam, /Every Agent loading this policy must load every rule in this table as part of the effective contract/);
  assert.match(team, /BLOCKED_INCLUDED_RULE_CONTEXT/);
  assert.doesNotMatch(team, /\*\*DIAGRAM-FIRST CONTRACT — NO UNCOVERED RULE TEXT\.\*\*/);
});

test('flat reference tables do not require decorative diagrams', () => {
  const team = fs.readFileSync(path.join(source, 'team.md'), 'utf8');
  assert.match(team, /## Included rules\s+\| Included rule \| Required application \|/);
  assert.doesNotMatch(team, /## Included rules\s+```mermaid/);
  const principle = fs.readFileSync(path.resolve(source, '../../../ai-commands/doc/principles/diagram-first-principle.md'), 'utf8');
  const includedRules = fs.readFileSync(path.resolve(source, '../../../ai-commands/doc/principles/included-rules-principle.md'), 'utf8');
  assert.match(principle, /flat reference table does not require a diagram/);
  assert.match(includedRules, /included-rules table is a reference catalog and does not require a diagram/);
});

test('a rule document that composes external rules puts Included rules first', () => {
  const principle = fs.readFileSync(path.resolve(source, '../../../ai-commands/doc/principles/included-rules-principle.md'), 'utf8');
  assert.match(principle, /`## Included rules` is the first content and first H2 immediately after the H1/);
  const root = fixture((copy) => {
    const team = path.join(copy, 'team.md');
    const text = fs.readFileSync(team, 'utf8');
    const includedStart = text.indexOf('## Included rules');
    const purposeStart = text.indexOf('**Purpose:**');
    const governedStart = text.indexOf('## Policy composition');
    const includedBlock = text.slice(includedStart, purposeStart);
    fs.writeFileSync(team, `${text.slice(0, includedStart)}${text.slice(purposeStart, governedStart)}${includedBlock}${text.slice(governedStart)}`);
  });
  assert.throws(() => validateFile(path.join(root, 'team.md'), root), /Included rules must be the first content and first H2/);
});

test('rejects a package without the common Judge role definition', () => {
  const root = fixture((copy) => fs.unlinkSync(path.join(copy, '_common-roles/judge.md')));
  assert.throws(() => validatePackage(root), /common Judge role definition is required/);
});

test('rejects uncovered normative chapter and missing immediate Mermaid', () => {
  const root = fixture((copy) => replace(copy, '_common-roles/coder.md', '```mermaid\nflowchart TD', 'Normative text before diagram.\n\n```mermaid\nflowchart TD'));
  assert.throws(() => validatePackage(root), /without an immediately preceding Mermaid/);
});

test('rejects non-vertical or malformed Mermaid and every missing semantic label', () => {
  const horizontal = fixture((copy) => replace(copy, '_common-roles/coder.md', 'flowchart TD', 'flowchart LR'));
  assert.throws(() => validatePackage(horizontal), /flowchart TD/);
  const malformed = fixture((copy) => replace(copy, '_common-roles/coder.md', 'Actor["Actor: initialized visible Coder"] -->', 'Actor["Actor: initialized visible Coder" -->'));
  assert.throws(() => validatePackage(malformed), /invalid supported Mermaid edge syntax/);
  for (const label of ['Actor:', 'Decision:', 'Allowed:', 'BLOCKED:', 'Outcome:']) {
    const root = fixture((copy) => replace(copy, '_common-roles/coder.md', label, 'OMITTED-LABEL'));
    assert.throws(() => validatePackage(root), new RegExp(`missing semantic label ${label}`));
  }
});

test('rejects actor and identity decision/allowed/prohibited/outcome semantic mismatches', () => {
  const actor = fixture((copy) => replace(copy, '_common-roles/coder.md', 'Actor: initialized visible Coder', 'Actor: initialized visible Manager'));
  assert.throws(() => validatePackage(actor), /Actor: semantics do not match declared role coder/);
  for (const semantic of [
    'Decision: exact ticket ID and initialized user-visible role task with exact ID exist?',
    'Allowed: Codex app existing-task message to exact task ID',
    'BLOCKED: no exact ticket, visible task, or capability',
    'Outcome: auditable visible assignment',
  ]) {
    const label = semantic.slice(0, semantic.indexOf(':') + 1);
    const root = fixture((copy) => replaceAll(copy, 'shared-execution-routing.md', semantic, `${label} mismatched semantic`));
    assert.throws(() => validatePackage(root), /agent-identity diagram\/prose mismatch/);
  }
});

test('rejects an undiagrammed child/subagent exception or route', () => {
  const root = fixture((copy) => replace(copy, '_common-roles/coder.md', 'Return ambiguity,', 'A subagent may be used. Return ambiguity,'));
  assert.throws(() => validatePackage(root), /subagent exception or allowed route/);
});

test('rejects duplicated canonical lifecycle language in a role delta', () => {
  const root = fixture((copy) => replace(copy, '_common-roles/coder.md', 'Return ambiguity,', 'Search the tracker for a ticket. Return ambiguity,'));
  assert.throws(() => validatePackage(root), /duplicates canonical shared lifecycle/);
});

test('rejects missing ticket/staffing/archive gates and incorrect lifecycle boundaries', () => {
  for (const rule of ['exact ticket ID and worker task ID', 'two active workers for the same role are prohibited', 'archive the exact disposable worker task ID']) {
    const root = fixture((copy) => replaceAll(copy, 'shared-execution-routing.md', rule, 'OMITTED-CANONICAL-RULE'));
    assert.throws(() => validatePackage(root), /missing canonical rule/);
  }
  const boundary = fixture((copy) => {
    replaceAll(copy, 'team.md', 'disposable worker', 'persistent control');
    replaceAll(copy, 'agents.yml', 'disposable worker', 'persistent control');
  });
  assert.throws(() => validatePackage(boundary), /missing lifecycle boundary/);
});

test('rejects a Designer/Reviewer contract without project documentation or ticket prerequisites', () => {
  const docs = fixture((copy) => replace(copy, '_common-roles/designer-reviewer.md', 'Reading the relevant project documentation is a mandatory prerequisite', 'Reading project documentation is optional'));
  assert.throws(() => validatePackage(docs), /missing project-documentation or ticket prerequisite/);
  const ticket = fixture((copy) => replace(copy, '_common-roles/designer-reviewer.md', 'performs no ticketless work', 'may perform ticketless work'));
  assert.throws(() => validatePackage(ticket), /missing project-documentation or ticket prerequisite/);
});
