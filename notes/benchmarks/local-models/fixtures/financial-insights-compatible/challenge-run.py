#!/usr/bin/env python3
"""Separate challenge executor; baseline implementations remain unchanged."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import sys
sys.dont_write_bytecode=True
import run as shared
from verify import get_path,parse_answer

HERE=Path(__file__).resolve().parent
ACTIVE_RUN=None
spec=importlib.util.spec_from_file_location('challenge_verify',HERE/'challenge-verify.py')
verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)


def invoke(argv,cwd,env,timeout):
    start=time.monotonic();process=subprocess.Popen(argv,cwd=cwd,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try:out,err=process.communicate(timeout=timeout);code=process.returncode
    except (subprocess.TimeoutExpired,KeyboardInterrupt) as error:
        os.killpg(process.pid,signal.SIGTERM)
        try:out,err=process.communicate(timeout=3)
        except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);out,err=process.communicate()
        if isinstance(error,KeyboardInterrupt):raise
        code=124
    return code,out,err,time.monotonic()-start


def observations(text):
    values=[]
    for line in text.splitlines():
        try:
            item=json.loads(line)
            if isinstance(item,dict):values.append(item)
        except ValueError:pass
    return values


def visual(args,run,prepared,variant,identifier,prompt,images):
    folder=run/'raw';folder.mkdir(exist_ok=True)
    control=folder/(identifier+'.controls.jsonl');query=folder/(identifier+'.query.txt')
    adapter=variant['adapter']
    if adapter=='pi-print-json':
        hook,env,_=prepared;env=dict(env,BENCHMARK_CONTROL_LOG=str(control))
        argv=[args.pi,'--print','--mode','json','--no-session','--no-tools','--no-mcp','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-approve','--provider',args.provider,'--model',args.model,'--thinking','off','--system-prompt','Inspect fictional financial PDF evidence and return the requested JSON.','-e',str(hook),'--',*['@'+str(x) for x in images],prompt]
    else:
        module=shared.hermes_module();env=module.isolated_environment(prepared['home'],prepared['source'],control)
        # Native CLI collects the leading image drop AND the explicit --image.
        query.write_text((str(images[0])+'\n' if len(images)==2 else '')+prompt)
        argv=[str(prepared['python']),'-m','hermes_cli.main','chat','--query-file',str(query),'--image',str(images[-1]),'--format','stream-json','--oneshot','--reasoning','none','--ignore-rules','--provider','benchmark-native','--model',args.model]
    code,out,err,elapsed=invoke(argv,run,env,args.timeout)
    (folder/(identifier+'.events.jsonl')).write_text(out);(folder/(identifier+'.stderr.log')).write_text(err)
    events=observations(out);controls=observations(control.read_text()) if control.exists() else []
    if adapter=='pi-print-json':
        terminal=[x['message'] for x in events if x.get('type')=='message_end' and x.get('message',{}).get('role')=='assistant']
        final=terminal[-1] if terminal else {};text=''.join(x.get('text','') for x in final.get('content',[]) if x.get('type')=='text');usage=final.get('usage')
    else:
        terminal=[x for x in events if x.get('type')=='result'];final=terminal[-1] if terminal else {};text=final.get('text','');usage=final.get('tokens')
        if not isinstance(usage,dict) or not any(type(v) in (int,float) and v>0 for v in usage.values()):usage=None
        if final.get('exit_code')!=0:code=code or 1
    try:answer=parse_answer(text)
    except (ValueError,TypeError):answer=None
    gate=verifier.transport_gate(adapter,controls,args.model,variant,len(images),code,final)
    gate['one_completion']=len(terminal)==1;gate['passed']=all(v for k,v in gate.items() if k!='passed')
    post=[x for x in controls if x.get('event')=='post']
    return {'id':identifier,'wall_seconds':elapsed,'exit_code':code,'transport_verification':gate,'answer':answer,'usage':usage,
            'output_characters':len(text),'output_bytes':len(text.encode()),'request_observations':[{key:value for key,value in item.items() if key in {'event','observer_time','model','image_count','tool_count','tools_in_payload','started_at','api_request_id','retry_count','max_tokens','enable_thinking','temperature','top_p','context_length','api_duration','first_chunk_at','ended_at','finish_reason','assistant_tool_call_count','usage'}} for item in controls],
            'provider_request_hooks_observed':len([x for x in controls if x.get('event')=='pre']) if adapter=='hermes-native-json' else len(controls),'model_api_calls':None,'first_token_seconds':(post[0]['first_chunk_at']-post[0]['started_at']) if len(post)==1 and type(post[0].get('first_chunk_at')) in (int,float) and type(post[0].get('started_at')) in (int,float) else None,'api_seconds':post[0].get('api_duration') if len(post)==1 else None,
            'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),
            'images':[{'page':i+1,'sha256':hashlib.sha256(x.read_bytes()).hexdigest(),'bytes':x.stat().st_size} for i,x in enumerate(images)]}


def plan(args):
    profile=shared.select_test_profile(args,args.profile_config,args.test_profile)
    variants=Path(args.variants) if args.variants else HERE/'variants.json'
    manifest=json.loads(variants.read_text());variant=shared.validate_variant(manifest['variants'][args.variant])
    if variant['adapter'] not in ('pi-print-json','hermes-native-json'):raise ValueError('native image profile required')
    if variant['context_window']!=65536 or variant['output_tokens']!=2048 or variant.get('sampling')!={'temperature':0,'top_p':1}:raise ValueError('matched challenge budgets required')
    data=Path(args.data_root).resolve()
    if data!=shared.REPO/'ai-profile/example/data/financial-insights-challenges':raise ValueError('challenge execution is restricted to public fictional example data')
    expected=shared.load_dataset(data);root=data;transcripts=json.loads((data/'transcripts.json').read_text())
    if transcripts.get('fictional') is not True:raise ValueError('fictional transcripts required')
    transcript_map={x['id']:x['pages'] for x in transcripts['documents']}
    if len(transcript_map)!=len(transcripts['documents']) or set(transcript_map)!={x['id'] for x in expected['documents']}:raise ValueError('transcript coverage mismatch')
    for doc in expected['documents']:
        if hashlib.sha256((root/doc['source_relative']).read_bytes()).hexdigest()!=doc['sha256']:raise ValueError('source hash mismatch')
        if set(doc['field_provenance'])!=set(doc['expected']):raise ValueError('incomplete provenance')
        pages=transcript_map[doc['id']]
        if sorted(x['page'] for x in pages)!=list(range(1,doc['page_count']+1)) or any(not isinstance(x['visible_text'],list) or any(not isinstance(t,str) for t in x['visible_text']) for x in pages):raise ValueError('invalid transcript pages')
    return profile,variant,expected,root,transcripts


def main():
    global ACTIVE_RUN
    parser=argparse.ArgumentParser();parser.add_argument('--profile-config',required=True);parser.add_argument('--test-profile',required=True)
    parser.add_argument('--check-plan',action='store_true');parser.add_argument('--pilot-multipage',action='store_true');parser.add_argument('--run-root');parser.add_argument('--results');parser.add_argument('--timeout',type=int,default=90);parser.add_argument('--pi',default='pi')
    for key in ('variant','agent-dir','provider','model','harness-source','variants','data-root'):parser.add_argument('--'+key)
    args=parser.parse_args();profile,variant,expected,data,transcripts=plan(args)
    if args.pilot_multipage:expected['documents']=[x for x in expected['documents'] if x['page_count']==2]
    if args.check_plan:
        print(json.dumps({'ready':True,'documents':len(expected['documents']),'blind_page_requests':0 if args.pilot_multipage else sum(x['page_count'] for x in expected['documents']),'contextual_requests':len(expected['documents']),'inference_started':False}));return
    if not args.run_root or not args.results:parser.error('execution requires fresh run-root and results')
    run=Path(args.run_root).resolve()
    if run.exists() or not run.is_relative_to(shared.REPO/'notes/benchmarks/local-models/runs'):raise ValueError('fresh visible ignored run root required')
    if subprocess.run(['git','check-ignore','-q',str(run)],cwd=shared.REPO).returncode:raise ValueError('run root must be ignored')
    output=Path(args.results).resolve()
    allowed_output=output.is_relative_to(run) or output.is_relative_to(shared.REPO/'models/qwen3.8-flash-next/benchmarks/gx10')
    if not allowed_output or output.exists():raise ValueError('fresh private run result or scoped public benchmark result required')
    runtime=shared.live_profile_check(profile,variant);start=time.monotonic();run.mkdir(mode=0o700,parents=True);ACTIVE_RUN=run
    hashes={name:hashlib.sha256((HERE/name).read_bytes()).hexdigest() for name in ('challenge-run.py','challenge-verify.py','challenge-extract.prompt.md','challenge-check.prompt.md','run.py','hermes-adapter.py','variants.json','verify.py')}
    if variant['adapter']=='pi-print-json':
        prepared=shared.setup_pi(args,run,variant);version=prepared[2];revision=None
        hook=prepared[0];source=hook.read_text()
        if 'image_count:messages.reduce' not in source:raise ValueError('Pi hook source contract changed')
        hook.write_text(source.replace('image_count:messages.reduce','tools_in_payload:(payload.tools??[]).length,image_count:messages.reduce'))
    else:
        provider=json.loads((Path(args.agent_dir)/'models.json').read_text())['providers'][args.provider]
        config={'source_root':args.harness_source,'model':args.model,'base_url':provider['baseUrl'],'api':provider['api'],'api_key':provider.get('apiKey'),'headers':provider.get('headers'),**variant}
        module=shared.hermes_module();prepared=module.prepare(config,run);version=module.version(prepared,run);revision=prepared.get('code_revision')
    mechanical_versions=shared.mechanical_source_versions()
    dataset_hashes={name:hashlib.sha256((data/name).read_bytes()).hexdigest() for name in ('expected.json','transcripts.json','generate.py')}
    git=subprocess.run(['git','rev-parse','HEAD'],cwd=shared.REPO,capture_output=True,text=True,timeout=10).stdout.strip()
    images={};render_start=time.monotonic()
    for index,doc in enumerate(expected['documents'],1):
        folder=run/('doc-%02d'%index);folder.mkdir();source=folder/'source.pdf';source.write_bytes((data/doc['source_relative']).read_bytes())
        code,_,_,_=invoke(['pdftoppm','-png','-r','144',str(source),str(folder/'page')],run,None,30)
        pages=sorted(folder.glob('page-*.png'))
        if code or len(pages)!=doc['page_count']:raise ValueError('rendered page count mismatch')
        images[doc['id']]=pages
    rendering=time.monotonic()-render_start;records=[];mechanical=[];blocked=None
    transcripts={x['id']:{p['page']:p['visible_text'] for p in x['pages']} for x in transcripts['documents']}
    def record(doc,mode,page,candidate,identifier,pages):
        prompt=(HERE/('challenge-extract.prompt.md' if mode=='extract' else 'challenge-check.prompt.md')).read_text()
        prompt+='\nPage numbers: '+json.dumps([page] if page else list(range(1,doc['page_count']+1)))+'\nRequested paths: '+json.dumps(verifier.requested_paths(doc,page))
        if mode=='check':prompt+='\nActual mechanical state: '+json.dumps({'status':mechanical[-1]['status'],'failure_category':mechanical[-1]['failure_category']})+'\nActual candidate fields: '+json.dumps(candidate,separators=(',',':'))
        result=visual(args,run,prepared,variant,identifier,prompt,pages)
        result['mode']=mode;result['document']=doc['id'];result['page']=page
        if page is not None:result['images'][0]['page']=page
        result['verification']=verifier.score(doc,transcripts[doc['id']],result['answer'],mode,page,candidate,result['transport_verification'])
        records.append(result);shared.save(run/'checkpoint.json',{'stage':mode,'completed_requests':len(records),'last_id':identifier,'transport_valid':result['transport_verification']['passed']})
        print(json.dumps({'stage':mode,'id':identifier,'passed':result['verification']['passed'],'wall_seconds':result['wall_seconds']}),flush=True)
        return result['transport_verification']['passed']
    for index,doc in enumerate([] if args.pilot_multipage else expected['documents'],1):
        for page,image in enumerate(images[doc['id']],1):
            if not record(doc,'extract',page,None,'doc-%02d-extract-%02d'%(index,page),[image]):blocked='blind-transport';break
        if blocked:break
    if not blocked:
        root=run/'data/corporate/reports';import shutil;shutil.copytree(data/'corporate/reports',root)
        engine=shared.REPO/'ai-commands/data/financial-records/financial-records.command.mjs'
        bridge='import {FinancialRecordsCommand} from '+json.dumps(engine.as_uri())+'; console.log(JSON.stringify(await new FinancialRecordsCommand().run(process.argv.slice(1))));'
        for index,doc in enumerate(expected['documents'],1):
            source=root/Path(doc['source_relative']).relative_to('corporate/reports')
            operation=['prepare-tax-from-source','--root',str(root),'--source',str(source),'--branch','example-consulting','--year','2026','--quarter','q4','--section','out']
            code,out,err,elapsed=invoke(['node','--input-type=module','-e',bridge,*operation],shared.REPO,None,30)
            (run/('doc-%02d-mechanical.stderr.log'%index)).write_text(err)
            try:proposal=json.loads(out)
            except ValueError:proposal={}
            shared.save(run/('doc-%02d-proposal.json'%index),proposal)
            extraction=proposal.get('extraction') or {};candidate={}
            for path in verifier.requested_paths(doc):
                try:value=get_path(extraction,path)
                except (KeyError,TypeError):continue
                if value is not None:candidate[path]=value
            mechanical_fields=[{'path':path,'correct':verifier.equal(get_path(extraction,path),value)} for path,value in doc['expected'].items()]
            mechanical.append({'field_checks':mechanical_fields,'accuracy_passed':code==0 and proposal.get('status')=='prepared' and all(x['correct'] for x in mechanical_fields),'failure_category':None if code==0 and proposal.get('status')=='prepared' else 'mechanical-non-support-or-read-failure','document':doc['id'],'exit_code':code,'wall_seconds':elapsed,'status':proposal.get('status'),'prepared':proposal.get('status')=='prepared','candidate_available':bool(candidate),'candidate':candidate,'boundary':'actual mechanical proposal, unsupported/read failure distinct from visual accuracy; full proposal/errors retained privately'})
            if not record(doc,'check',None,candidate,'doc-%02d-check'%index,images[doc['id']]):blocked='contextual-transport';break
    drift=any(hashlib.sha256((data/doc['source_relative']).read_bytes()).hexdigest()!=doc['sha256'] for doc in expected['documents']) or shared.mechanical_source_versions()!=mechanical_versions or any(hashlib.sha256((HERE/name).read_bytes()).hexdigest()!=digest for name,digest in hashes.items()) or any(hashlib.sha256((data/name).read_bytes()).hexdigest()!=digest for name,digest in dataset_hashes.items())
    if drift:blocked='execution-source-drift'
    result={'schema_version':1,'fictional':True,'fixture':'financial-insights-challenges','configuration':{**variant,'model':args.model,'harness_version':version,'harness_source_revision':revision},'runtime_context_evidence':runtime,'source_versions':hashes,'mechanical_source_versions':mechanical_versions,'dataset_versions':dataset_hashes,'source_sha256':{doc['id']:doc['sha256'] for doc in expected['documents']},'execution_commit':git,'pilot_multipage':args.pilot_multipage,'source_drift':drift,'mechanical':mechanical,'observations':records,'blocked_stage':blocked,'summary':{mode:{'wall_seconds':sum(x['wall_seconds'] for x in records if x['mode']==mode),'requests':sum(x['mode']==mode for x in records),'field_checks':sum(x['verification']['field_count'] for x in records if x['mode']==mode and 'field_count' in x['verification']),'correct_fields':sum(x['verification']['correct_fields'] for x in records if x['mode']==mode and 'correct_fields' in x['verification'])} for mode in ('extract','check')},'timing':{'rendering_seconds':rendering,'mechanical_seconds':sum(x['wall_seconds'] for x in mechanical),'visual_seconds':sum(x['wall_seconds'] for x in records),'total_wall_seconds':time.monotonic()-start},'boundary':'two separately measured model tasks; no tools, publication or record application; raw proposals and logs private'}
    if output.exists():raise ValueError('result already exists')
    encoded=json.dumps(result)
    import re
    from urllib.parse import urlsplit
    private_host=urlsplit(profile['server_props_url']).hostname
    if re.search(r'/Users/|/home/|https?://|apiKey|base_url|baseUrl|(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])',encoded) or (private_host and private_host in encoded):raise ValueError('public evidence privacy scan failed; raw evidence retained privately')
    shared.save(output,result)
    if blocked:sys.exit(1)

def infrastructure_checkpoint(reason):
    if ACTIVE_RUN is not None:
        path=ACTIVE_RUN/'checkpoint.json'
        try:previous=json.loads(path.read_text()) if path.exists() else {}
        except ValueError:previous={}
        shared.save(path,{**previous,'status':'blocked','blocked_stage':reason})

if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:
        infrastructure_checkpoint('interrupted');sys.exit(130)
    except (ValueError,OSError,KeyError,TypeError):
        infrastructure_checkpoint('infrastructure-error')
        print(json.dumps({'status':'blocked','reason':'challenge-preflight-or-infrastructure-error','private_diagnostics':'inspect selected input/config locally'}));sys.exit(1)
