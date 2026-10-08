#!/usr/bin/env node
// Compile concise model-specific operating guidance for Hermes agent initialization.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

function fail(message) { console.error(message); process.exit(2); }
const [profilePath, role=''] = process.argv.slice(2);
if (!profilePath || !path.isAbsolute(profilePath) || !fs.existsSync(profilePath)) fail('MODEL_GUIDANCE_INVALID: expertise profile must be an existing absolute path.');
const p = YAML.parse(fs.readFileSync(profilePath, 'utf8')) || {};
if (p.schema_version !== 'ai-fleas-model-expertise.v1') fail('MODEL_GUIDANCE_INVALID: unsupported expertise schema.');
const c = p.communication || {};
const lines = ['## Model-specific operating guidance', '', `Model family: ${p.model_family || 'unknown'}`];
if (c.observed_scope) lines.push(`Evidence scope: ${c.observed_scope}`);
function list(title, values) { if (Array.isArray(values) && values.length) { lines.push('', `### ${title}`); for (const v of values) lines.push(`- ${v}`); } }
list('Start with', c.direct_starting_language);
list('Translate first', c.translate_first);
if (c.handoff_rule) lines.push('', '### Handoff', c.handoff_rule);
if (c.debugging_rule && (!role || role === 'coder' || role === 'designer-reviewer')) lines.push('', '### Debugging', c.debugging_rule);
if (c.verification_rule) lines.push('', '### Verification', c.verification_rule);
list('Observed recurring limits', p.observed?.recurring_limits);
if (p.role_fit?.conditional) list('Conditional role fit', p.role_fit.conditional);
if (Array.isArray(p.unknown) && p.unknown.length) list('Do not assume', p.unknown);
lines.push('', 'Use this guidance as evidence-backed operating policy for this deployment. It supplements the role/workflow rules; it does not expand authority or scope.');
process.stdout.write(lines.join('\n') + '\n');
