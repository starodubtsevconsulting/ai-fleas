#!/usr/bin/env node
/**
 * Renders the fixed distributed-contract packet with the exact configured model tokenizer.
 * Caller: a benchmark maintainer after freeze-context-sources.mjs and before live runs.
 * Invocation: set CONTEXT_CAPACITY_TOKENIZER_ARGV to a JSON argv array, then run this file.
 * Inputs: context-sources.json plus the integration fixture's three contracts and final task.
 * Outputs: packet-manifest.json here and ignored chunk files under the declared benchmark run path.
 * Effects: overwrites only those generated outputs; invokes a read-only tokenizer command via stdin.
 * It performs no inference, edits no Hermes/GX10 configuration, and makes no benchmark-result claim.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../../..');
const sourceManifestPath = path.join(scriptDirectory, 'context-sources.json');
const outputManifestPath = path.join(scriptDirectory, 'packet-manifest.json');
const outputDirectory = path.join(repositoryRoot, 'notes/benchmarks/local-models/runs/context-capacity-packet');
const fixtureDirectory = path.join(repositoryRoot, 'notes/benchmarks/local-models/fixtures/hermes-context-capacity-integration');

const tokenizerArgvRaw = process.env.CONTEXT_CAPACITY_TOKENIZER_ARGV;
if (!tokenizerArgvRaw) {
  throw new Error('CONTEXT_CAPACITY_TOKENIZER_ARGV must be a JSON argv array');
}
const tokenizerArgv = JSON.parse(tokenizerArgvRaw);
if (!Array.isArray(tokenizerArgv) || tokenizerArgv.length === 0 || tokenizerArgv.some((part) => typeof part !== 'string' || !part)) {
  throw new Error('CONTEXT_CAPACITY_TOKENIZER_ARGV must contain nonempty strings');
}

const tokenizerIdentity = {
  id: process.env.CONTEXT_CAPACITY_TOKENIZER_ID || 'Qwen3-Coder-Next-GGUF-tokenizer',
  version: process.env.CONTEXT_CAPACITY_TOKENIZER_VERSION || 'unrecorded',
};
if (tokenizerIdentity.version === 'unrecorded') {
  throw new Error('CONTEXT_CAPACITY_TOKENIZER_VERSION is required');
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sourceManifestBytes = readFileSync(sourceManifestPath);
const sourceManifest = JSON.parse(sourceManifestBytes);
const targets = sourceManifest.packet_targets;
const tolerance = targets.placement_tolerance_tokens;

function tokenize(content, withPieces = false) {
  const request = JSON.stringify({ content, with_pieces: withPieces });
  const result = spawnSync(tokenizerArgv[0], tokenizerArgv.slice(1), {
    cwd: repositoryRoot,
    input: request,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Tokenizer exited ${result.status}: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  if (!Array.isArray(parsed.tokens)) throw new Error('Tokenizer response lacks tokens array');
  if (withPieces) {
    const invalidToken = parsed.tokens.find((token) =>
      !token ||
      typeof token.id !== 'number' ||
      !(typeof token.piece === 'string' ||
        (Array.isArray(token.piece) && token.piece.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)))
    );
    if (invalidToken) {
      throw new Error(`Tokenizer piece response is invalid: ${JSON.stringify(invalidToken)}`);
    }
    return parsed.tokens.map((token) => ({
      id: token.id,
      bytes: typeof token.piece === 'string' ? Buffer.from(token.piece) : Buffer.from(token.piece),
    }));
  }
  if (parsed.tokens.some((token) => !Number.isInteger(token))) throw new Error('Tokenizer ID response is invalid');
  return parsed.tokens;
}

let corpus = '';
for (const source of sourceManifest.sources) {
  const bytes = readFileSync(path.join(repositoryRoot, source.path));
  if (sha256(bytes) !== source.sha256) throw new Error(`Source hash drift: ${source.path}`);
  corpus += `\n\n<<<SOURCE ${source.id} ${source.sha256}>>>\n`;
  corpus += bytes.toString('utf8');
  corpus += `\n<<<END SOURCE ${source.id}>>>\n`;
}

const corpusPieces = tokenize(corpus, true);
if (!Buffer.concat(corpusPieces.map((token) => token.bytes)).equals(Buffer.from(corpus))) {
  throw new Error('Tokenizer pieces do not reconstruct the source corpus byte-for-byte');
}

function consumeUtf8Pieces(pieces, start, requestedCount) {
  let end = Math.min(start + requestedCount, pieces.length);
  while (end < pieces.length) {
    const bytes = Buffer.concat(pieces.slice(start, end).map((token) => token.bytes));
    const text = bytes.toString('utf8');
    if (Buffer.from(text).equals(bytes)) return { end, text };
    end += 1;
  }
  const bytes = Buffer.concat(pieces.slice(start, end).map((token) => token.bytes));
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes)) throw new Error('Could not find a valid UTF-8 piece boundary');
  return { end, text };
}

const fixtureParts = [
  ['EARLY', 'CONTRACT_EARLY.md', targets.early_contract_tokens],
  ['MIDDLE', 'CONTRACT_MIDDLE.md', targets.middle_contract_tokens],
  ['LATE', 'CONTRACT_LATE.md', targets.late_contract_tokens],
  ['TASK', 'TASK.md', targets.final_task_tokens],
];
let corpusIndex = 0;
let packet = '';
const placements = {};

for (const [id, filename, targetTokens] of fixtureParts) {
  const currentTokens = tokenize(packet).length;
  const needed = targetTokens - currentTokens;
  if (needed < 0) throw new Error(`${id} target ${targetTokens} is behind current packet position ${currentTokens}`);
  if (corpusIndex + needed > corpusPieces.length) throw new Error(`Source corpus exhausted before ${id}`);
  const consumed = consumeUtf8Pieces(corpusPieces, corpusIndex, needed);
  packet += consumed.text;
  corpusIndex = consumed.end;
  const measuredOffset = tokenize(packet).length;
  if (Math.abs(measuredOffset - targetTokens) > tolerance) {
    throw new Error(`${id} offset ${measuredOffset} misses target ${targetTokens} ± ${tolerance}`);
  }
  const body = readFileSync(path.join(fixtureDirectory, filename), 'utf8');
  const framed = `\n\n<<<${id}_BEGIN>>>\n${body}\n<<<${id}_END>>>\n`;
  placements[id] = {
    target_tokens: targetTokens,
    measured_offset_tokens: measuredOffset,
    source_path: path.relative(repositoryRoot, path.join(fixtureDirectory, filename)),
    source_sha256: sha256(body),
    framed_sha256: sha256(framed),
  };
  packet += framed;
}

const finalPieces = tokenize(packet, true);
if (!Buffer.concat(finalPieces.map((token) => token.bytes)).equals(Buffer.from(packet))) {
  throw new Error('Final tokenizer pieces do not reconstruct the packet byte-for-byte');
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
const chunks = [];
const chunkPieceLimit = Math.min(3900, sourceManifest.delivery.maximum_chunk_tokens - 128);
for (let index = 0; index < finalPieces.length;) {
  const chunkNumber = chunks.length + 1;
  const consumed = consumeUtf8Pieces(finalPieces, index, chunkPieceLimit);
  const content = consumed.text;
  const measuredTokens = tokenize(content).length;
  if (measuredTokens > sourceManifest.delivery.maximum_chunk_tokens) {
    throw new Error(`Chunk ${chunkNumber} has ${measuredTokens} tokens`);
  }
  const filename = `chunk-${String(chunkNumber).padStart(3, '0')}.txt`;
  writeFileSync(path.join(outputDirectory, filename), content, 'utf8');
  chunks.push({
    index: chunkNumber,
    filename,
    utf8_bytes: Buffer.byteLength(content),
    tokens: measuredTokens,
    sha256: sha256(content),
  });
  index = consumed.end;
}

const packetBytes = Buffer.from(packet);
const output = {
  schema_version: '1.0.0',
  status: 'rendered-packet-no-live-results',
  source_manifest_sha256: sha256(sourceManifestBytes),
  source_inventory_sha256: sourceManifest.inventory_sha256,
  tokenizer: tokenizerIdentity,
  packet: {
    utf8_bytes: packetBytes.length,
    total_tokens: finalPieces.length,
    sha256: sha256(packetBytes),
    cumulative_source_token_pieces_consumed: corpusIndex,
  },
  targets,
  placements,
  delivery: {
    ...sourceManifest.delivery,
    generated_directory: 'notes/benchmarks/local-models/runs/context-capacity-packet',
    chunk_count: chunks.length,
    chunks,
  },
};
writeFileSync(outputManifestPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  output_manifest: path.relative(repositoryRoot, outputManifestPath),
  packet_tokens: output.packet.total_tokens,
  packet_sha256: output.packet.sha256,
  placements: output.placements,
  chunk_count: output.delivery.chunk_count,
}, null, 2));
