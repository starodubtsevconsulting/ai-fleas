#!/usr/bin/env python3
"""Isolated native Hermes adapter; private transport never enters public results."""
import json
import hashlib
import os
from pathlib import Path
import re
import subprocess
import time


def check(config):
    result={'adapter':'hermes-cli','status':'blocked','inference_started':False,
            'native_image_cli':False,'context_window':config.get('context_window'),
            'output_tokens':config.get('output_tokens')}
    context=config.get('context_window');output=config.get('output_tokens')
    if type(context) is not int or type(output) is not int or not 0<output<=context:
        return {**result,'reason':'invalid-explicit-context-budget'}
    try:
        source=Path(config['source_root']).resolve(strict=True)
        parser=(source/'hermes_cli/_parser.py').read_text()
        routing=(source/'hermes_cli/cli_single_query.py').read_text()
        init=(source/'agent/agent_init.py').read_text()
        metadata=(source/'agent/model_metadata.py').read_text()
        hooks=(source/'hermes_cli/plugins.py').read_text()
        pre=(source/'agent/turn_api_request.py').read_text()
    except (KeyError,OSError,TypeError):return {**result,'reason':'installed-source-contract-unavailable'}
    native='add("--image"' in parser and '"image_url"' in routing and 'decide_image_input_mode' in routing
    result['native_image_cli']=native
    floor=re.search(r'^MINIMUM_CONTEXT_LENGTH\s*=\s*([\d_]+)\s*$',metadata,re.M)
    if not native or not floor or 'def _enforce_minimum_context' not in init:
        return {**result,'reason':'installed-source-contract-unrecognized'}
    minimum=int(floor.group(1).replace('_',''));result['minimum_context_window']=minimum
    if context<minimum:return {**result,'reason':'context-below-hermes-minimum',
        'detail':'Keep the actual server context; do not inflate metadata or relabel the provider.'}
    if not all(x in hooks for x in ('pre_api_request','post_api_request','pre_auxiliary_call')) or 'request_messages=' not in pre:
        return {**result,'reason':'required-observer-contract-unavailable'}
    if not (source/'venv/bin/python').is_file():return {**result,'reason':'installed-python-unavailable'}
    return {**result,'status':'compatible','reason':'native-adapter-source-contract-verified',
            'detail':'Actual server capacity and live transport observations still required.'}


def private_configuration(config):
    """Construct fresh native settings without inheriting operational config."""
    model=config['model'];context=config['context_window'];output=config['output_tokens']
    if 'sol' in model.casefold():raise ValueError('Sol requires Low reasoning; off-thinking adapter unsupported')
    if config.get('api')!='openai-completions':raise ValueError('only OpenAI chat-completions transport is supported')
    if type(context) is not int or type(output) is not int or not 0<output<=context:raise ValueError('invalid budgets')
    body={'max_tokens':output,'chat_template_kwargs':{'enable_thinking':False},**(config.get('sampling') or {})}
    provider={'name':'Isolated fictional benchmark','base_url':config['base_url'],
              'model':model,'models':{model:{'supports_vision':True,'context_length':context}},
              'discover_models':False,'api_mode':'chat_completions','extra_body':body,
              'api_key':config.get('api_key') or 'benchmark-no-secret',
              'extra_headers':config.get('headers') or {}}
    return {'model':{'provider':'benchmark-native','default':model,'base_url':config['base_url'],
                     'api_mode':'chat_completions','context_length':context,'supports_vision':True},
            'providers':{'benchmark-native':provider},'platform_toolsets':{'cli':[]},
            'agent':{'image_input_mode':'native','coding_context':'off','reasoning_effort':'none',
                     'max_turns':1,'system_prompt':'Inspect fictional financial PDF evidence and return the requested JSON.'},
            'compression':{'enabled':False},'mcp_servers':{},'fallback_model':[],
            'auxiliary':{'title_generation':{'enabled':False}},'memory':{'enabled':False},
            'plugins':{'enabled':['benchmark-observer'],'disabled':[]}}


