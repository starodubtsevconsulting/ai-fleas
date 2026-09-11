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
  process.exit(model.repository && model.file && model.quantization ? 0 : 3);
}
if (field?.startsWith('preset-field:')) {
  const path = field.slice('preset-field:'.length).split('.');
  let value = data;
  for (const part of path) value = value && typeof value === 'object' ? value[part] : undefined;
  if (value === undefined || value === null || typeof value === 'object') process.exit(3);
  process.stdout.write(String(value));
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
