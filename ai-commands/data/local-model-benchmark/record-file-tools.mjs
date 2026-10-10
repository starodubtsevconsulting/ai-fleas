#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const values = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 === 0 ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const eventFile = `${values['run-directory']}/pi-events.jsonl`;
let apiCalls = null, terminalTokens = null;
try {
  const events = (await readFile(eventFile, 'utf8')).trim().split('\n').map(JSON.parse);
  const turns = events.filter(event => event.type === 'turn_end');
  apiCalls = turns.length;
  terminalTokens = turns.at(-1)?.message?.usage?.totalTokens ?? null;
} catch { /* Hermes and blocked runs have no Pi event stream. */ }
let wallTimeSeconds = null;
try { wallTimeSeconds = Number((await readFile(`${values['run-directory']}/wall-time-seconds.txt`, 'utf8')).trim()); } catch { /* no accepted run */ }
const accepted = values.status === 'accepted';
const result = {
  schema_version: '1.0.0', date: values.date, status: accepted ? 'accepted' : values.status,
  deployment: values.deployment, model: { directory: values['model-directory'], id: values.model },
  configuration: { harness: values.harness, suite: 'file-tools', run_artifacts: 'private-ignored' },
  workload: { fixture: 'notes/benchmarks/local-models/fixtures/hermes-file-tools', acceptance: 'Independent byte-for-byte comparison of NORMALIZED.txt and REPORT.txt.' },
  observations: accepted ? { wall_time_seconds: wallTimeSeconds, model_api_calls: apiCalls, terminal_usage_total_tokens: terminalTokens, verifier: 'passed' } : { reason: values.reason, verifier: 'not run or not passed' },
  invalidating_conditions: accepted ? ['One run only; repeat before comparing candidates.'] : ['This harness result is blocked and is not a model-quality score.'],
  conclusion: { summary: accepted ? `One ${values.harness} run passed the fixed fixture.` : `${values.harness} did not produce an accepted fixture result.`, does_not_prove: 'Results apply only to this harness, served configuration, and fixed task.' },
  references: ['notes/benchmarks/local-models/methodology.md', 'notes/benchmarks/local-models/fixtures/hermes-file-tools/README.md']
};
await writeFile(values.output, `${JSON.stringify(result, null, 2)}\n`);
