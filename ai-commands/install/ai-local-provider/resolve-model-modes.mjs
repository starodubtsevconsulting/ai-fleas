#!/usr/bin/env node
import fs from 'node:fs';
import { parse } from 'yaml';

const [file, boxId, requestedMode = ''] = process.argv.slice(2);
const fail = message => { process.stderr.write(`${message}\n`); process.exit(2); };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const localUrlPattern = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[A-Za-z0-9._~/?=&%-]*$/;
const publicUrlPattern = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[A-Za-z0-9._~/?=&%-]*$/;

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
  const verification = definition.verification || {};
  if (typeof service !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9@._-]*\.service$/.test(service)) fail(`CONFIGURATION_INVALID: mode '${id}' requires a safe systemd .service name.`);
  if (!['user', 'system'].includes(manager)) fail(`CONFIGURATION_INVALID: mode '${id}' has invalid manager.`);
  if (healthUrl && (typeof healthUrl !== 'string' || !localUrlPattern.test(healthUrl))) fail(`CONFIGURATION_INVALID: mode '${id}' health_url must use localhost HTTP(S).`);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1800) fail(`CONFIGURATION_INVALID: mode '${id}' health_timeout_seconds must be 1..1800.`);
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) fail(`CONFIGURATION_INVALID: mode '${id}' verification must be an object.`);
  const publicUrl = verification.public_url || '';
  const publicStatuses = verification.public_expected_statuses || [200, 302];
  const generationUrl = verification.generation_url || '';
  const generationRequest = verification.generation_request || {};
  const generationTimeout = Number(verification.generation_timeout_seconds || 600);
  const generationResponsePath = verification.generation_response_json_path || 'data.0.url';
  if (publicUrl && (typeof publicUrl !== 'string' || !publicUrlPattern.test(publicUrl))) fail(`CONFIGURATION_INVALID: mode '${id}' verification.public_url must use public HTTPS.`);
  if (!Array.isArray(publicStatuses) || publicStatuses.length === 0 || publicStatuses.some(status => !Number.isInteger(status) || status < 200 || status > 399)) fail(`CONFIGURATION_INVALID: mode '${id}' verification.public_expected_statuses must contain HTTP 2xx/3xx codes.`);
  if (generationUrl && (typeof generationUrl !== 'string' || !localUrlPattern.test(generationUrl))) fail(`CONFIGURATION_INVALID: mode '${id}' verification.generation_url must use localhost HTTP(S).`);
  if (!generationRequest || typeof generationRequest !== 'object' || Array.isArray(generationRequest)) fail(`CONFIGURATION_INVALID: mode '${id}' verification.generation_request must be an object.`);
  if (!Number.isInteger(generationTimeout) || generationTimeout < 1 || generationTimeout > 1800) fail(`CONFIGURATION_INVALID: mode '${id}' verification.generation_timeout_seconds must be 1..1800.`);
  if (typeof generationResponsePath !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(generationResponsePath)) fail(`CONFIGURATION_INVALID: mode '${id}' verification.generation_response_json_path is invalid.`);
  normalized[id] = {
    service, manager, health_url: healthUrl, health_timeout_seconds: timeout,
    verification: {
      public_url: publicUrl,
      public_expected_statuses: publicStatuses,
      generation_url: generationUrl,
      generation_request: generationRequest,
      generation_timeout_seconds: generationTimeout,
      generation_response_json_path: generationResponsePath,
    },
  };
}
if (requestedMode && !Object.prototype.hasOwnProperty.call(normalized, requestedMode)) fail(`MODEL_MODE_NOT_FOUND: ${requestedMode}`);
process.stdout.write(Buffer.from(JSON.stringify({ modes: normalized }), 'utf8').toString('base64'));
