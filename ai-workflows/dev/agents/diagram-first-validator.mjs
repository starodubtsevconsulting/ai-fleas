import fs from 'node:fs';
import path from 'node:path';

export const INVARIANT = '**DIAGRAM-FIRST CONTRACT — NO UNCOVERED RULE TEXT.**';
export const PRINCIPLE_LINK = 'ai-commands/doc/principles/diagram-first-principle.md';
const REQUIRED_DIAGRAM_LABELS = ['Actor:', 'Decision:', 'Allowed:', 'BLOCKED:', 'Outcome:'];
const IDENTITY_SEMANTICS = [
  'Actor: role dispatch',
  'Decision: Codex app mode?',
  'Outcome: active runtime defines worker identity',
  'Decision: exact ticket ID and initialized user-visible role task with exact ID exist?',
  'Allowed: Codex app existing-task message to exact task ID',
  'BLOCKED: no exact ticket, visible task, or capability',
  'Outcome: auditable visible assignment',
];

function markdownFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(root, entry.name);
    if (entry.isDirectory()) return markdownFiles(item);
    return entry.isFile() && entry.name.endsWith('.md') ? [item] : [];
  });
}

function nextNonblank(lines, from) {
  for (let index = from; index < lines.length; index += 1) {
    if (lines[index].trim()) return index;
  }
  return -1;
}

function validateDiagram(lines, start, file, heading, nextHeading) {
  if (lines[start]?.trim() !== '```mermaid') {
    throw new Error(`${file}: ${heading} has normative text without an immediately preceding Mermaid diagram`);
  }
  const end = lines.indexOf('```', start + 1);
  if (end < 0) throw new Error(`${file}: ${heading} has an unterminated Mermaid diagram`);
  const diagram = lines.slice(start + 1, end).join('\n');
  if (!/^flowchart TD$/m.test(diagram)) {
    throw new Error(`${file}: ${heading} must use compact vertical flowchart TD`);
  }
  for (const label of REQUIRED_DIAGRAM_LABELS) {
    if (!diagram.includes(label)) {
      throw new Error(`${file}: ${heading} diagram is missing semantic label ${label}`);
    }
  }
  for (const line of diagram.split('\n').slice(1).filter((item) => item.trim())) {
    if (!/^\s*[A-Za-z][A-Za-z0-9]*(?:\["[^"\n]+"\]|\{"[^"\n]+"\})?\s+-->(?:\|[^|\n]+\|)?\s*[A-Za-z][A-Za-z0-9]*(?:\["[^"\n]+"\]|\{"[^"\n]+"\})?\s*$/.test(line)) {
      throw new Error(`${file}: ${heading} has invalid supported Mermaid edge syntax: ${line.trim()}`);
    }
  }
  const prose = nextNonblank(lines, end + 1);
  if (prose < 0 || /^#{1,6}\s/.test(lines[prose])) {
    throw new Error(`${file}: ${heading} has a diagram but no matching normative text`);
  }
}

function isFlatReferenceTable(lines, headingIndex, nextHeadingIndex) {
  const end = nextHeadingIndex < 0 ? lines.length : nextHeadingIndex;
  const body = lines.slice(headingIndex + 1, end).filter((line) => line.trim());
  return body.length >= 2
    && body.every((line) => /^\|.*\|$/.test(line.trim()))
    && /^\|(?:\s*:?-+:?\s*\|)+$/.test(body[1].trim());
}

