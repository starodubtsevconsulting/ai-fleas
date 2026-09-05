import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const publicRoot = process.env.AI_WORKFLOWS_PUBLIC_MIRROR_ROOT;

const mappings = [
  ['ai-workflows/public-README.md', 'README.md'],
  ['ai-workflows/agents.md', 'agents.md'],
  ['ai-workflows/role-capability-matrix.md', 'role-capability-matrix.md'],
  ['ai-workflows/role-capability-matrix.csv', 'role-capability-matrix.csv'],
  ['ai-workflows/role-capability-ownership.csv', 'role-capability-ownership.csv'],
  ['ai-workflows/role-communication-matrix.csv', 'role-communication-matrix.csv'],
];

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('common workflow matrices have unique exact public mappings and identical artifacts', () => {
  assert.ok(publicRoot, 'AI_WORKFLOWS_PUBLIC_MIRROR_ROOT is required for exact-mirror validation');
  const registry = fs.readFileSync(path.join(repositoryRoot, 'ai-publication.yml'), 'utf8');
  const registeredSources = [...registry.matchAll(/^    privateSource: (ai-workflows\/(?:public-README\.md|agents\.md|role-capability-(?:matrix\.(?:md|csv)|ownership\.csv)|role-communication-matrix\.csv))$/gm)]
    .map((match) => match[1]);
  assert.deepEqual(registeredSources.sort(), mappings.map(([source]) => source).sort(),
    'common workflow mappings must be present exactly once with no overlap');

  for (const [source, target] of mappings) {
    const escapedSource = source.replaceAll('.', '\\.');
    const escapedTarget = target.replaceAll('.', '\\.');
    const mappingPattern = new RegExp(
      `privateSource: ${escapedSource}\\n    publicRepository: starodubtsevconsulting/ai-workflows\\n    publicPath: ${escapedTarget}`,
    );
    assert.match(registry, mappingPattern, `${source} must map to the exact public target`);

    const privatePath = path.join(repositoryRoot, source);
    const publicPath = path.join(publicRoot, target);
    const privateStat = fs.lstatSync(privatePath);
    const publicStat = fs.lstatSync(publicPath);
    assert.equal(privateStat.isSymbolicLink(), false, `${source} must not be a symlink`);
    assert.equal(publicStat.isSymbolicLink(), false, `${target} must not be a symlink`);
    assert.equal(privateStat.isFile(), true, `${source} must be a regular file`);
    assert.equal(publicStat.isFile(), true, `${target} must be a regular file`);
    assert.equal(privateStat.mode & 0o777, publicStat.mode & 0o777, `${target} mode must match`);
    assert.equal(sha256(privatePath), sha256(publicPath), `${target} bytes must match`);
  }
});
