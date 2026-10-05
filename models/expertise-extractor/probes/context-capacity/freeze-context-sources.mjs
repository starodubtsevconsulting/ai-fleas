#!/usr/bin/env node
/**
 * Freezes the meaningful tracked-source inventory for the Context Capacity probe.
 * Caller: a benchmark maintainer before packet rendering; it is not automatic runtime code.
 * Invocation: node models/expertise-extractor/probes/context-capacity/freeze-context-sources.mjs
 * Inputs: context-sources.config.json and Git-tracked files under its declared roots.
 * Output: context-sources.json beside this script, with an ordered path/byte/SHA-256 inventory.
 * Effects: overwrites only context-sources.json; it does not tokenize, contact Hermes/GX10,
 * mutate profiles, run a model, or claim that the resulting corpus reaches a token target.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../../..');
const configPath = path.join(scriptDirectory, 'context-sources.config.json');
const outputPath = path.join(scriptDirectory, 'context-sources.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const excludedPaths = config.excluded_path_patterns.map((pattern) => new RegExp(pattern));
const forbiddenContent = config.forbidden_content_patterns.map((pattern) => new RegExp(pattern, 'iu'));
const extensions = new Set(config.extensions);

const tracked = execFileSync('git', ['ls-files', '-z', '--', ...config.roots], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean).sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));

const sources = [];
const excluded = { path_policy: [], forbidden_content: [], unsupported_extension: [] };
for (const relativePath of tracked) {
  if (!extensions.has(path.extname(relativePath))) {
    excluded.unsupported_extension.push(relativePath);
    continue;
  }
  if (excludedPaths.some((pattern) => pattern.test(relativePath))) {
    excluded.path_policy.push(relativePath);
    continue;
  }
  const bytes = readFileSync(path.join(repositoryRoot, relativePath));
  const text = bytes.toString('utf8');
  if (forbiddenContent.some((pattern) => pattern.test(text))) {
    excluded.forbidden_content.push(relativePath);
    continue;
  }
  sources.push({
    id: `tracked:${relativePath}`,
    path: relativePath,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

const selectedBytes = sources.reduce((total, source) => total + source.bytes, 0);
if (selectedBytes < config.minimum_selected_bytes) {
  throw new Error(`Selected corpus is ${selectedBytes} bytes; minimum is ${config.minimum_selected_bytes}`);
}

const inventoryDigest = createHash('sha256');
for (const source of sources) {
  inventoryDigest.update(source.id);
  inventoryDigest.update('\0');
  inventoryDigest.update(source.sha256);
  inventoryDigest.update('\0');
}

const output = {
  schema_version: '1.0.0',
  status: 'source-inventory-frozen-tokenization-pending',
  selection_config_sha256: createHash('sha256').update(readFileSync(configPath)).digest('hex'),
  ordering: config.ordering,
  selected_source_count: sources.length,
  selected_bytes: selectedBytes,
  inventory_sha256: inventoryDigest.digest('hex'),
  packet_targets: config.packet_targets,
  delivery: config.delivery,
  sources,
  exclusions: {
    path_policy_count: excluded.path_policy.length,
    forbidden_content_count: excluded.forbidden_content.length,
    unsupported_extension_count: excluded.unsupported_extension.length,
    forbidden_content_paths: excluded.forbidden_content,
  },
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
console.log(JSON.stringify({
  output: path.relative(repositoryRoot, outputPath),
  selected_source_count: output.selected_source_count,
  selected_bytes: output.selected_bytes,
  inventory_sha256: output.inventory_sha256,
}, null, 2));
