import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const srcDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(srcDir, '..');
export const commandsRoot = path.resolve(packageRoot, '..');
export const repoRoot = path.resolve(commandsRoot, '..');

export function isWithinPath(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