export function validateFile(file, packageRoot) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const first = nextNonblank(lines, 0);
  if (first < 0 || !/^#\s+/.test(lines[first])) {
    throw new Error(`${file}: H1 must be the first nonblank content`);
  }
  const principleSelection = nextNonblank(lines, first + 1);
  const selectsCanonicalPrinciple = text.includes(PRINCIPLE_LINK);
  const declaresLegacyInvariant = principleSelection >= 0 && lines[principleSelection].startsWith(INVARIANT);
  if (!selectsCanonicalPrinciple && !declaresLegacyInvariant) {
    throw new Error(`${file}: canonical diagram-first principle link or legacy invariant is required`);
  }
  if (text.includes('BLOCKED_INCLUDED_RULE_CONTEXT')) {
    const firstAfterH1 = nextNonblank(lines, first + 1);
    if (firstAfterH1 < 0 || lines[firstAfterH1].trim() !== '## Included rules') {
      throw new Error(`${file}: Included rules must be the first content and first H2 in a rule document that composes external rules`);
    }
  }
  const declaredRole = text.match(/ROLE:\s*`([^`]+)`/)?.[1];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^#{2,6}\s+/.test(lines[index])) {
      const nextHeading = lines.findIndex((line, candidate) => candidate > index && /^#{1,6}\s+/.test(line));
      if (isFlatReferenceTable(lines, index, nextHeading)) continue;
      const diagramStart = nextNonblank(lines, index + 1);
      validateDiagram(lines, diagramStart, file, lines[index], nextHeading);
      if (declaredRole) {
        const end = lines.indexOf('```', diagramStart + 1);
        const actor = lines.slice(diagramStart, end).join(' ').match(/Actor:([^"\n]+)/)?.[1]?.toLowerCase() ?? '';
        const roleWords = declaredRole.toLowerCase().split(/[\s/-]+/).filter((word) => word.length > 2);
        if (!roleWords.some((word) => actor.includes(word))) {
          throw new Error(`${file}: ${lines[index]} Actor: semantics do not match declared role ${declaredRole}`);
        }
      }
    }
  }
  if (/flowchart\s+(?!TD\b)/.test(text)) {
    throw new Error(`${file}: non-TD Mermaid flowchart is prohibited`);
  }
  if (/(child|subagent).{0,80}\b(may|allowed|permitted)\b/i.test(text)) {
    throw new Error(`${file}: child/subagent exception or allowed route is prohibited`);
  }

  const relative = path.basename(file);
  const roleDeltas = ['coder.md', 'command-runner.md', 'command-runner-test.md', 'designer-reviewer.md', 'proxy-coder.md', 'ui-acceptance-tester.md', 'judge.md'];
  if (roleDeltas.includes(relative)) {
    const duplicatedLifecycle = /(move.{0,30}In Progress.{0,30}Done|search.{0,40}(tracker|ticket)|scheduled.{0,20}reconciliation|archive.{0,40}worker task ID)/i;
    if (duplicatedLifecycle.test(text)) {
      throw new Error(`${file}: role delta duplicates canonical shared lifecycle language`);
    }
  }
}

