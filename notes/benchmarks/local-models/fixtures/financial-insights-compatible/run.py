#!/usr/bin/env python3
"""Fictional Financial Insights preparation and contextual visual verification."""
import argparse
import sys
sys.dont_write_bytecode=True
import copy
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import time
import datetime
import uuid
import urllib.request
import urllib.error
from urllib.parse import urlsplit
from verify import compare_mechanical, compare_vision, parse_answer, set_path
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[4]
WORKFLOW_DATA=REPO/'ai-workflows/financial-insights/data'
SOURCE_REPORTS=WORKFLOW_DATA/'corporate/reports'

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,indent=2)+'\n')

def execute(command,cwd,timeout,env=None):
    start=time.monotonic()
    try:
        result=subprocess.run(command,cwd=cwd,env=env,text=True,capture_output=True,timeout=timeout)
        return result.returncode,result.stdout,result.stderr,time.monotonic()-start
    except subprocess.TimeoutExpired as e:
        def text(v):return v.decode(errors='replace') if isinstance(v,bytes) else v or ''
        return 124,text(e.stdout),text(e.stderr),time.monotonic()-start

def mechanical_source_versions():
    """Version only public mechanical implementation, never operational settings."""
    files=('financial-records.command.mjs','pdf-reader.mjs',
           'recognizers/payroll-tax-source-recognition.mjs','read-plans/payroll-tax-read-plan.mjs')
    base=REPO/'ai-commands/data/financial-records'
    return {name:hashlib.sha256((base/name).read_bytes()).hexdigest() for name in files}

def validate_variant(variant):
    """Named variants select adapters, not code branches tied to one variant ID."""
    if not isinstance(variant,dict):raise ValueError('variant must be an object')
    adapter=variant.get('adapter')
    if adapter not in ('shared-exported-engine','pi-print-json','hermes-cli-preflight','hermes-native-json'):
        return {**variant,'supported':False,'blocked_reason':'benchmark adapter not implemented'}
    if adapter in ('pi-print-json','hermes-native-json'):
        context=variant.get('context_window');output=variant.get('output_tokens')
        if type(context) is not int or type(output) is not int or not 1<=output<=context:
            raise ValueError('explicit positive integer context/output budgets required')
        if variant.get('thinking')!='off' or variant.get('server_enable_thinking') is not False:
            raise ValueError('Pi adapter only supports explicit off/false thinking controls')
        sampling=variant.get('sampling')
        if sampling is not None:
            if not isinstance(sampling,dict) or set(sampling)-{'temperature','top_p'}:raise ValueError('unsupported sampling option')
            for key,value in sampling.items():
                upper=2 if key=='temperature' else 1
                if type(value) not in (int,float) or not 0<=value<=upper:raise ValueError('invalid sampling budget')
    return variant

