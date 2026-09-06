#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const commandsRoot = path.dirname(fileURLToPath(import.meta.url));
const purposeByCommand = {
  backlog: 'capture, organize, prioritize, and inspect pending work without starting implementation.',
  browser: 'perform bounded browser navigation and interaction when a task requires a visible web surface.',
  'bug-fix': 'diagnose a reported defect, implement the smallest safe correction, and produce verification evidence.',
  'code-style': 'assess or improve source code against the selected repository’s formatting, design, and maintainability rules.',
  coding: 'implement an authorized code change from defined scope, design, and acceptance criteria.',
  comment: 'create or update a bounded explanatory comment on the selected artifact or external work item.',
  commit: 'validate and record an authorized set of repository changes as one traceable Git commit.',
  datadog: 'inspect Datadog telemetry and return evidence about application health, behavior, or incidents.',
  'datadog-monitors': 'inspect or manage explicitly authorized Datadog monitor configuration and evidence.',
  design: 'turn requirements into an implementation-ready technical design with boundaries, decisions, and acceptance criteria.',
  dialog: 'conduct a structured, bounded conversation that resolves a defined question or decision.',
  discussion: 'record, retrieve, and develop structured discussion threads without treating them as implementation authorization.',
  done: 'evaluate whether work satisfies its Definition of Done and report any remaining completion gates.',
  git: 'perform bounded, authorized source-control operations with explicit repository scope and resulting-state evidence.',
  hermes: 'route an authorized prompt through the profile-selected local Hermes provider and return its result.',
  'hurl-test-runner': 'execute configured Hurl HTTP tests and return request-level validation evidence.',
  ide: 'open or operate the selected project in a supported development environment.',
  'init-prompt': 'generate the portable initialization prompt for a selected profile, workflow, project, and platform context.',
  install: 'perform a documented, explicitly authorized software installation and verify the installed result.',
  'install-grapheneos': 'guide and verify an explicitly authorized GrapheneOS installation on a supported device.',
  java: 'install or verify the configured Java runtime required by the selected project.',
  node: 'install or verify the configured Node.js runtime required by the selected project.',
  python: 'install or verify the configured Python runtime required by the selected project.',
  terminal: 'install, configure, or verify the documented terminal environment for the selected workspace.',
  jira: 'search, inspect, create, or update Jira work items through an explicitly authorized lifecycle operation.',
  kdenlive: 'prepare, edit, render, or verify a video project through the documented Kdenlive workflow.',
  lodgify: 'inspect or perform explicitly authorized Lodgify property and reservation operations.',
  logs: 'perform provider-neutral log search, filtering, retrieval, streaming, and evidence collection for an exact service and environment.',
  'lyrics-timestamp': 'align lyric lines with audio timing and produce a reusable timestamped lyric artifact.',
  monitoring: 'inspect configured system or application signals and report actionable health evidence.',
  monorepo: 'inspect and operate a multi-project repository through its declared package and dependency boundaries.',
  'new-feature-doc': 'create or update implementation-facing documentation for a clearly scoped product feature.',
  note: 'capture a durable, structured note in the explicitly selected destination.',
  plan: 'turn a defined outcome into an ordered, verifiable implementation or execution plan.',
  pr: 'create an authorized pull request from validated branch state with traceable title, body, and source evidence.',
  'pr-update': 'update an existing pull request after validating its exact repository, branch, and requested changes.',
  'pr-review-threads': 'retrieve and organize pull-request review conversations that require resolution.',
  push: 'publish validated local commits to an explicitly authorized remote branch and verify the remote state.',
  sdd: 'drive specification-driven development from an agreed specification through implementation and validation gates.',
  session: 'create, resume, inspect, or close a bounded work session with durable context and status.',
  'show-context': 'present a file, URL, report, or other selected artifact in an appropriate visible context.',
  sms: 'prepare or send an explicitly authorized text message to an exact recipient.',
  snyk: 'run configured dependency or code security checks and report actionable vulnerability evidence.',
  'sonar-qube': 'inspect configured SonarQube quality results and report relevant findings and gate status.',
  springboot: 'start, verify, and interact with the selected Spring Boot application in its configured environment.',
  'springboot-log': 'retrieve and inspect logs from the selected Spring Boot application instance.',
  'springboot-stop': 'stop the exact selected Spring Boot process and verify that it terminated.',
  'smoke-tests': 'run configured high-value health checks and report whether the target is basically operational.',
  test: 'execute the appropriate automated validation for a defined change and return exact command and result evidence.',
  'ticket-tracker': 'perform provider-neutral search, read, creation, update, and lifecycle operations on work items.',
  tts: 'convert selected text into a reproducible speech-audio artifact using the configured voice provider.',
  'video-handwriting-effect': 'generate and verify a video that animates supplied text or artwork as handwriting.',
  'voice-report': 'turn a structured report into a reviewable narrated audio or video artifact.',
  worklog: 'record and summarize traceable work activity, evidence, and outcomes for a selected scope.',
  'worktree-bash': 'execute a bounded shell operation in an explicitly selected Git worktree.',
  writing: 'create or revise audience-appropriate prose from a defined brief, source material, and delivery format.'
};

