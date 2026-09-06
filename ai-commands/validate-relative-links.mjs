#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const commandsRoot = dirname(fileURLToPath(import.meta.url));
const ignoredDirectories = new Set(['.git', '.venv', 'node_modules']);
const failures = [];

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

function proseOnly(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
}

for (const markdownPath of markdownFiles(commandsRoot)) {
  const prose = proseOnly(readFileSync(markdownPath, 'utf8'));
  for (const match of prose.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawDestination = match[1].trim().replace(/^<|>$/g, '');
    const destination = rawDestination.split(/\s+/, 1)[0].split('#', 1)[0];
    if (!destination || /^(?:https?:|mailto:|data:)/i.test(destination)) continue;
    if (destination.includes('<') || destination.includes('${')) continue;
    const resolved = resolve(dirname(markdownPath), decodeURIComponent(destination));
    if (!existsSync(resolved) || (!statSync(resolved).isFile() && !statSync(resolved).isDirectory())) {
      failures.push(`${markdownPath.slice(commandsRoot.length + 1)}: ${rawDestination}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error('relative command links: FAIL');
  process.exit(1);
}

console.log('relative command links: PASS');
