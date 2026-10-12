#!/usr/bin/env python3
"""Blind, bounded Pi vision run; private configuration never enters public evidence."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from verify import compare_fields, compare_totals, parse_answer, totals

HERE = Path(__file__).resolve().parent

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

def execute(command, cwd, timeout, env=None):
    begin = time.monotonic()
    try:
        result = subprocess.run(command, cwd=cwd, env=env, text=True, capture_output=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr, time.monotonic()-begin
    except subprocess.TimeoutExpired as error:
        def decode(value):
            return value.decode(errors='replace') if isinstance(value, bytes) else value or ''
        return 124, decode(error.stdout), decode(error.stderr), time.monotonic()-begin

def transport_check(result, expected_images):
    controls = result['outbound_controls']
    checks = {'exit_success': result['exit_code'] == 0,
              'normal_stop': result['stop_reason'] == 'stop',
              'structured_answer': isinstance(result['actual'], dict),
              'thinking_control_observed': bool(controls) and all(c.get('enable_thinking') is False for c in controls),
              'expected_image_count_observed': bool(controls) and all(c.get('image_count') == expected_images for c in controls)}
    return {'passed': all(checks.values()), **checks}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('agent-dir', 'provider', 'model', 'run-root', 'date', 'results'):
        parser.add_argument('--'+flag, required=True)
    parser.add_argument('--pi', default='pi')
    parser.add_argument('--renderer', default='pdftoppm')
    parser.add_argument('--timeout', type=int, default=90)
    args = parser.parse_args()
    full_start = time.monotonic()
    if not 1 <= args.timeout <= 90:
        parser.error('timeout must be 1-90 seconds')
    pi = shutil.which(args.pi)
    renderer = shutil.which(args.renderer)
    if not pi or not renderer:
        parser.error('Pi and PDF renderer must resolve before inference')
    run = Path(args.run_root).resolve()
    if run.exists():
        parser.error('run-root already exists; use a fresh explicit run root, never overwrite evidence')
    run.mkdir(parents=True)
    config = run/'agent'
    config.mkdir()
    source = json.loads((Path(args.agent_dir)/'models.json').read_text())
    provider = source['providers'][args.provider]
    model = next(x for x in provider['models'] if x['id'] == args.model)
    if model.get('contextWindow', 0) < 8192 or 'image' not in model.get('input', []):
        raise RuntimeError('selected model lacks declared image input or required context capacity')
    # Only the requested provider/model transport is copied, never workflow settings/hooks.
    provider_copy = {k: provider[k] for k in ('baseUrl', 'api', 'apiKey', 'headers') if k in provider}
    model_copy = dict(model)
    model_copy.update(contextWindow=8192, maxTokens=2048)
    provider_copy['models'] = [model_copy]
    save(config/'models.json', {'providers': {args.provider: provider_copy}})
    os.chmod(config/'models.json', 0o600)
    save(config/'settings.json', {'defaultThinkingLevel': 'off', 'compaction': {'enabled': False}})
    hook = config/'thinking-control.mjs'
    hook.write_text('import fs from "node:fs";\nexport default function(pi) { pi.on("before_provider_request", (event) => { const payload={...event.payload,chat_template_kwargs:{...(event.payload.chat_template_kwargs??{}),enable_thinking:false}}; const messages=payload.messages??[]; fs.appendFileSync(process.env.BENCHMARK_CONTROL_LOG,JSON.stringify({enable_thinking:payload.chat_template_kwargs.enable_thinking,max_tokens:payload.max_tokens??null,image_count:messages.reduce((n,m)=>n+(Array.isArray(m.content)?m.content.filter(c=>c.type==="image_url"||c.type==="image").length:0),0)})+"\\n"); return payload; }); }\n')
    env = dict(os.environ, PI_CODING_AGENT_DIR=str(config), PI_OFFLINE='1', PI_TELEMETRY='0')
    code, version, _, _ = execute([pi, '--version'], run, 10, env)
    if code:
        raise RuntimeError('Pi version preflight failed')
    _, renderer_version, renderer_stderr, _ = execute([renderer, '-v'], run, 10)
    expected = json.loads((HERE/'expected.json').read_text())
    extraction_prompt = (HERE/'page-extraction.prompt.md').read_text()
    aggregation_prompt = (HERE/'period-totals.prompt.md').read_text()
    preflight_seconds = time.monotonic()-full_start
    rendering_start = time.monotonic()
    images = {}
    for doc in expected['documents']:
        prefix = run/doc['document']
        status, out, err, elapsed = execute([renderer, '-r', '144', '-f', str(doc['page']), '-l', str(doc['page']), '-singlefile', '-png', str(HERE/doc['file']), str(prefix)], run, 30)
        (run/(doc['document']+'.render.log')).write_text(out+err)
        if status:
            raise RuntimeError('PDF rendering failed before inference')
        images[doc['document']] = prefix.with_suffix('.png')
    rendering_seconds = time.monotonic()-rendering_start
    events, extracted = [], []
    def inference(identifier, prompt, image=None):
        control = run/(identifier+'.controls.jsonl')
        this_env = dict(env, BENCHMARK_CONTROL_LOG=str(control))
        command = [pi, '--print', '--mode', 'json', '--no-session', '--no-tools', '--no-mcp', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-context-files', '--no-approve', '--provider', args.provider, '--model', args.model, '--thinking', 'off', '--system-prompt', 'You inspect fictional tax evidence and return requested structured JSON.', '-e', str(hook), '--']
        if image:
            command.append('@'+str(image))
        command.append(prompt)
        exit_code, stdout, stderr, elapsed = execute(command, run, args.timeout, this_env)
        (run/(identifier+'.events.jsonl')).write_text(stdout)
        (run/(identifier+'.stderr.log')).write_text(stderr)
        parsed_events = []
        for line in stdout.splitlines():
            try: parsed_events.append(json.loads(line))
            except json.JSONDecodeError: pass
        assistants = [e.get('message', {}) for e in parsed_events if e.get('type') == 'message_end' and e.get('message', {}).get('role') == 'assistant']
        message = assistants[-1] if assistants else {}
        output = ''.join(p.get('text', '') for p in message.get('content', []) if p.get('type') == 'text')
        try: actual = parse_answer(output)
        except (ValueError, TypeError): actual = None
        controls = [json.loads(x) for x in control.read_text().splitlines()] if control.exists() else []
        raw_usage = message.get('usage') or {}
        usage = {key: raw_usage[key] for key in ('input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens') if isinstance(raw_usage.get(key), (int, float))} or None
        result = {'id': identifier, 'exit_code': exit_code, 'wall_seconds': round(elapsed, 3), 'first_token_seconds': None, 'stop_reason': message.get('stopReason'), 'usage': usage, 'outbound_controls': controls, 'phase': 'page_extraction' if image else 'period_aggregation', 'assistant_completions_observed': len(assistants), 'model_api_calls': None, 'provider_request_hooks_observed': len(controls), 'output': output, 'actual': actual}
        # Only fictional output and allowlisted transport observations are public.
        result['transport_verification'] = transport_check(result, 1 if image else 0)
        events.append(result)
        return result
    inference_start = time.monotonic()
    verification_seconds = 0.0
    for doc in expected['documents']:
        result = inference(doc['document'], extraction_prompt, images[doc['document']])
        before = time.monotonic()
        result['verification'] = compare_fields(result['actual'], doc['expected'])
        result['verification']['fields_passed'] = result['verification']['passed']
        result['verification']['passed'] &= result['transport_verification']['passed']
        extracted.append({'document': doc['document'], 'actual': result['actual']})
        verification_seconds += time.monotonic()-before
        print(json.dumps({'id':result['id'], 'wall_seconds':result['wall_seconds'], 'passed':result['verification']['passed']}), flush=True)
    period_results = {}
    for key, period in expected['periods'].items():
        before = time.monotonic()
        deterministic = totals(extracted, period['start'], period['end'])
        deterministic_check = compare_totals(deterministic, period)
        verification_seconds += time.monotonic()-before
        prompt = aggregation_prompt.replace('{start}', period['start']).replace('{end}', period['end'])+'\nExtracted page reports:\n'+json.dumps(extracted)
        result = inference('totals-'+key, prompt)
        before = time.monotonic()
        result['verification'] = compare_totals(result['actual'], period)
        result['verification']['totals_passed'] = result['verification']['passed']
        result['verification']['passed'] &= result['transport_verification']['passed']
        period_results[key] = {'start':period['start'], 'end':period['end'], 'deterministic_from_extractions': deterministic, 'deterministic_verification': deterministic_check, 'model_verification': result['verification']}
        verification_seconds += time.monotonic()-before
        print(json.dumps({'id':result['id'], 'wall_seconds':result['wall_seconds'], 'passed':result['verification']['passed']}), flush=True)
    inference_and_verification_seconds = time.monotonic()-inference_start
    result = {'schema_version': 1, 'date': args.date, 'fixture': 'fictional-pdf-tax-evidence', 'data_classification': 'fully fictional public fixture', 'runner_source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'harness': {'name':'Pi', 'version':version.strip()}, 'model': args.model, 'configuration': {'context_window':8192,'output_tokens':2048,'configuration_boundary':'context/output limits copied into isolated run model settings; outbound output limit unknown unless recorded by hook','thinking':'off','server_thinking_requested':False,'renderer':'pdftoppm','renderer_version':(renderer_version+renderer_stderr).splitlines()[0], 'render_dpi':144,'timeout_seconds':args.timeout,'fresh_session_per_run':True,'tools':False,'workflow_context':False,'ground_truth_in_model_context':False,'projector_metadata':None}, 'timing':{'preflight_seconds':round(preflight_seconds,3),'rendering_seconds':round(rendering_seconds,3),'inference_seconds':round(sum(e['wall_seconds'] for e in events),3),'verification_seconds':round(verification_seconds,3),'inference_and_verification_seconds':round(inference_and_verification_seconds,3),'total_wall_seconds':round(time.monotonic()-full_start,3),'boundary':'preflight, isolated configuration, all rendering, inference, and independent verification; excludes fixture generation and manual visual inspection'}, 'events':events, 'periods':period_results,'summary':{'page_runs':len(extracted),'pages_passed':sum(e['verification']['passed'] for e in events if e['id'].startswith('receipt-')), 'aggregate_runs':len(period_results),'aggregate_runs_passed':sum(e['verification']['passed'] for e in events if e['id'].startswith('totals-'))}}
    save(run/'results.json', result)
    output = Path(args.results)
    output.parent.mkdir(parents=True, exist_ok=True)
    save(output, result)
    print(json.dumps(result['summary']), flush=True)

if __name__ == '__main__':
    main()
