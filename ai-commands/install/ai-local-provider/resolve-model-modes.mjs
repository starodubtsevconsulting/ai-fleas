#!/usr/bin/env node
import fs from 'node:fs';
import { parse } from 'yaml';

const [file, boxId, requestedMode = ''] = process.argv.slice(2);
const fail = message => { process.stderr.write(`${message}\n`); process.exit(2); };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

if (!file || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) fail('CONFIGURATION_REQUIRED: readable profile command configuration required.');
let data;
try { data = parse(fs.readFileSync(file, 'utf8')) || {}; } catch { fail('CONFIGURATION_INVALID: YAML could not be parsed.'); }
const box = data.boxes?.[boxId];
if (!box || typeof box !== 'object') fail(`CONFIGURATION_REQUIRED: unknown box '${boxId}'.`);
const modes = box.model_modes;
if (!modes || typeof modes !== 'object' || Array.isArray(modes) || Object.keys(modes).length === 0) fail(`MODEL_MODES_NOT_CONFIGURED: box '${boxId}' has no model_modes.`);

const normalized = {};
for (const [id, definition] of Object.entries(modes)) {
  if (!idPattern.test(id) || !definition || typeof definition !== 'object') fail(`CONFIGURATION_INVALID: invalid model mode '${id}'.`);
  const service = definition.service;
  const manager = definition.manager || 'user';
  const healthUrl = definition.health_url || '';
  const timeout = Number(definition.health_timeout_seconds || 180);
  if (typeof service !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9@._-]*\.service$/.test(service)) fail(`CONFIGURATION_INVALID: mode '${id}' requires a safe systemd .service name.`);
  if (!['user', 'system'].includes(manager)) fail(`CONFIGURATION_INVALID: mode '${id}' has invalid manager.`);
  if (healthUrl && (typeof healthUrl !== 'string' || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[A-Za-z0-9._~/?=&%-]*$/.test(healthUrl))) fail(`CONFIGURATION_INVALID: mode '${id}' health_url must use localhost HTTP(S).`);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1800) fail(`CONFIGURATION_INVALID: mode '${id}' health_timeout_seconds must be 1..1800.`);
  normalized[id] = { service, manager, health_url: healthUrl, health_timeout_seconds: timeout };
}
if (requestedMode && !Object.prototype.hasOwnProperty.call(normalized, requestedMode)) fail(`MODEL_MODE_NOT_FOUND: ${requestedMode}`);
process.stdout.write(Buffer.from(JSON.stringify({ modes: normalized }), 'utf8').toString('base64'));