PLUGIN=r'''
import json,os,time
from pathlib import Path

def register(ctx):
    def emit(kind,values):
        with Path(os.environ['BENCHMARK_CONTROL_LOG']).open('a') as stream:
            stream.write(json.dumps({'event':kind,'observer_time':time.time(),**values})+'\n')
    def pre(**kw):
        body=(kw.get('request') or {}).get('body') or {}
        extra=body.get('extra_body') or {}
        messages=kw.get('request_messages') or []
        images=sum(sum(p.get('type')=='image_url' for p in m.get('content',[]) if isinstance(p,dict))
                   for m in messages if isinstance(m,dict) and isinstance(m.get('content'),list))
        emit('pre',{'model':kw.get('model'),'image_count':images,'tool_count':kw.get('tool_count'),
                    'tools_in_payload':len(body.get('tools') or []),'started_at':kw.get('started_at'),
                    'api_request_id':kw.get('api_request_id'),'retry_count':kw.get('retry_count'),
                    'max_tokens':extra.get('max_tokens',body.get('max_tokens')),
                    'enable_thinking':(extra.get('chat_template_kwargs') or body.get('chat_template_kwargs') or {}).get('enable_thinking'),
                    'temperature':extra.get('temperature',body.get('temperature')),
                    'top_p':extra.get('top_p',body.get('top_p'))})
    def post(**kw):
        emit('post',{'model':kw.get('model'),'response_model':kw.get('response_model'),
                     'context_length':kw.get('context_length'),'api_duration':kw.get('api_duration'),
                     'started_at':kw.get('started_at'),'first_chunk_at':kw.get('first_chunk_at'),
                     'ended_at':kw.get('ended_at'),'finish_reason':kw.get('finish_reason'),
                     'assistant_tool_call_count':kw.get('assistant_tool_call_count'),
                     'usage':kw.get('usage'),'api_request_id':kw.get('api_request_id')})
    def auxiliary(**kw):emit('auxiliary',{'model':kw.get('model'),'aux_task':kw.get('aux_task')})
    def error(**kw):emit('api_error',{'model':kw.get('model'),'api_request_id':kw.get('api_request_id')})
    ctx.register_hook('pre_api_request',pre);ctx.register_hook('post_api_request',post)
    ctx.register_hook('pre_auxiliary_call',auxiliary);ctx.register_hook('api_request_error',error)
'''


def isolated_environment(home,source,control):
    # No inherited cloud credentials, workflow identity, hooks or active profile selection.
    env={key:os.environ[key] for key in ('PATH','LANG','LC_ALL','USER','HOME') if key in os.environ}
    env.update(HERMES_HOME=str(home),PYTHONPATH=str(source),BENCHMARK_CONTROL_LOG=str(control),
               HERMES_EPHEMERAL_SYSTEM_PROMPT='Inspect fictional financial PDF evidence and return the requested JSON.')
    return env


def prepare(config,runroot):
    observation=check(config)
    if observation['status']!='compatible':return {'preflight':observation}
    run=Path(runroot).resolve();home=run/'hermes-home'
    home.mkdir(mode=0o700)
    settings=private_configuration(config)
    path=home/'config.yaml';path.write_text(json.dumps(settings,indent=2)+'\n');path.chmod(0o600)
    (home/'.env').write_text('')
    plugin=home/'plugins/benchmark-observer';plugin.mkdir(parents=True)
    (plugin/'plugin.yaml').write_text('name: benchmark-observer\nversion: 1.0.0\n')
    (plugin/'__init__.py').write_text(PLUGIN)
    revision=subprocess.run(['git','-C',str(config['source_root']),'rev-parse','HEAD'],text=True,capture_output=True,timeout=10)
    code_revision=revision.stdout.strip() if revision.returncode==0 else None
    return {'preflight':observation,'code_revision':code_revision,'home':home,'source':Path(config['source_root']).resolve(),
            'python':Path(config['source_root']).resolve()/'venv/bin/python','config':config}


def transport_verification(controls,model,context,output,sampling):
    pre=[x for x in controls if x.get('event')=='pre'];post=[x for x in controls if x.get('event')=='post']
    checks={'one_native_request':len(pre)==1 and pre[0].get('image_count')==1,
            'one_response':len(post)==1,'selected_model':bool(pre) and all(x.get('model')==model for x in pre+post),
            'actual_context':bool(post) and all(x.get('context_length')==context for x in post),
            'no_tools':bool(pre) and all(x.get('tool_count')==0 and x.get('tools_in_payload')==0 for x in pre) and all(x.get('assistant_tool_call_count')==0 for x in post),
            'thinking_disabled':bool(pre) and all(x.get('enable_thinking') is False for x in pre),
            'output_cap':bool(pre) and all(x.get('max_tokens')==output for x in pre),
            'sampling':bool(pre) and all(all(x.get(k)==v for k,v in sampling.items()) for x in pre),
            'normal_stop':bool(post) and all(x.get('finish_reason')=='stop' for x in post),
            'no_fallback':not any(x.get('event') in ('auxiliary','api_error') for x in controls)}
    checks['passed']=all(checks.values());return checks


