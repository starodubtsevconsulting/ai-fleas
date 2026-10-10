#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = Object.fromEntries(Array.from({ length: process.argv.length - 2 }, (_, index) => index % 2 === 0 ? [process.argv[index + 2].replace(/^--/, ''), process.argv[index + 3]] : null).filter(Boolean));
const fail = message => { process.stderr.write(`${message}\n`); process.exit(2); };
const endpoint = args.endpoint?.replace(/\/$/, '');
const model = args.model;
const output = args.output;
const machineLabel = args['machine-label'];
const repeat = Number(args.repeat);
const benchmarkDate = args.date;
if (!endpoint || !model || !output || !machineLabel || !Number.isInteger(repeat) || !benchmarkDate) fail('BENCHMARK_CONFIGURATION_INVALID');
if (benchmarkDate !== 'auto' && !/^\d{4}-\d{2}-\d{2}$/.test(benchmarkDate)) fail('DATE_INVALID');

const request = {
  model,
  messages: [{ role: 'user', content: 'Reply with exactly the word READY.' }],
  temperature: 0,
  max_tokens: 128,
  stream: false,
  chat_template_kwargs: { enable_thinking: false },
};

async function completion() {
  const started = performance.now();
  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(180_000),
  });
  const elapsedMs = performance.now() - started;
  if (!response.ok) throw new Error(`completion returned HTTP ${response.status}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (content !== 'READY') throw new Error('completion did not return the fixed response');
  return { wall_ms: Number(elapsedMs.toFixed(3)), usage: payload.usage ?? {}, timings: payload.timings ?? {} };
}

try {
  await completion();
  const runs = [];
  for (let index = 0; index < repeat; index += 1) runs.push(await completion());
  const numberValues = field => runs.map(run => Number(run[field] ?? run.timings?.[field])).filter(Number.isFinite);
  const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null; };
  const date = benchmarkDate === 'auto' ? new Date().toISOString().slice(0, 10) : benchmarkDate;
  const result = {
    schema_version: '1.0.0',
    date,
    status: 'measured-runtime-only',
    deployment: machineLabel,
    model: { id: model },
    configuration: {
      endpoint_scope: new URL(endpoint).hostname === '127.0.0.1' || new URL(endpoint).hostname === 'localhost' ? 'loopback' : 'network',
      suite: 'runtime-text',
      warmup_runs: 1,
      measured_runs: repeat,
    },
    workload: {
      prompt: request.messages[0].content,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      expected_response: 'READY',
    },
    observations: {
      median_wall_ms: median(numberValues('wall_ms')),
      median_prompt_tokens_per_second: median(numberValues('prompt_per_second')),
      median_generation_tokens_per_second: median(numberValues('predicted_per_second')),
      runs,
    },
    invalidating_conditions: [],
    conclusion: {
      runtime_measurement_only: true,
      summary: 'This record measures fixed short text-completion runtime only. It does not establish tool-use, coding quality, long-context capacity, multimodal capability, or general model quality.',
    },
    references: ['ai-commands/data/local-model-benchmark/local-model-benchmark.command.md'],
  };
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`SUCCESS: wrote ${repeat} measured text-runtime runs to ${output}\n`);
} catch (error) {
  process.stderr.write(`BENCHMARK_FAILED: ${error.message}\n`);
  process.exit(1);
}