def hermes_module():
    import importlib.util
    spec=importlib.util.spec_from_file_location('benchmark_hermes',HERE/'hermes-adapter.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def hermes_preflight(source_root,variant):
    return hermes_module().check({'source_root':source_root,'context_window':variant.get('context_window'),'output_tokens':variant.get('output_tokens')})

def setup_pi(args,run,variant):
    if not all((args.agent_dir,args.provider,args.model)):raise ValueError('Pi variant requires explicit transport agent-dir/provider/model')
    original=json.loads((Path(args.agent_dir)/'models.json').read_text())
    provider=original['providers'][args.provider]
    model=next(x for x in provider['models'] if x['id']==args.model)
    context=variant['context_window'];output=variant['output_tokens']
    if context>model.get('contextWindow',0) or output>model.get('maxTokens',0) or 'image' not in model.get('input',[]):raise ValueError('model image capability or declared context/output capacity insufficient')
    if provider.get('api')!='openai-completions':raise ValueError('Pi JSON-aware adapter currently supports only openai-completions transport')
    if 'sol' in args.model.casefold():raise ValueError('Sol requires Low reasoning; this off-thinking Pi adapter does not support that binding')
    config=run/'agent';config.mkdir()
    selected={key:provider[key] for key in ('baseUrl','api','apiKey','headers') if key in provider}
    selected['models']=[dict(model,contextWindow=context,maxTokens=output)]
    save(config/'models.json',{'providers':{args.provider:selected}});os.chmod(config/'models.json',0o600)
    save(config/'settings.json',{'defaultThinkingLevel':'off','compaction':{'enabled':False}})
    hook=config/'thinking-control.mjs'
    sampling=dict(variant.get('sampling') or {})
    if variant.get('enforce_output_tokens'):sampling['max_tokens']=output
    hook.write_text('import fs from "node:fs";\nexport default function(pi) { pi.on("before_provider_request", (event) => { const payload={...event.payload,...SAMPLING,chat_template_kwargs:{...(event.payload.chat_template_kwargs??{}),enable_thinking:false}}; const messages=payload.messages??[]; fs.appendFileSync(process.env.BENCHMARK_CONTROL_LOG,JSON.stringify({enable_thinking:payload.chat_template_kwargs.enable_thinking,max_tokens:payload.max_tokens??null,model:payload.model??null,temperature:payload.temperature??null,top_p:payload.top_p??null,image_count:messages.reduce((n,m)=>n+(Array.isArray(m.content)?m.content.filter(c=>c.type==="image_url"||c.type==="image").length:0),0)})+"\\n"); return payload; }); }\n'.replace('SAMPLING',json.dumps(sampling)))
    env=dict(os.environ,PI_CODING_AGENT_DIR=str(config),PI_OFFLINE='1',PI_TELEMETRY='0')
    code,version,_,_=execute([args.pi,'--version'],run,10,env)
    if code:raise ValueError('Pi version preflight failed')
    return hook,env,version.strip()

def inference(args,run,hook,env,identifier,prompt,image,variant):
    control=run/'vision'/(identifier+'.controls.jsonl');control.parent.mkdir(exist_ok=True)
    command=[args.pi,'--print','--mode','json','--no-session','--no-tools','--no-mcp','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-approve','--provider',args.provider,'--model',args.model,'--thinking','off','--system-prompt','Inspect fictional financial PDF evidence and return the requested JSON.','-e',str(hook),'--','@'+str(image),prompt]
    code,out,err,elapsed=execute(command,run,args.timeout,dict(env,BENCHMARK_CONTROL_LOG=str(control)))
    (control.parent/(identifier+'.events.jsonl')).write_text(out);(control.parent/(identifier+'.stderr.log')).write_text(err)
    messages=[]
    for line in out.splitlines():
        try:
            event=json.loads(line)
            if event.get('type')=='message_end' and event.get('message',{}).get('role')=='assistant':messages.append(event['message'])
        except (ValueError,TypeError):pass
    message=messages[-1] if messages else {}
    output=''.join(p.get('text','') for p in message.get('content',[]) if p.get('type')=='text')
    try:answer=parse_answer(output)
    except (ValueError,TypeError):answer=None
    controls=[json.loads(line) for line in control.read_text().splitlines()] if control.exists() else []
    usage={k:v for k,v in (message.get('usage') or {}).items() if k in ('input','output','cacheRead','cacheWrite','totalTokens') and isinstance(v,(int,float))} or None
    transport={'exit_success':code==0,'normal_stop':message.get('stopReason')=='stop','json_object':isinstance(answer,dict),
               'one_image_observed':bool(controls) and all(x['image_count']==1 for x in controls),
               'thinking_disabled_observed':bool(controls) and all(x['enable_thinking'] is False for x in controls)}
    if variant.get('enforce_output_tokens'):
        transport['actual_output_cap']=bool(controls) and all(x.get('max_tokens')==variant['output_tokens'] for x in controls)
        transport['actual_sampling']=bool(controls) and all(all(x.get(k)==v for k,v in (variant.get('sampling') or {}).items()) for x in controls)
    transport['passed']=all(transport.values())
    return {'id':identifier,'exit_code':code,'wall_seconds':round(elapsed,3),'first_token_seconds':None,'stop_reason':message.get('stopReason'),'usage':usage,'assistant_completions_observed':len(messages),'provider_request_hooks_observed':len(controls),'model_api_calls':None,'outbound_controls':controls,'transport_verification':transport,'answer':answer,'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'image_sha256':hashlib.sha256(image.read_bytes()).hexdigest(),'image_bytes':image.stat().st_size}

PROFILE_FIELDS={'variant','agent_dir','provider','model','harness_source','variants','server_props_url'}


def select_test_profile(args,filename,name):
    config_path=Path(filename).resolve()
    config=json.loads(config_path.read_text())
    if not isinstance(config,dict) or set(config)-{'schema_version','profiles'} or (type(config.get('schema_version')) is not int or config.get('schema_version')!=1):
        raise ValueError('invalid test-profile configuration schema')
    profiles=config.get('profiles')
    if not isinstance(profiles,dict) or name not in profiles:raise ValueError('unknown test profile')
    profile=profiles[name]
    if not isinstance(profile,dict) or set(profile)-PROFILE_FIELDS:raise ValueError('unknown test-profile field')
    if any(not isinstance(value,str) or not value.strip() for value in profile.values()):raise ValueError('test-profile values must be nonempty strings')
    if not {'variant','agent_dir','provider','model','server_props_url'}<=set(profile):raise ValueError('test-profile fields missing')
    resolved=dict(profile)
    for key in ('agent_dir','harness_source','variants'):
        if key in resolved:resolved[key]=str((config_path.parent/Path(resolved[key])).resolve())
    for key,value in resolved.items():
        if key=='server_props_url':continue
        supplied=getattr(args,key,None)
        if supplied is not None:
            if key in ('agent_dir','harness_source','variants'):supplied=str(Path(supplied).resolve())
            if supplied!=value:raise ValueError('explicit CLI setting conflicts with selected test profile: '+key)
        setattr(args,key,value)
    return resolved


def validate_live_props(props,model,context):
    if not isinstance(props,dict):raise ValueError('props response must be an object')
    alias=props.get('model_alias')
    aliases=[alias] if isinstance(alias,str) else alias
    if not isinstance(aliases,list) or model not in aliases:raise ValueError('live server model alias mismatch')
    settings=props.get('default_generation_settings')
    actual=settings.get('n_ctx') if isinstance(settings,dict) else None
    if type(actual) is not int or actual!=context:raise ValueError('live server context mismatch')
    modalities=props.get('modalities')
    has_image=(isinstance(modalities,dict) and modalities.get('vision') is True) or (isinstance(modalities,list) and any(x in ('vision','image') for x in modalities))
    if not has_image:raise ValueError('live server image modality missing')
    return {'verified':True,'model_match':True,'context_window':actual,'native_image':True,
            'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'boundary':'fresh bounded read-only live props check; private probe URL omitted'}


class NoProbeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,msg,headers,newurl):
        raise ValueError('props redirects are prohibited')


def probe_headers(url,provider):
    target=urlsplit(url);origin=urlsplit(provider.get('baseUrl',''))
    if target.scheme not in ('http','https') or target.scheme!=origin.scheme or target.hostname!=origin.hostname:
        raise ValueError('props URL must use the authorized provider hostname and scheme')
    if target.username is not None or target.password is not None or target.path!='/props' or target.query or target.fragment:
        raise ValueError('props URL requires exact /props path and no userinfo/query/fragment')
    if not target.hostname:raise ValueError('props hostname missing')
    raw_headers=provider.get('headers') or {}
    if not isinstance(raw_headers,dict):raise ValueError('invalid private transport headers')
    headers=dict(raw_headers)
    if any(not isinstance(k,str) or not isinstance(v,str) for k,v in headers.items()):raise ValueError('invalid private transport headers')
    key=provider.get('apiKey')
    if key is not None and not isinstance(key,str):raise ValueError('invalid private transport credential type')
    if key and isinstance(key,str) and not any(k.casefold()=='authorization' for k in headers):headers['Authorization']='Bearer '+key
    return headers


def live_profile_check(profile,variant):
    catalog=json.loads((Path(profile['agent_dir'])/'models.json').read_text())
    try:
        provider=catalog['providers'][profile['provider']]
        model=next(m for m in provider['models'] if m['id']==profile['model'])
    except (KeyError,StopIteration,TypeError):raise ValueError('selected transport/model unavailable')
    if variant.get('adapter') not in ('pi-print-json','hermes-native-json'):raise ValueError('named test profile requires an implemented native image adapter')
    if type(model.get('contextWindow')) is not int or type(model.get('maxTokens')) is not int or not isinstance(model.get('input'),list):raise ValueError('selected transport metadata has invalid capacity types')
    if variant['context_window']>model['contextWindow'] or variant['output_tokens']>model['maxTokens'] or 'image' not in model['input']:raise ValueError('selected transport metadata does not support variant budgets/image input')
    url=profile['server_props_url'];headers=probe_headers(url,provider)
    request=urllib.request.Request(url,headers=headers,method='GET')
    try:
        with urllib.request.build_opener(NoProbeRedirect()).open(request,timeout=5) as response:
            if response.status!=200:raise ValueError('props HTTP status mismatch')
            body=response.read(262145)
            if len(body)>262144:raise ValueError('props response exceeds bounded size')
        props=json.loads(body)
    except urllib.error.HTTPError as error:raise ValueError('props HTTP status '+str(error.code)) from None
    except (urllib.error.URLError,TimeoutError):raise ValueError('props probe unavailable') from None
    except (UnicodeError,json.JSONDecodeError):raise ValueError('props response invalid JSON') from None
    result=validate_live_props(props,profile['model'],variant['context_window'])
    if variant.get('adapter')=='hermes-native-json':
        if not profile.get('harness_source'):raise ValueError('Hermes profile requires installed harness source')
        capability=hermes_preflight(profile['harness_source'],variant)
        if capability.get('status')!='compatible':raise ValueError('Hermes source capability preflight blocked: '+str(capability.get('reason')))
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--test-profile');p.add_argument('--profile-config');p.add_argument('--check-profile',action='store_true');p.add_argument('--variants');p.add_argument('--harness-source');p.add_argument('--runtime-evidence');p.add_argument('--variant');p.add_argument('--run-root');p.add_argument('--results')
    for flag in ('agent-dir','provider','model'):p.add_argument('--'+flag)
    p.add_argument('--date',default='2026-10-12');p.add_argument('--pi',default='pi');p.add_argument('--renderer',default='pdftoppm');p.add_argument('--timeout',type=int,default=90)
    args=p.parse_args();start=time.monotonic()
    profile=None
    if args.test_profile:
        if not args.profile_config:p.error('--test-profile requires --profile-config')
        if args.runtime_evidence:p.error('named profiles use live props, not a saved runtime receipt')
        try:profile=select_test_profile(args,args.profile_config,args.test_profile)
        except (ValueError,OSError):p.error('invalid or conflicting private test-profile configuration')
    elif args.profile_config or args.check_profile:p.error('--profile-config/--check-profile require --test-profile')
    if not args.variant:p.error('--variant or a named test profile is required')
    args.variants=args.variants or str(HERE/'variants.json')
    manifest_path=Path(args.variants);manifest=json.loads(manifest_path.read_text())
    try:variant=validate_variant(manifest['variants'].get(args.variant))
    except ValueError as error:p.error(str(error))
    for binding in ('provider','model'):
        configured=variant.get(binding)
        supplied=getattr(args,binding)
        if configured and supplied and configured!=supplied:p.error('explicit '+binding+' conflicts with selected named variant')
        if configured:setattr(args,binding,configured)
    is_pi=variant.get('adapter')=='pi-print-json' and variant.get('supported')
    is_hermes=variant.get('adapter')=='hermes-native-json' and variant.get('supported')
    is_visual=is_pi or is_hermes
    runtime_evidence=None
    if profile:
        try:runtime_evidence=live_profile_check(profile,variant)
        except (ValueError,OSError) as error:p.error(str(error) if isinstance(error,ValueError) else 'private profile input unavailable')
        if args.check_profile:
            print(json.dumps({'test_profile':args.test_profile,'variant':args.variant,'status':'verified','runtime_context_evidence':runtime_evidence,'inference_started':False,'directories_created':False}));return
        if not args.run_root:
            name=re.sub(r'[^a-zA-Z0-9_-]','-',args.test_profile)
            args.run_root=str(REPO/'notes/benchmarks/local-models/runs'/(name+'-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:8]))
        args.results=args.results or str(Path(args.run_root)/'results.json')
    elif variant.get('requires_runtime_evidence'):
        if not args.runtime_evidence:p.error('matched trial requires actual served-context evidence before launch')
        proof=json.loads(Path(args.runtime_evidence).read_text())
        if proof.get('verified') is not True or proof.get('model')!=args.model or proof.get('context_window')!=variant.get('context_window'):p.error('runtime context/model evidence does not match selected trial')
        runtime_evidence={'verified':True,'model_match':True,'context_window':proof['context_window'],'boundary':'explicit operator-verified served context; no private transport values published'}
    if not args.run_root or not args.results:p.error('explicit run-root/results required outside named test profiles')
    if not 1<=args.timeout<=90:p.error('timeout must be 1..90 seconds')
    run=Path(args.run_root).resolve();output=Path(args.results).resolve()
    try:run.relative_to(REPO/'notes/benchmarks/local-models/runs')
    except ValueError:p.error('run-root must be under ignored visible benchmark runs directory')
    if run.exists() or output.exists():p.error('run-root/results already exists; never overwrite evidence')
    if not variant.get('supported') or variant.get('adapter')=='hermes-cli-preflight':
        observation=hermes_preflight(args.harness_source,variant) if variant.get('adapter')=='hermes-cli-preflight' else {'status':'blocked','reason':variant.get('blocked_reason'),'inference_started':False}
        run.mkdir(parents=True)
        result={'schema_version':1,'date':args.date,'fixture':'financial-insights-compatible','fixture_layout_revision':3,'fictional':True,'variant':args.variant,'status':'blocked','adapter_preflight':observation,'mechanical_source_versions':mechanical_source_versions(),'mechanical_source_version_collection':'captured during adapter preflight; mechanical engine not executed','inference_started':False,'configuration':variant,'total_wall_seconds':round(time.monotonic()-start,3)}
        save(run/'results.json',result);save(output,result);print(json.dumps(result),flush=True);return
    for executable in ('node',)+((args.pi,args.renderer) if is_pi else ((args.renderer,) if is_hermes else ())):
        if not shutil.which(executable):p.error('missing executable '+executable)
    run.mkdir(parents=True);root=run/'data/corporate/reports';shutil.copytree(SOURCE_REPORTS,root)
    expected=json.loads((WORKFLOW_DATA/'expected.json').read_text());mechanical=[];proposals={};texts={};hashes={}
    hook=env=version=None;hermes_prepared=None
    if is_pi:hook,env,version=setup_pi(args,run,variant)
    if is_hermes:
        if not all((args.agent_dir,args.provider,args.model,args.harness_source)):p.error('native Hermes requires explicit transport/model/source')
        catalog=json.loads((Path(args.agent_dir)/'models.json').read_text())
        provider=catalog['providers'][args.provider];model=next(m for m in provider['models'] if m['id']==args.model)
        if variant['context_window']>model.get('contextWindow',0) or variant['output_tokens']>model.get('maxTokens',0) or 'image' not in model.get('input',[]):p.error('transport metadata capacity insufficient for selected Hermes trial')
        config={'source_root':args.harness_source,'model':args.model,'base_url':provider['baseUrl'],'api':provider.get('api'),'api_key':provider.get('apiKey'),'headers':provider.get('headers'),**variant}
        hermes_prepared=hermes_module().prepare(config,run)
        if 'home' not in hermes_prepared:
            result={'schema_version':1,'fixture':'financial-insights-compatible','fictional':True,'variant':args.variant,'status':'blocked','adapter_preflight':hermes_prepared['preflight'],'inference_started':False}
            save(run/'results.json',result);save(output,result);print(json.dumps(result));return
        version=hermes_module().version(hermes_prepared,run)
    preflight=time.monotonic()-start
    mechanical_versions=mechanical_source_versions()
    engine=REPO/'ai-commands/data/financial-records/financial-records.command.mjs'
    bridge='import {FinancialRecordsCommand} from '+json.dumps(engine.as_uri())+'; const args=process.argv.slice(1); const command=new FinancialRecordsCommand(); const proposal=await command.run(args); const pdf=await command.pdfReader.read(args[args.indexOf("--source")+1]); console.log(JSON.stringify({proposal,sourceText:pdf.normalizedText}));'
    for doc in expected['documents']:
        source=root/Path(doc['file']).relative_to(SOURCE_REPORTS.relative_to(REPO));before=hashlib.sha256(source.read_bytes()).hexdigest();hashes[doc['id']]=before
        operation=['prepare-tax-from-source','--root',str(root),'--source',str(source),'--branch','example-consulting','--year','2026','--quarter','q4','--section','out']
        code,out,err,elapsed=execute(['node','--input-type=module','-e',bridge,*operation],REPO,30)
        (run/(doc['id']+'.mechanical.stderr.log')).write_text(err)
        try:payload=json.loads(out);proposal=payload['proposal'];texts[doc['id']]=payload['sourceText']
        except (ValueError,TypeError,KeyError):proposal={};texts[doc['id']]=''
        save(run/'proposals'/(doc['id']+'.prepare.json'),proposal)
        proposals[doc['id']]=proposal
        unchanged=before==hashlib.sha256(source.read_bytes()).hexdigest()
        score=compare_mechanical(proposal,doc);score['passed']&=code==0 and unchanged
        mechanical.append({'id':doc['id'],'exit_code':code,'wall_seconds':round(elapsed,3),'source_unchanged':unchanged,'source_sha256':before,'operation':operation[:2]+['<fictional-run-report-root>','--source',doc['file']]+operation[5:],'proposal':proposal,'verification':score})
        print(json.dumps({'stage':'mechanical','id':doc['id'],'passed':score['passed'],'seconds':round(elapsed,3)}),flush=True)
    mechanical_seconds=sum(x['wall_seconds'] for x in mechanical)
    vision=[];rendering_seconds=0;verification_seconds=0
    blocked=None;blocked_cases=[]
    if is_visual:
        if not all(x['verification']['prepared'] and x['exit_code']==0 for x in mechanical):blocked='mechanical preparation failed; no fabricated candidate used'
        else:
            prompt_base=(HERE/'verify-json.prompt.md').read_text();images={}
            for doc in expected['documents']:
                prefix=run/'images'/doc['id'];prefix.parent.mkdir(exist_ok=True)
                source=root/Path(doc['file']).relative_to(SOURCE_REPORTS.relative_to(REPO))
                code,out,err,elapsed=execute([args.renderer,'-r','144','-singlefile','-png',str(source),str(prefix)],run,30);rendering_seconds+=elapsed
                if code:raise RuntimeError('render failed before inference')
                images[doc['id']]=prefix.with_suffix('.png')
            cases=[(doc,'unchanged',None,None) for doc in expected['documents']]
            federal=expected['documents'][0];qc=expected['documents'][1]
            cases += [(federal,'wrong-total','amounts.arithmetic.total',9999.99),
                      (federal,'wrong-date','dates.scheduledExecutionDate','2026-10-19'),
                      (qc,'wrong-settlement','obligationLifecycle.settlement','settled'),
                      (qc,'wrong-currency','currency','USD')]
            for case_index,(doc,case,field,replacement) in enumerate(cases):
                candidate={}
                extraction=proposals[doc['id']]['extraction']
                from verify import get_path
                for path in doc['expected']:set_path(candidate,path,get_path(extraction,path))
                seeded_fields=[]
                if field:set_path(candidate,field,replacement);seeded_fields.append(field)
                if case=='wrong-settlement':
                    set_path(candidate,'obligationLifecycle.state','settled');set_path(candidate,'obligationLifecycle.providerStatus','completed')
                    seeded_fields+=['obligationLifecycle.state','obligationLifecycle.providerStatus']
                identifier=doc['id']+'-'+case
                save(run/'candidates'/(identifier+'.json'),candidate)
                prompt=prompt_base+'\nRequested paths: '+json.dumps(list(doc['expected']))+'\nMechanical candidate JSON:\n'+json.dumps(candidate,separators=(',',':'))
                if is_pi:result=inference(args,run,hook,env,identifier,prompt,images[doc['id']],variant)
                else:
                    result=hermes_module().run(hermes_prepared,prompt,images[doc['id']],run,identifier,args.timeout)
                    result.update(prompt_sha256=hashlib.sha256(prompt.encode()).hexdigest(),image_sha256=hashlib.sha256(images[doc['id']].read_bytes()).hexdigest(),image_bytes=images[doc['id']].stat().st_size)
                result.update(document=doc['id'],case=case,seeded_field=field,seeded_fields=seeded_fields)
                before=time.monotonic();result['verification']=compare_vision(result['answer'],candidate,doc,texts[doc['id']]);verification_seconds+=time.monotonic()-before
                result['verification']['passed']&=result['transport_verification']['passed'];vision.append(result)
                print(json.dumps({'stage':'vision','id':identifier,'passed':result['verification']['passed'],'seconds':result['wall_seconds']}),flush=True)
                if not result['transport_verification']['passed']:
                    blocked='first transport failure; remaining cases not launched'
                    blocked_cases=[{'id':d['id']+'-'+c,'status':'blocked','reason':blocked} for d,c,f,r in cases[case_index+1:]]
                    break
    summary={'mechanical_documents':len(mechanical),'mechanical_passed':sum(x['verification']['passed'] for x in mechanical),'mechanical_field_count':sum(x['verification']['field_count'] for x in mechanical),'mechanical_field_matches':sum(x['verification']['field_matches'] for x in mechanical),'vision_runs':len(vision),'vision_passed':sum(x['verification']['passed'] for x in vision)}
    for case_group in ('unchanged','tampered'):
        events=[e for e in vision if (e['case']=='unchanged')==(case_group=='unchanged')]
        summary[case_group]={'runs':len(events),**{key:sum(e['verification'][key] for e in events) for key in ('field_count','fields_passed','expected_matches','expected_contradictions','contradictions_detected','false_accepts','false_rejects','omissions','unknowns')}}
    result={'schema_version':1,'date':args.date,'fixture':'financial-insights-compatible','fixture_layout_revision':3,'fictional':True,'variant':args.variant,'configuration':{**variant,'provider':'private-selected-provider-alias' if vision else None,'model':args.model if vision else None,'harness_version':version,'harness_source_revision':hermes_prepared.get('code_revision') if hermes_prepared else None,'timeout_seconds':args.timeout,'render_dpi':144 if vision else None,'ground_truth_in_model_context':False,'mechanical_candidate_in_model_context':bool(vision),'workflow_agents_initialized':False,'human_review':'pending','publication':False,'projector_metadata':None,'output_limit_boundary':'declared settings plus recorded actual API controls; null controls remain unavailable' },'runtime_context_evidence':runtime_evidence,'harness_system_prompt_boundary':'Pi custom system prompt replaces default; Hermes ephemeral instruction plus native harness default system behavior retained and context files ignored','source_sha256':hashes,'variant_manifest_sha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),'source_versions':{name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in {**{name:HERE/name for name in ('run.py','verify.py','variants.json','verify-json.prompt.md','hermes-adapter.py')},**{str((WORKFLOW_DATA/name).relative_to(REPO)):WORKFLOW_DATA/name for name in ('generate.py','expected.json')}}.items()},'mechanical_source_versions':mechanical_versions,'mechanical_source_version_collection':'captured before mechanical execution','mechanical_invocation_boundary':'shared exported FinancialRecordsCommand.run, same operation engine as registered CLI; no operational command-profile bootstrap','mechanical':mechanical,'vision':vision,'blocked_stage':blocked,'blocked_cases':blocked_cases,'timing':{'preflight_seconds':round(preflight,3),'mechanical_seconds':round(mechanical_seconds,3),'rendering_seconds':round(rendering_seconds,3),'vision_seconds':round(sum(x['wall_seconds'] for x in vision),3),'vision_verification_seconds':round(verification_seconds,3),'total_wall_seconds':round(time.monotonic()-start,3),'boundary':'run setup, copying fictional originals, real preparation, text quote preparation, rendering and inference/evaluation; excludes fixture generation and manual visual inspection'},'summary':summary}
    save(run/'results.json',result);save(output,result);print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
