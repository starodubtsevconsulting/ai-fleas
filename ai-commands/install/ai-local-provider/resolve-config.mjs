#!/usr/bin/env node
import fs from 'node:fs';
import { parse } from 'yaml';

const [file, boxId, field] = process.argv.slice(2);
const fail = message => { process.stderr.write(`${message}\n`); process.exit(2); };
if (!file || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) fail('CONFIGURATION_REQUIRED: readable config file required.');
let data;
try { data = parse(fs.readFileSync(file, 'utf8')) || {}; } catch { fail('CONFIGURATION_INVALID: YAML could not be parsed.'); }
if (field === 'preset-ready') {
  const model = data.model || {};
  process.exit(model.repository && model.file && model.api_alias && model.quantization ? 0 : 3);
}
if (field?.startsWith('preset-field:')) {
  const path = field.slice('preset-field:'.length).split('.');
  let value = data;
  for (const part of path) value = value && typeof value === 'object' ? value[part] : undefined;
  if (value === undefined || value === null || typeof value === 'object') process.exit(3);
  process.stdout.write(String(value));
  process.exit(0);
}
if (field === 'model-manifest') {
  const model = data.model || {};
  const files = model.files || (model.file ? [{ file: model.file, size_bytes: model.size_bytes, sha256: model.sha256 }] : []);
  if (!Array.isArray(files) || files.length === 0) fail('PRESET_INVALID: model files must be a non-empty list.');
  for (const item of files) {
    if (!item || typeof item.file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.gguf$/.test(item.file) ||
        !Number.isSafeInteger(item.size_bytes) || item.size_bytes <= 0 ||
        typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      fail('PRESET_INVALID: each model file needs a safe GGUF basename, positive integer size, and lowercase SHA256.');
    }
  }
  process.stdout.write(files.map(({ file, size_bytes, sha256 }) => `${file}|${size_bytes}|${sha256}`).join(','));
  process.exit(0);
}
if (field === 'model-total-bytes') {
  const model = data.model || {};
  const files = model.files || (model.file ? [{ file: model.file, size_bytes: model.size_bytes, sha256: model.sha256 }] : []);
  if (!Array.isArray(files) || files.length === 0 || files.some(item => !Number.isSafeInteger(item?.size_bytes) || item.size_bytes <= 0)) fail('PRESET_INVALID: invalid model file sizes.');
  const total = files.reduce((sum, item) => sum + item.size_bytes, 0);
  if (!Number.isSafeInteger(total)) fail('PRESET_INVALID: total model size is too large.');
  process.stdout.write(String(total));
  process.exit(0);
}
const boxes = data.boxes && typeof data.boxes === 'object' ? data.boxes : {};
if (field === 'list') {
  for (const [id, box] of Object.entries(boxes)) {
    const destination = box?.ssh_alias || [box?.user, box?.host].filter(Boolean).join('@') || 'incomplete';
    process.stdout.write(`  ${id}\t${destination}\n`);
  }
  process.stdout.write('  +\tAdd new machine\n');
  process.exit(0);
}
if (!Object.prototype.hasOwnProperty.call(boxes, boxId)) fail(`CONFIGURATION_REQUIRED: unknown box '${boxId}'.`);
if (field === 'exists') process.exit(0);
const box = boxes[boxId] || {};
const defaults = data.defaults || {};
const value = box[field] ?? defaults[field] ?? '';
if (typeof value === 'object' || /[\t\r\n]/.test(String(value))) fail(`CONFIGURATION_INVALID: invalid ${field}.`);
process.stdout.write(String(value));