def run(prepared,prompt,image,runroot,identifier,timeout=90):
    if 'home' not in prepared:return prepared['preflight']
    runroot=Path(runroot);logs=runroot/'vision';logs.mkdir(exist_ok=True)
    control=logs/(identifier+'.controls.jsonl');query=logs/(identifier+'.query.txt');query.write_text(prompt)
    env=isolated_environment(prepared['home'],prepared['source'],control)
    command=[str(prepared['python']),'-m','hermes_cli.main','chat','--query-file',str(query),
             '--image',str(image),'--format','stream-json','--oneshot','--reasoning','none','--ignore-rules',
             '--provider','benchmark-native','--model',prepared['config']['model']]
    start=time.monotonic()
    try:
        result=subprocess.run(command,cwd=runroot,env=env,capture_output=True,text=True,timeout=timeout)
        code,out,err=result.returncode,result.stdout,result.stderr
    except subprocess.TimeoutExpired as error:
        def decode(value):return value.decode(errors='replace') if isinstance(value,bytes) else value or ''
        code,out,err=124,decode(error.stdout),decode(error.stderr)
    elapsed=time.monotonic()-start
    (logs/(identifier+'.events.jsonl')).write_text(out);(logs/(identifier+'.stderr.log')).write_text(err)
    events=[]
    for line in out.splitlines():
        try:events.append(json.loads(line))
        except ValueError:pass
    terminal=[x for x in events if isinstance(x,dict) and x.get('type')=='result']
    final=terminal[-1] if terminal else {}
    try:
        text=final.get('text','').strip()
        if text.startswith('```'):text=re.sub(r'^```(?:json)?\s*|\s*```$','',text)
        answer=json.loads(text)
        if not isinstance(answer,dict):answer=None
    except (ValueError,TypeError):answer=None
    controls=[json.loads(x) for x in control.read_text().splitlines()] if control.exists() else []
    config=prepared['config'];verification=transport_verification(controls,config['model'],config['context_window'],config['output_tokens'],config.get('sampling') or {})
    verification.update(exit_success=code==0 and final.get('exit_code')==0,json_object=isinstance(answer,dict))
    verification['passed']=all(v for k,v in verification.items() if k!='passed')
    durations=[x.get('api_duration') for x in controls if x.get('event')=='post' and isinstance(x.get('api_duration'),(int,float))]
    api_seconds=sum(durations) if durations else None
    first=[x for x in controls if x.get('event')=='post' and isinstance(x.get('first_chunk_at'),(int,float)) and isinstance(x.get('started_at'),(int,float))]
    token=final.get('tokens');usage=None
    if isinstance(token,dict) and any(isinstance(token.get(k),(int,float)) and token[k]>0 for k in ('input','output','total')):usage={k:token[v] for k,v in {'input':'input','output':'output','totalTokens':'total','cacheRead':'cache_read','cacheWrite':'cache_write'}.items() if isinstance(token.get(v),(int,float))}
    return {'id':identifier,'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'image_sha256':hashlib.sha256(Path(image).read_bytes()).hexdigest(),'image_bytes':Path(image).stat().st_size,'exit_code':code,'wall_seconds':round(elapsed,3),'api_seconds':api_seconds,
            'non_inference_overhead_seconds':round(max(0,elapsed-api_seconds),3) if api_seconds is not None else None,
            'first_token_seconds':first[0]['first_chunk_at']-first[0]['started_at'] if first else None,
            'usage':usage,'answer':answer,'outbound_controls':controls,'transport_verification':verification,
            'assistant_completions_observed':len(terminal),'provider_request_hooks_observed':sum(x.get('event')=='pre' for x in controls),
            'model_api_calls':sum(x.get('event')=='pre' for x in controls) if controls else None}


def version(prepared,runroot):
    control=Path(runroot)/'hermes-version.controls.jsonl'
    result=subprocess.run([str(prepared['python']),'-m','hermes_cli.main','--version'],
                          cwd=runroot,env=isolated_environment(prepared['home'],prepared['source'],control),
                          text=True,capture_output=True,timeout=20)
    if result.returncode:raise ValueError('Hermes version preflight failed')
    return result.stdout.strip()


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',required=True)
    parser.add_argument('--config',required=True)
    args=parser.parse_args()
    try:
        config=json.loads(Path(args.config).read_text())
        result=check(config) if isinstance(config,dict) else {'status':'blocked','reason':'invalid-config'}
    except (OSError,ValueError):result={'status':'blocked','reason':'invalid-config'}
    print(json.dumps(result,sort_keys=True))