export function validatePackage(root) {
  const files = markdownFiles(root);
  const repositoryCommonRoles = path.resolve(root, '../../_common/roles');
  const fixtureCommonRoles = path.join(root, '_common-roles');
  const commonRolesRoot = fs.existsSync(repositoryCommonRoles) ? repositoryCommonRoles : fixtureCommonRoles;
  const commonRoleFiles = fs.existsSync(commonRolesRoot) ? markdownFiles(commonRolesRoot) : [];
  if (!commonRoleFiles.some((file) => path.basename(file) === 'judge.md')) {
    throw new Error(`${root}: common Judge role definition is required`);
  }
  files.push(...commonRoleFiles.filter((file) => !files.includes(file)));
  const repositoryCommonPolicy = path.resolve(root, '../../_common/policy');
  const fixtureCommonPolicy = path.join(root, '_common-policy');
  const commonPolicyRoot = fs.existsSync(repositoryCommonPolicy) ? repositoryCommonPolicy : fixtureCommonPolicy;
  const commonPolicyFiles = fs.existsSync(commonPolicyRoot) ? markdownFiles(commonPolicyRoot) : [];
  if (!commonPolicyFiles.some((file) => path.basename(file) === 'access-matrix.md')) {
    throw new Error(`${root}: common access matrix mechanism is required`);
  }
  files.push(...commonPolicyFiles.filter((file) => !files.includes(file)));
  files.sort();
  if (files.length === 0) throw new Error(`${root}: no Markdown governance files discovered`);
  files.forEach((file) => validateFile(file, root));

  const shared = fs.readFileSync(path.join(root, 'shared-execution-routing.md'), 'utf8');
  const teamPolicy = [
    fs.readFileSync(path.join(root, 'team.md'), 'utf8'),
    fs.readFileSync(fs.existsSync(path.resolve(root, '../agents.yml'))
      ? path.resolve(root, '../agents.yml') : path.join(root, 'agents.yml'), 'utf8'),
  ].join('\n');
  const designer = fs.readFileSync(path.join(commonRolesRoot, 'designer-reviewer.md'), 'utf8');
  const requiredShared = [
    'AGENT MEANS A PREDEFINED, USER-VISIBLE ROLE TASK',
    'Every initialized visible role receives and retains the complete `configuration` source binding',
    'It must not infer a source',
    'from the current working directory',
    'Importing changed content still requires an exact authorized transfer into the bound destination',
    'Ask Manager',
    'Designer/Reviewer directly dispatches the selected worker',
    'Designer/Reviewer directly dispatches registered Command Runner commands without Manager',
    'Manager is never the communication proxy',
    'Every post-initialization cross-task work request **MUST** include the exact tracker `ticketId`',
    'exact ticket ID and worker task ID',
    'two active workers for the same role are prohibited',
    'same self-contained canonical initialization payload used by full workflow agent initialization',
    'exact `COPY THAT` first-commentary acknowledgement',
    'including Coder-to-Command Runner bounded execution packets',
    'Judge is the sole AI validator and physical maintainer for the distributed protected profile-scoped AI configuration',
    'after the human-authored rule seed gate passes',
    'it is never the original author of rule meaning',
    'Representation synchronization never expands policy scope',
    'BLOCKED_JUDGE_RULE_SCOPE_EXPANSION',
    'BLOCKED_JUDGE_RULE_PROJECTION_AMBIGUITY',
    'No workflow agent reviews or approves',
    'the human is the sole approval authority',
    'The mixed `ai-workflows/**` tree is not protected wholesale',
    'archive the exact disposable worker task ID',
    'archives that exact worker and never deletes it',
    'Manager alone verifies every ticket gate',
    'add one checklist item to the existing ticket instead of creating a new ticket',
    'Every new ticket must also record an estimate in hours or days, never points',
    'stable grouping labels',
    'approximate implementation plan of at most five short, high-level steps',
    'Manager also records a normalized priority',
    'applies the configured tracker\'s canonical bug label or tag',
    'functionality existed before the current task or change',
    'MUST NOT** create, dispatch, wake, retry, replace, or resume work',
  ];
  const normalizedShared = shared.replace(/\s+/g, ' ');
  for (const rule of requiredShared) {
    if (!normalizedShared.includes(rule)) throw new Error(`shared contract missing canonical rule: ${rule}`);
  }
  for (const semantic of IDENTITY_SEMANTICS) {
    if (!normalizedShared.includes(semantic)) throw new Error(`shared agent-identity diagram/prose mismatch: ${semantic}`);
  }
  for (const boundary of ['persistent control', 'disposable worker']) {
    if (!teamPolicy.includes(boundary)) throw new Error(`Team policy missing lifecycle boundary: ${boundary}`);
  }
  const normalizedDesigner = designer.replace(/\s+/g, ' ');
  for (const rule of [
    'Initial protected rule meaning or semantic policy choice',
    'The separate initial-rule-meaning row is `PROHIBITED` for every AI role',
  ]) {
    if (!teamPolicy.includes(rule)) throw new Error(`Team policy missing human-authored rule boundary: ${rule}`);
  }
  if (/send one bounded proposal to Judge|Judge asks the human to approve/.test(designer)) {
    throw new Error('designer contract contains a prohibited Judge communication route');
  }
  for (const rule of [
    'Reading the relevant project documentation is a mandatory prerequisite',
    'read its project-local `README`',
    'do not import sibling-repository or unrelated workspace context',
    'performs no ticketless work',
  ]) {
    if (!normalizedDesigner.includes(rule)) throw new Error(`designer contract missing project-documentation or ticket prerequisite: ${rule}`);
  }
  for (const [roleFile, rule] of [
    ['coder.md', 'Refuse to acknowledge or perform work without it'],
    ['coder.md', 'same basename'],
    ['coder.md', 'An undocumented runnable utility is `BLOCKED` from completion'],
    ['command-runner.md', 'Refuse to acknowledge or execute ticketless work'],
    ['ui-acceptance-tester.md', 'refuse ticketless work'],
  ]) {
    const role = fs.readFileSync(path.join(commonRolesRoot, roleFile), 'utf8');
    if (!role.replace(/\s+/g, ' ').includes(rule)) throw new Error(`${roleFile} missing exact-ticket prerequisite`);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(process.argv[2] ?? path.dirname(new URL(import.meta.url).pathname));
  const files = validatePackage(root);
  console.log(`diagram-first governance: PASS (${files.length} recursively discovered Markdown files; structural/static proof)`);
}