async function contracts(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.venv'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await contracts(target));
    else if (entry.name.endsWith('.command.md')) found.push(target);
  }
  return found;
}

function normalize(content, commandId) {
  const sectionPattern = /^## ([^\n]+)\n/gm;
  const matches = [...content.matchAll(sectionPattern)];
  const preambleEnd = matches[0]?.index ?? content.length;
  const preamble = content.slice(0, preambleEnd).trimEnd();
  const preambleLines = preamble.split('\n');
  const title = preambleLines.shift() || `# ${commandId}.command`;
  const introductory = preambleLines.join('\n').trim();
  const sections = matches.map((match, index) => ({
    heading: match[1].trim(),
    body: content.slice(match.index + match[0].length, matches[index + 1]?.index ?? content.length).trim()
  }));
  const take = (heading) => {
    const index = sections.findIndex((section) => section.heading === heading);
    return index < 0 ? null : sections.splice(index, 1)[0];
  };

  const purpose = take('Purpose') ?? {
    heading: 'Purpose',
    body: introductory || ''
  };
  const placeholder = `Use \`${commandId}\` for the bounded behavior defined by this command contract.`;
  if (!purpose.body || purpose.body === placeholder) {
    const description = purposeByCommand[commandId];
    if (!description) throw new Error(`${commandId}: add a concrete Purpose before normalization`);
    purpose.body = `Use \`${commandId}\` to ${description}`;
  }
  if (introductory && !purpose.body.includes(introductory)) {
    purpose.body = `${introductory}\n\n${purpose.body}`.trim();
  }
  const inputs = take('Inputs');
  const outputs = take('Outputs');
  if (!inputs || !outputs) throw new Error(`${commandId}: Inputs and Outputs must exist before normalization`);
  const entryPoint = take('Entry Point');
  if (!entryPoint) throw new Error(`${commandId}: Entry Point must exist before normalization`);

  const ordered = [purpose, inputs, outputs, entryPoint, ...sections];
  return `${title}\n\n${ordered.map(({ heading, body }) => `## ${heading}\n\n${body}`).join('\n\n')}\n`;
}

const entryPointOverrides = {
  ide: ['ide-intellij-idea.command.sh', 'ide-vscode.command.sh'],
  springboot: ['springboot-run.command.sh'],
  'springboot-log': ['springboot-log.command.sh'],
  'springboot-stop': ['springboot-stop.command.sh']
};

