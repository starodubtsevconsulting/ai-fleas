#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const commandsRoot = path.dirname(fileURLToPath(import.meta.url));
const categories = new Set(['install', 'data', 'connect', 'development', 'content', 'system', 'utility']);
const internalDirectories = new Set(['.venv', '_runtime', 'assets', 'tooling']);
const rootCompatibilityDirectories = new Set(['.codex', 'browser']);
const allowedTypes = new Set(['contract', 'executable', 'adapter', 'provider', 'flow', 'visual']);
const errors = [];
const commandIds = new Set();

async function existsFile(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

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

async function commandBundles() {
  const bundles = [];
  for (const categoryEntry of await readdir(commandsRoot, { withFileTypes: true })) {
    if (!categoryEntry.isDirectory() || internalDirectories.has(categoryEntry.name) || rootCompatibilityDirectories.has(categoryEntry.name)) continue;
    if (!categories.has(categoryEntry.name)) {
      errors.push(`${categoryEntry.name}: public command directories must live inside a registered category`);
      continue;
    }

    const category = categoryEntry.name;
    const categoryDir = path.join(commandsRoot, category);

    if (await existsFile(path.join(categoryDir, `${category}.command.md`))) {
      bundles.push({ id: category, category, directory: categoryDir });
    }

    for (const entry of await readdir(categoryDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || internalDirectories.has(entry.name)) continue;
      const directory = path.join(categoryDir, entry.name);
      if (await existsFile(path.join(directory, `${entry.name}.command.md`))) {
        bundles.push({ id: entry.name, category, directory });
      }
    }
  }
  return bundles;
}

async function resolveLogicalCommandPath(logicalPath) {
  const direct = path.join(commandsRoot, logicalPath);
  if (await existsFile(direct)) return direct;

  const matches = [];
  for (const category of categories) {
    const candidate = path.join(commandsRoot, category, logicalPath);
    if (await existsFile(candidate)) matches.push(candidate);
  }
  if (matches.length === 1) return matches[0];
  return null;
}

for (const bundle of await commandBundles()) {
  const { id, category, directory } = bundle;
  if (commandIds.has(id)) errors.push(`${id}: duplicate public command id across categories`);
  commandIds.add(id);

  const contract = path.join(directory, `${id}.command.md`);
  if (!await existsFile(contract)) errors.push(`${category}/${id}: missing ${id}.command.md`);

  const manifest = path.join(directory, `${id}.command.yml`);
  const relativeManifest = path.relative(commandsRoot, manifest);
  try {
    const metadata = await readFile(manifest, 'utf8');
    const manifestId = metadata.match(/^id:\s*([^\s#]+)\s*$/m)?.[1];
    const version = metadata.match(/^version:\s*([^\s#]+)\s*$/m)?.[1];
    const manifestCategory = metadata.match(/^category:\s*([^\s#]+)\s*$/m)?.[1];
    const type = metadata.match(/^type:\s*([^\s#]+)\s*$/m)?.[1];
    const powered = metadata.match(/^ai:\s*\n(?:[ \t]+.*\n)*?[ \t]+powered:\s*(true|false)\s*$/m)?.[1];

    if (manifestId !== id) errors.push(`${relativeManifest}: id must be ${id}`);
    if (!version) errors.push(`${relativeManifest}: missing version`);
    if (manifestCategory !== category) errors.push(`${relativeManifest}: category must be ${category}`);
    if (!allowedTypes.has(type)) errors.push(`${relativeManifest}: type must be one of ${[...allowedTypes].join(', ')}`);
    if (!powered) errors.push(`${relativeManifest}: missing boolean ai.powered; expected true or false`);
  } catch {
    errors.push(`${category}/${id}: missing required ${id}.command.yml`);
  }

  const bundleEntries = await readdir(directory);
  for (const file of bundleEntries) {
    if (/\.command\.example\.(conf|config|ya?ml)$/.test(file) &&
        !new RegExp(`^${id}(?:-[a-z0-9]+)*\\.command\\.example\\.`).test(file)) {
      errors.push(`${category}/${id}/${file}: command example must match <command-id>.command.example.<extension>`);
    }
    if (/\.spec\.md$/.test(file) && file !== 'spec.md') {
      errors.push(`${category}/${id}/${file}: bundle specification must be named spec.md`);
    }
    if (/test-scenarios?\.md$/.test(file)) {
      errors.push(`${category}/${id}/${file}: live scenario must be named ${id}.scenario.md`);
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
  const logicalExampleConfig = `${commandId}/${commandId}.command.example.config`;
  const physicalExampleConfig = path.relative(commandsRoot, exampleConfig);
  const content = await readFile(contract, 'utf8');
  const planPath = path.join(path.dirname(contract), 'PLAN.md');
  try {
    const plan = await readFile(planPath, 'utf8');
    const stepIds = [...plan.matchAll(/<!-- PLAN_STEP: ([A-Z][A-Z0-9-]*-[0-9][0-9]) -->/g)].map((match) => match[1]);
    if (stepIds.length === 0) errors.push(`${path.relative(commandsRoot, planPath)}: missing stable PLAN_STEP markers`);
    if (new Set(stepIds).size !== stepIds.length) errors.push(`${path.relative(commandsRoot, planPath)}: duplicate PLAN_STEP marker`);
    if (!/\[(?:`)?PLAN\.md(?:`)?\]\(PLAN\.md\)/.test(content)) errors.push(`${relative}: adjacent PLAN.md must be linked as [PLAN.md](PLAN.md)`);
  } catch (error) {
    if (error?.code !== 'ENOENT') errors.push(`${path.relative(commandsRoot, planPath)}: cannot read optional execution plan`);
  }

  const headings = [...content.matchAll(/^## ([^\n]+)$/gm)].map((match) => match[1]);
  const opening = headings.slice(0, 4).join('|');
  if (opening !== 'Purpose|Inputs|Outputs|Entry Point') errors.push(`${relative}: first sections must be Purpose, Inputs, Outputs, Entry Point; found ${opening || '<none>'}`);
  if (!/^## Inputs$/m.test(content)) errors.push(`${relative}: missing exact ## Inputs section`);
  if (!/^## Outputs$/m.test(content)) errors.push(`${relative}: missing exact ## Outputs section`);
  if (!/^## Entry Point$/m.test(content)) errors.push(`${relative}: missing exact ## Entry Point section`);
  const purpose = content.match(/^## Purpose\n\n([\s\S]*?)(?=\n## |$)/m)?.[1].trim() ?? '';
  if (!purpose) errors.push(`${relative}: Purpose must contain a concrete command-specific description`);
  if (/^Use `[^`]+` for the bounded behavior defined by this command contract\.$/.test(purpose)) errors.push(`${relative}: Purpose uses the prohibited generic placeholder`);
  if (!/^\| Input \| Required \| Source \| Description \|$/m.test(content)) errors.push(`${relative}: missing canonical Inputs table header`);
  if (!/^\| Output \| Destination \| Description \|$/m.test(content)) errors.push(`${relative}: missing canonical Outputs table header`);
  if (!/^\| Entry point \| Type \| Profile-aware invocation \|$/m.test(content)) errors.push(`${relative}: missing canonical Entry Point table header`);
  if (!/Every invocation is profile-aware:/m.test(content)) errors.push(`${relative}: Entry Point must declare profile-aware invocation`);

  if ((!content.includes(`Committed configuration template: \`${logicalExampleConfig}\``) &&
       !content.includes(`Committed configuration template: \`${physicalExampleConfig}\``)) ||
      !content.includes('`commands[].config`') || !content.includes('`AI_COMMAND_CONFIG_PATH`')) {
    errors.push(`${relative}: Entry Point must document its committed example and profile-owned configuration binding`);
  }

  try {
    const example = await readFile(exampleConfig, 'utf8');
    if (!example.includes('COMMITTED EXAMPLE ONLY') || !example.includes('commands[].config') || !example.includes('AI_COMMAND_CONFIG_PATH')) {
      errors.push(`${physicalExampleConfig}: missing committed-example and profile-binding header`);
    }
  } catch {
    errors.push(`${relative}: missing required ${commandId}.command.example.config`);
  }

  const entryPointBody = content.match(/^## Entry Point\n\n([\s\S]*?)(?=\n## |(?![\s\S]))/m)?.[1] ?? '';
  const entryRows = [...entryPointBody.matchAll(/^\| `([^`]+)` \| (Shell executable|Node executable|Command-owned UI launcher|AI-readable contract) \|/gm)];
  if (entryRows.length === 0) errors.push(`${relative}: Entry Point must declare at least one supported entry point`);
  for (const [, entryPath, entryType] of entryRows) {
    if (path.isAbsolute(entryPath) || entryPath.split('/').includes('..')) {
      errors.push(`${relative}: unsafe Entry Point path ${entryPath}`);
      continue;
    }
    const resolved = await resolveLogicalCommandPath(entryPath);
    if (!resolved) {
      errors.push(`${relative}: missing or ambiguous Entry Point file ${entryPath}`);
      continue;
    }
    const entryStat = await stat(resolved);
    if (['Shell executable', 'Command-owned UI launcher'].includes(entryType) && (entryStat.mode & 0o111) === 0) {
      errors.push(`${relative}: executable Entry Point lacks execute permission: ${entryPath}`);
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
