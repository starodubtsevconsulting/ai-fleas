#!/usr/bin/env node
import process from 'node:process';
import readline from 'node:readline';

class BoundedModelClient {
  constructor({ endpoint, model, maxInputChars = 12000, maxOutputTokens = 2048, timeoutMs = 60000 }) {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid model endpoint');
    if (!/^[A-Za-z0-9._:/+-]+$/.test(model)) throw new Error('Invalid model ID');
    for (const [name, value, ceiling] of [['maxInputChars', maxInputChars, 24000], ['maxOutputTokens', maxOutputTokens, 4096], ['timeoutMs', timeoutMs, 120000]]) {
      if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) throw new Error(`Invalid ${name}`);
    }
    this.url = new URL(`${url.toString().replace(/\/$/, '')}/chat/completions`);
    this.model = model;
    this.maxInputChars = maxInputChars;
    this.maxOutputTokens = maxOutputTokens;
    this.timeoutMs = timeoutMs;
  }
  async ask(prompt) {
    if (!prompt.trim() || prompt.length > this.maxInputChars) throw new Error('Prompt is empty or exceeds the input limit');
    const response = await fetch(this.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({ model: this.model, messages: [
        { role: 'system', content: 'You are a bounded coding assistant. Answer using only the supplied context. Return proposed code or a patch when requested. You cannot inspect files or run commands.' },
        { role: 'user', content: prompt },
      ], temperature: 0, max_tokens: this.maxOutputTokens, chat_template_kwargs: { enable_thinking: false } }),
    });
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
    const choice = (await response.json())?.choices?.[0];
    const answer = choice?.message?.content;
    if (choice?.finish_reason !== 'stop' || typeof answer !== 'string' || !answer.trim()) {
      const finishReason = typeof choice?.finish_reason === 'string'
        ? choice.finish_reason.replace(/[^a-z_]/gi, '').slice(0, 32) || 'unknown'
        : 'unknown';
      const answerLength = typeof answer === 'string' ? answer.length : 0;
      throw new Error(`Model answer was empty or truncated (finish_reason=${finishReason}, answer_chars=${answerLength}, max_output_tokens=${this.maxOutputTokens})`);
    }
    return answer.trim();
  }
}

function options(argv) {
  const mode = argv.shift();
  if (!['ask', 'serve-mcp'].includes(mode)) throw new Error('Usage: bounded-model.command.mjs ask|serve-mcp --endpoint URL --model ID [--max-input-chars N] [--max-output-tokens N] [--timeout-ms N]');
  const values = {};
  while (argv.length) {
    const flag = argv.shift(), value = argv.shift();
    if (!['--endpoint', '--model', '--max-input-chars', '--max-output-tokens', '--timeout-ms'].includes(flag) || !value || values[flag]) throw new Error('Invalid command options');
    values[flag] = value;
  }
  if (!values['--endpoint'] || !values['--model']) throw new Error('Endpoint and model are required');
  return { mode, endpoint: values['--endpoint'], model: values['--model'],
    maxInputChars: values['--max-input-chars'] === undefined ? undefined : Number(values['--max-input-chars']),
    maxOutputTokens: values['--max-output-tokens'] === undefined ? undefined : Number(values['--max-output-tokens']),
    timeoutMs: values['--timeout-ms'] === undefined ? undefined : Number(values['--timeout-ms']) };
}

class BoundedCoderMcpServer {
  constructor(client) { this.client = client; }
  reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
  error(id, code, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`); }
  async handle(line) {
    let request;
    try { request = JSON.parse(line); } catch { this.error(null, -32700, 'Invalid JSON'); return; }
    if (request.id === undefined) return;
    try {
      switch (request.method) {
        case 'initialize': this.reply(request.id, { protocolVersion: request.params?.protocolVersion || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'bounded-coder', version: '1.0.0' } }); break;
        case 'ping': this.reply(request.id, {}); break;
        case 'tools/list': this.reply(request.id, { tools: [{ name: 'bounded_coder', description: 'Ask a bounded coding model to propose code or a patch from supplied context. It cannot inspect files or make changes. Review and apply its answer yourself.', inputSchema: { type: 'object', properties: { task: { type: 'string', description: 'Self-contained coding task and relevant file excerpts' } }, required: ['task'], additionalProperties: false } }] }); break;
        case 'tools/call': {
          if (request.params?.name !== 'bounded_coder' || typeof request.params?.arguments?.task !== 'string') { this.error(request.id, -32602, 'Invalid tool arguments'); break; }
          try { this.reply(request.id, { content: [{ type: 'text', text: await this.client.ask(request.params.arguments.task) }] }); }
          catch (error) { this.reply(request.id, { isError: true, content: [{ type: 'text', text: `Bounded Coder failed: ${error.message}` }] }); }
          break;
        }
        default: this.error(request.id, -32601, 'Unknown method');
      }
    } catch (error) { this.error(request.id, -32603, error.message); }
  }
  async serve() { for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) if (line.trim()) await this.handle(line); }
}

try {
  const config = options(process.argv.slice(2));
  const client = new BoundedModelClient(config);
  if (config.mode === 'serve-mcp') await new BoundedCoderMcpServer(client).serve();
  else {
    let prompt = '';
    for await (const chunk of process.stdin) { prompt += chunk; if (prompt.length > client.maxInputChars) throw new Error('Prompt exceeds the input limit'); }
    process.stdout.write(`${await client.ask(prompt)}\n`);
  }
} catch (error) { process.stderr.write(`BOUNDED_MODEL_ERROR: ${error.message}\n`); process.exitCode = 1; }