async function ensureEntryPoint(content, contract, commandId) {
  if (/^## Entry Point$/m.test(content)) return ensureConfigReference(content, contract, commandId);

  const directory = path.dirname(contract);
  const relativeDirectory = path.relative(commandsRoot, directory);
  const files = await readdir(directory);
  let names = entryPointOverrides[commandId] ?? [
    `${commandId}.command.sh`,
    `${commandId}.command.mjs`,
    `${commandId}.sh`,
    `${commandId}.mjs`
  ].filter((name) => files.includes(name));

  if (files.includes('app.sh')) names = [...names, 'app.sh'];

  const rows = names.length
    ? names.map((name) => {
        const type = name === 'app.sh' ? 'Command-owned UI launcher' : name.endsWith('.mjs') ? 'Node executable' : 'Shell executable';
        return `| \`${relativeDirectory}/${name}\` | ${type} | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |`;
      })
    : [`| \`${path.relative(commandsRoot, contract)}\` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |`];

  const section = [
    '## Entry Point',
    '',
    '| Entry point | Type | Profile-aware invocation |',
    '|---|---|---|',
    ...rows,
    '',
    'Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.'
  ].join('\n');

  const outputs = /^## Outputs\n\n[\s\S]*?(?=\n## |$)/m;
  const match = content.match(outputs);
  if (!match) throw new Error(`${commandId}: cannot place Entry Point after Outputs`);
  return ensureConfigReference(content.replace(outputs, `${match[0].trimEnd()}\n\n${section}\n`), contract, commandId);
}

function ensureConfigReference(content, contract, commandId) {
  const configPath = `${path.relative(commandsRoot, path.dirname(contract))}/${commandId}.command.example.config`;
  if (content.includes(`Committed configuration template: \`${configPath}\``)) return content;
  const marker = /Every invocation is profile-aware:[^\n]*/;
  return content.replace(marker, (line) => `${line}\n\nCommitted configuration template: \`${configPath}\`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through \`commands[].config\`, and let the host expose it as \`AI_COMMAND_CONFIG_PATH\`. The committed example is documentation and must never be used as operational configuration.`);
}

async function ensureExampleConfig(contract, commandId) {
  const directory = path.dirname(contract);
  const desired = path.join(directory, `${commandId}.command.example.config`);
  const files = await readdir(directory);
  const desiredName = path.basename(desired);
  if (!files.includes(desiredName)) {
    await writeFile(desired, `# No command-specific value overrides are currently declared for ${commandId}.\n`);
  }

  const previousHeader = [
    '# COMMITTED EXAMPLE ONLY: keep this file safe, fictional, and free of credentials.',
    '# Copy it into the selected profile and reference the copied file through commands[].config.',
    '# The activated host exposes that profile-owned copy as AI_COMMAND_CONFIG_PATH.',
    '# Never use this catalog example as operational configuration.'
  ].join('\n');
  const standardHeader = [
    '# TEMPLATE ONLY: copy into the selected AI Profile; never populate this file in ai-commands.',
    '# COMMITTED EXAMPLE ONLY: keep this file safe, fictional, and free of credentials.',
    '# Copy it into the selected profile and reference the copied file through commands[].config.',
    '# The activated host exposes that profile-owned copy as AI_COMMAND_CONFIG_PATH.',
    '# Never use this catalog example as operational configuration.'
  ].join('\n');
  const current = await readFile(desired, 'utf8');
  if (!current.startsWith(standardHeader)) {
    const body = current.startsWith(previousHeader) ? current.slice(previousHeader.length).trimStart() : current;
    await writeFile(desired, `${standardHeader}\n\n${body}`);
  }
}

function repairMisplacedEntryPoint(content) {
  const misplaced = /^## Outputs\n\n(\| Output \| Destination \| Description \|)\n\n## Entry Point\n\n([\s\S]*?Every invocation is profile-aware:[^\n]*)\n\n(\|---\|---\|---\|[\s\S]*?)(?=\n## |(?![\s\S]))/m;
  return content.replace(misplaced, (_match, outputHeader, entryBody, outputTail) =>
    `## Outputs\n\n${outputHeader}\n${outputTail.trimEnd()}\n\n## Entry Point\n\n${entryBody}`
  );
}

for (const contract of await contracts(commandsRoot)) {
  const commandId = path.basename(contract, '.command.md');
  await ensureExampleConfig(contract, commandId);
  const original = await readFile(contract, 'utf8');
  const repaired = repairMisplacedEntryPoint(original);
  const withEntryPoint = await ensureEntryPoint(repaired, contract, commandId);
  const normalized = normalize(withEntryPoint, commandId);
  if (normalized !== original) await writeFile(contract, normalized);
}

console.log('command documentation order: normalized');
