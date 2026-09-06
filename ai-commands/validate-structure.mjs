#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const commandsRoot = path.dirname(fileURLToPath(import.meta.url));
const supportDirectories = new Set(['.venv', '_runtime', 'assets', 'mcp-command-capabilities', 'tooling']);
const errors = [];

async function commandContracts(directory) {
  const contracts = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.venv'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) contracts.push(...await commandContracts(target));
    else if (entry.name.endsWith('.command.md')) contracts.push(target);
  }
  return contracts;
}

for (const entry of await readdir(commandsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || supportDirectories.has(entry.name)) continue;

  const bundle = path.join(commandsRoot, entry.name);
  const bundleEntries = await readdir(bundle);
  // Git does not track empty directories, so an empty local folder is not a
  // published command bundle and must not create a phantom command ID.
  if (bundleEntries.length === 0) continue;
  const contract = path.join(bundle, `${entry.name}.command.md`);
  try {
    if (!(await stat(contract)).isFile()) errors.push(`${entry.name}: missing ${entry.name}.command.md`);
  } catch {
    errors.push(`${entry.name}: missing ${entry.name}.command.md`);
  }

  for (const file of bundleEntries) {
    if (/\.command\.example\.(conf|config|ya?ml)$/.test(file) &&
        !new RegExp(`^${entry.name}(?:-[a-z0-9]+)*\\.command\\.example\\.`).test(file)) {
      errors.push(`${entry.name}/${file}: command example must match <command-id>.command.example.<extension>`);
    }
    if (/\.spec\.md$/.test(file) && file !== 'spec.md') {
      errors.push(`${entry.name}/${file}: bundle specification must be named spec.md`);
    }
    if (/test-scenarios?\.md$/.test(file)) {
      errors.push(`${entry.name}/${file}: live scenario must be named ${entry.name}.scenario.md`);
    }
  }
}

for (const legacy of await commandExampleFiles(commandsRoot)) {
  errors.push(`${path.relative(commandsRoot, legacy)}: nonstandard command example suffix; use .command.example.config`);
}

for (const contract of await commandContracts(commandsRoot)) {
  const relative = path.relative(commandsRoot, contract);
  const commandId = path.basename(contract, '.command.md');
  const exampleConfig = path.join(path.dirname(contract), `${commandId}.command.example.config`);
  const content = await readFile(contract, 'utf8');
  const headings = [...content.matchAll(/^## ([^\n]+)$/gm)].map((match) => match[1]);
  const opening = headings.slice(0, 4).join('|');
  if (opening !== 'Purpose|Inputs|Outputs|Entry Point') {
    errors.push(`${relative}: first sections must be Purpose, Inputs, Outputs, Entry Point; found ${opening || '<none>'}`);
  }
  if (!/^## Inputs$/m.test(content)) errors.push(`${relative}: missing exact ## Inputs section`);
  if (!/^## Outputs$/m.test(content)) errors.push(`${relative}: missing exact ## Outputs section`);
  if (!/^## Entry Point$/m.test(content)) errors.push(`${relative}: missing exact ## Entry Point section`);
  const purpose = content.match(/^## Purpose\n\n([\s\S]*?)(?=\n## |$)/m)?.[1].trim() ?? '';
  if (!purpose) errors.push(`${relative}: Purpose must contain a concrete command-specific description`);
  if (/^Use `[^`]+` for the bounded behavior defined by this command contract\.$/.test(purpose)) {
    errors.push(`${relative}: Purpose uses the prohibited generic placeholder`);
  }
  if (!/^\| Input \| Required \| Source \| Description \|$/m.test(content)) {
    errors.push(`${relative}: missing canonical Inputs table header`);
  }
  if (!/^\| Output \| Destination \| Description \|$/m.test(content)) {
    errors.push(`${relative}: missing canonical Outputs table header`);
  }
  if (!/^\| Entry point \| Type \| Profile-aware invocation \|$/m.test(content)) {
    errors.push(`${relative}: missing canonical Entry Point table header`);
  }
  if (!/Every invocation is profile-aware:/m.test(content)) {
    errors.push(`${relative}: Entry Point must declare profile-aware invocation`);
  }
  const relativeExampleConfig = path.relative(commandsRoot, exampleConfig);
  if (!content.includes(`Committed configuration template: \`${relativeExampleConfig}\``) ||
      !content.includes('`commands[].config`') || !content.includes('`AI_COMMAND_CONFIG_PATH`')) {
    errors.push(`${relative}: Entry Point must document its committed example and profile-owned configuration binding`);
  }
  try {
    const example = await readFile(exampleConfig, 'utf8');
    if (!example.includes('COMMITTED EXAMPLE ONLY') || !example.includes('commands[].config') ||
        !example.includes('AI_COMMAND_CONFIG_PATH')) {
      errors.push(`${relativeExampleConfig}: missing committed-example and profile-binding header`);
    }
  } catch {
    errors.push(`${relative}: missing required ${commandId}.command.example.config`);
  }
  const entryPointBody = content.match(/^## Entry Point\n\n([\s\S]*?)(?=\n## |(?![\s\S]))/m)?.[1] ?? '';
  const entryRows = [...entryPointBody.matchAll(/^\| `([^`]+)` \| (Shell executable|Node executable|Command-owned UI launcher|AI-readable contract) \|/gm)];
  if (entryRows.length === 0) {
    errors.push(`${relative}: Entry Point must declare at least one supported entry point`);
  }
  for (const [, entryPath, entryType] of entryRows) {
    if (path.isAbsolute(entryPath) || entryPath.split('/').includes('..')) {
      errors.push(`${relative}: unsafe Entry Point path ${entryPath}`);
      continue;
    }
    const resolved = path.join(commandsRoot, entryPath);
    try {
      const entryStat = await stat(resolved);
      if (!entryStat.isFile()) errors.push(`${relative}: Entry Point is not a file: ${entryPath}`);
      if (['Shell executable', 'Command-owned UI launcher'].includes(entryType) && (entryStat.mode & 0o111) === 0) {
        errors.push(`${relative}: executable Entry Point lacks execute permission: ${entryPath}`);
      }
    } catch {
      errors.push(`${relative}: missing Entry Point file ${entryPath}`);
    }
  }
}

if (errors.length) {
  console.error('command structure: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('command structure: PASS');

async function commandExampleFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.venv'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await commandExampleFiles(target));
    else if (/\.command\.example\.(conf|ya?ml)$/.test(entry.name)) found.push(target);
  }
  return found;
}
