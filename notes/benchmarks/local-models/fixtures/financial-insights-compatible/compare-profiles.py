#!/usr/bin/env python3
"""Bounded alternating comparison of two named fictional-data test profiles."""
import argparse
from argparse import Namespace
import copy
import hashlib
import json
import math
import os
import selectors
import signal
from pathlib import Path
import re
import statistics
import subprocess
import sys
import time
sys.dont_write_bytecode=True
from run import HERE, REPO, DEFAULT_DATA_ROOT, select_test_profile, validate_variant, load_dataset

QUALITY_KEYS=('model','context_window','output_tokens','thinking','server_enable_thinking','sampling')
CODE_FILES=('run.py','verify.py','variants.json','verify-json.prompt.md','hermes-adapter.py')

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path,value):path.write_text(json.dumps(value,indent=2)+'\n')
def ordered_arms(pairs):
    return [(pair+1,label) for pair in range(pairs) for label in (('a','b') if pair%2==0 else ('b','a'))]

def read_profile(config,name):
    args=Namespace(variant=None,agent_dir=None,provider=None,model=None,variants=None,harness_source=None,data_root=None)
    profile=select_test_profile(args,config,name)
    manifest=Path(profile.get('variants') or HERE/'variants.json')
    variant=validate_variant(json.loads(manifest.read_text())['variants'].get(profile['variant']))
    if not variant.get('supported') or variant.get('adapter') not in ('pi-print-json','hermes-native-json'):
        raise ValueError('comparison requires implemented native image profiles')
    root=Path(profile.get('data_root') or DEFAULT_DATA_ROOT)
    reference=load_dataset(root)
    if len(reference['documents'])!=3:raise ValueError('this comparison stage requires exactly three unchanged PDFs')
    facts=[{k:v for k,v in doc.items() if k not in ('file','source_relative')} for doc in reference['documents']]
    fingerprints={doc['id']:sha(root/doc['source_relative']) for doc in reference['documents']}
    catalog=json.loads((Path(profile['agent_dir'])/'models.json').read_text())
    private_transport=catalog['providers'][profile['provider']]
    quality={key:profile['model'] if key=='model' else variant.get(key) for key in QUALITY_KEYS}
    return {'private_transport':private_transport,'private_name':name,'profile':profile,'variant':variant,'quality':quality,
            'pdfs':fingerprints,'reference_facts_sha256':hashlib.sha256(json.dumps(facts,sort_keys=True).encode()).hexdigest(),
            'expected_source_sha256':sha(root/'expected.json'),'generator_sha256':sha(root/'generate.py'),
            'variant_manifest_sha256':sha(manifest)}

def comparison_plan(config,names,pairs):
    if len(names)!=2 or names[0]==names[1]:raise ValueError('select two distinct profile names')
    if type(pairs) is not int or not 1<=pairs<=5:raise ValueError('pairs must be 1..5')
    profiles={label:read_profile(config,name) for label,name in zip(('a','b'),names)}
    a,b=profiles.values()
    for key in ('private_transport','quality','pdfs','reference_facts_sha256','expected_source_sha256','generator_sha256'):
        if a[key]!=b[key]:raise ValueError('profile pair does not match: '+key)
    code={name:sha(HERE/name) for name in CODE_FILES}
    return {'profiles':profiles,'order':ordered_arms(pairs),'pairs':pairs,'code_versions':code}

def public_plan(plan):
    return {'pairs':plan['pairs'],'order':[{'pair':pair,'profile':label} for pair,label in plan['order']],
            'profiles':{label:{'model':p['quality']['model'],'settings':p['quality'],'harness':p['variant'].get('harness'),
                               'adapter':p['variant']['adapter'],'variant':p['profile']['variant']} for label,p in plan['profiles'].items()},
            'source_pdf_sha256':plan['profiles']['a']['pdfs'],
            'reference_facts_sha256':plan['profiles']['a']['reference_facts_sha256'],
            'prompt_sha256':plan['code_versions']['verify-json.prompt.md'],'code_versions':plan['code_versions']}

def assess_arm(result,code,plan_profile,code_versions):
    if code!=0 or not isinstance(result,dict):return 'verification-infrastructure-failure'
    if result.get('blocked_stage') or len(result.get('vision',[]))!=7:return 'transport-or-incomplete-arm'
    if not all(isinstance(row,dict) and row.get('transport_verification',{}).get('passed') is True for row in result['vision']):return 'transport-failure'
    if result.get('source_sha256')!=plan_profile['pdfs']:return 'source-changed'
    versions=result.get('source_versions') or {}
    if any(versions.get(key)!=value for key,value in code_versions.items()):return 'execution-source-changed'
    if versions.get('selected-profile-data/expected.json')!=plan_profile['expected_source_sha256']:return 'reference-source-changed'
    if versions.get('selected-profile-data/generate.py')!=plan_profile['generator_sha256']:return 'generator-source-changed'
    cfg=result.get('configuration') or {}
    if result.get('variant')!=plan_profile['profile']['variant'] or any(cfg.get(key)!=plan_profile['variant'].get(key) for key in ('adapter','platform','harness')):return 'harness-or-variant-mismatch'
    if any(cfg.get(key)!=value for key,value in plan_profile['quality'].items()):return 'effective-settings-mismatch'
    proof=result.get('runtime_context_evidence') or {}
    if proof.get('verified') is not True or proof.get('context_window')!=plan_profile['quality']['context_window'] or proof.get('native_image') is not True:return 'runtime-context-proof-missing'
    if result.get('variant_manifest_sha256')!=plan_profile['variant_manifest_sha256']:return 'variant-manifest-changed'
    if not isinstance(result.get('summary'),dict):return 'verification-infrastructure-failure'
    return None

def case_signature(result):
    events=result.get('vision') or []
    signature={}
    for event in events:
        key=event.get('id')
        values={name:event.get(name) for name in ('prompt_sha256','image_sha256','image_bytes')}
        if not isinstance(key,str) or key in signature or any(not isinstance(values[name],str) or len(values[name])!=64 for name in ('prompt_sha256','image_sha256')) or type(values['image_bytes']) is not int or values['image_bytes']<=0:
            raise ValueError('paired case identity proof unavailable')
        signature[key]=values
    if len(signature)!=7:raise ValueError('paired case coverage mismatch')
    return signature

def output_lengths(runroot,events):
    values=[]
    for event in events:
        path=Path(runroot)/'vision'/(event['id']+'.events.jsonl')
        final=None
        if path.is_file():
            for line in path.read_text().splitlines():
                try:item=json.loads(line)
                except ValueError:continue
                if item.get('type')=='result':final=item.get('text','')
                message=item.get('message') or {}
                if item.get('type')=='message_end' and message.get('role')=='assistant':
                    final=''.join(x.get('text','') for x in message.get('content',[]) if x.get('type')=='text')
        values.append({'case':event['id'],'output_chars':len(final) if isinstance(final,str) else None,
                       'structured_answer_chars':len(json.dumps(event['answer'],separators=(',',':'))) if isinstance(event.get('answer'),dict) else None})
    return values

def known_sum(values):
    return sum(values) if values and all(type(x) in (int,float) and math.isfinite(x) for x in values) else None

def observation(result,runroot,elapsed):
    events=result.get('vision') or []
    timing=result.get('timing') or {}
    usage={key:known_sum([(event.get('usage') or {}).get(key) for event in events]) for key in ('input','output','totalTokens','cacheRead','cacheWrite')}
    return {'launcher_wall_seconds':round(elapsed,3),'timing':timing,'summary':result.get('summary'),
            'usage':usage,'output_lengths':output_lengths(runroot,events),
            'api_seconds':known_sum([e.get('api_seconds') for e in events]),
            'first_token_seconds':[e.get('first_token_seconds') for e in events],
            'provider_request_hooks_observed':known_sum([e.get('provider_request_hooks_observed') for e in events]),
            'model_api_calls':known_sum([e.get('model_api_calls') for e in events])}

def spread(values):
    data=[x for x in values if type(x) in (int,float) and math.isfinite(x)]
    if not data:return {'count':0,'median':None,'min':None,'max':None,'population_stdev':None,'quartiles':None}
    return {'count':len(data),'median':statistics.median(data),'min':min(data),'max':max(data),
            'population_stdev':statistics.pstdev(data),'quartiles':statistics.quantiles(data,n=4,method='inclusive') if len(data)>=5 else None}

def summarize(arms):
    groups={label:[a for a in arms if a['profile']==label] for label in ('a','b')}
    summary={}
    for label,rows in groups.items():
        valid=[r for r in rows if r.get('failure') is None]
        accuracy={key:sum((r['metrics']['summary'].get(group) or {}).get(key,0) for r in valid for group in ('unchanged','tampered')) for key in ('field_count','fields_passed','expected_contradictions','contradictions_detected','false_accepts','false_rejects','omissions','unknowns')}
        accuracy['interpretation']='The same 83 field-case checks repeat per arm; accumulated checks are not independent cases.'
        summary[label]={'accuracy':accuracy,'completed_arms':len(rows),'valid_transport_arms':len(valid),'infrastructure_or_transport_failures':sum(r.get('failure') is not None for r in rows),
                        'accuracy_failed_arms':sum((r.get('metrics',{}).get('summary') or {}).get('vision_passed')!=7 for r in valid),
                        'wall_seconds':spread([r['metrics']['timing'].get('total_wall_seconds') for r in valid]),
                        'vision_seconds':spread([r['metrics']['timing'].get('vision_seconds') for r in valid]),
                        'output_tokens':spread([r['metrics']['usage'].get('output') for r in valid]),
                        'input_tokens':spread([r['metrics']['usage'].get('input') for r in valid]),
                        'cache_read_tokens':spread([r['metrics']['usage'].get('cacheRead') for r in valid]),
                        'cache_write_tokens':spread([r['metrics']['usage'].get('cacheWrite') for r in valid]),
                        'output_chars':spread([known_sum([x['output_chars'] for x in r['metrics']['output_lengths']]) for r in valid])}
    paired=[]
    for pair in sorted({r['pair'] for r in arms}):
        rows={r['profile']:r for r in arms if r['pair']==pair and r.get('failure') is None}
        if set(rows)!= {'a','b'}:continue
        a=rows['a']['metrics']['timing'].get('total_wall_seconds');b=rows['b']['metrics']['timing'].get('total_wall_seconds')
        if type(a) in (int,float) and type(b) in (int,float) and a>0:
            paired.append({'pair':pair,'b_minus_a_seconds':b-a,'b_over_a_ratio':b/a})
    return {'profiles':summary,'paired_observations':paired,'interpretation':'Observed matched-task trial, not a causal harness ranking. Output length and native context can differ; no output-token matching is claimed.'}

def privacy_check(value):
    text=json.dumps(value)
    patterns=(r'/(?:Users|private|home|var/folders)/',r'https?://',r'apiKey|api_key|base_url',
              r'\b(?:\d{1,3}\.){3}\d{1,3}\b',r'ai-profile/sc/|incorparated|sergii|asus-gx10-model-provider')
    if any(re.search(pattern,text,re.I) for pattern in patterns):raise ValueError('public export privacy check failed; preserve evidence privately')

def terminate_owned_group(process):
    try:os.killpg(process.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    try:process.wait(timeout=5)
    except subprocess.TimeoutExpired:pass
    # The leader may exit before an owned model worker; clean up surviving descendants.
    try:os.killpg(process.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    process.wait(timeout=5)


def execute_child(command,root,identifier,on_progress):
    """Only the owned child session is terminated on timeout or interruption."""
    started=time.monotonic();timed_out=False;buffer=b''
    with (root/(identifier+'.stdout.log')).open('wb') as stdout,(root/(identifier+'.stderr.log')).open('wb') as stderr:
        process=subprocess.Popen(command,cwd=REPO,stdout=subprocess.PIPE,stderr=stderr,start_new_session=True)
        selector=selectors.DefaultSelector();selector.register(process.stdout,selectors.EVENT_READ)
        try:
            on_progress({'stage':'child-started','owned_process_group':process.pid})
            while selector.get_map():
                if time.monotonic()-started>=900:
                    timed_out=True;terminate_owned_group(process);break
                for key,_ in selector.select(timeout=1):
                    chunk=os.read(key.fileobj.fileno(),65536)
                    if not chunk:selector.unregister(key.fileobj);continue
                    stdout.write(chunk);stdout.flush();buffer+=chunk
                    while b'\n' in buffer:
                        line,buffer=buffer.split(b'\n',1)
                        try:progress=json.loads(line)
                        except (ValueError,UnicodeError):continue
                        if isinstance(progress,dict) and 'stage' in progress:on_progress(progress)
            try:code=process.wait(timeout=5)
            except subprocess.TimeoutExpired:timed_out=True;terminate_owned_group(process);code=124
        except BaseException:
            terminate_owned_group(process);raise
        finally:selector.close();process.stdout.close()
    return 124 if timed_out else code,time.monotonic()-started

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile-config',required=True);parser.add_argument('--profiles',nargs=2,required=True)
    parser.add_argument('--pairs',type=int,default=5);parser.add_argument('--run-root');parser.add_argument('--results')
    parser.add_argument('--check-plan',action='store_true')
    args=parser.parse_args()
    try:plan=comparison_plan(args.profile_config,args.profiles,args.pairs)
    except (ValueError,OSError,KeyError):parser.error('invalid or unmatched private profile pair')
    presentation=public_plan(plan);privacy_check(presentation)
    if args.check_plan:print(json.dumps({'plan':presentation,'inference_started':False,'directories_created':False}));return
    if not args.run_root:parser.error('explicit fresh ignored run-root required')
    root=Path(args.run_root).resolve()
    try:root.relative_to(REPO/'notes/benchmarks/local-models/runs')
    except ValueError:parser.error('run-root must be under ignored visible benchmark runs')
    if root.exists():parser.error('run-root already exists; never overwrite or retry blindly')
    export=Path(args.results).resolve() if args.results else None
    if export and (export.exists() or export.parent.exists()):parser.error('public results require a fresh dedicated folder')
    root.mkdir(parents=True)
    git=subprocess.run(['git','-C',str(REPO),'rev-parse','HEAD'],capture_output=True,text=True,timeout=10)
    state={'schema_version':1,'fictional':True,'plan':presentation,'execution_commit':git.stdout.strip() if git.returncode==0 else None,
           'wrapper_sha256':sha(__file__),'arms':[],'harness_versions':{},'blocked_arms':[],'status':'running','started_at':time.time()}
    started=time.monotonic()
    def interrupted(signum,frame):raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,interrupted)
    for index,(pair,label) in enumerate(plan['order']):
        identifier=f'pair-{pair:02d}-{label}';child=root/identifier
        state['active_arm']={'id':identifier,'pair':pair,'profile':label,'stage':'child-runner'};write(root/'checkpoint.json',state)
        command=[sys.executable,str(HERE/'run.py'),'--test-profile',plan['profiles'][label]['private_name'],
                 '--profile-config',str(Path(args.profile_config).resolve()),'--run-root',str(child),'--results',str(child/'results.json')]
        def progress(value):
            state['active_arm'].update(stage=value.get('stage'),case_id=value.get('id'))
            if 'owned_process_group' in value:state['active_arm']['owned_process_group']=value['owned_process_group']
            write(root/'checkpoint.json',state)
            print(json.dumps({'arm':identifier,'progress':value}),flush=True)
        before=time.monotonic()
        try:code,elapsed=execute_child(command,root,identifier,progress)
        except KeyboardInterrupt:code,elapsed=130,time.monotonic()-before
        except OSError:code,elapsed=None,time.monotonic()-before
        try:record=json.loads((child/'results.json').read_text())
        except (OSError,ValueError):record=None
        failure='interrupted' if code==130 else assess_arm(record,code,plan['profiles'][label],plan['code_versions'])
        if failure is None:
            cfg=record['configuration']
            version={key:cfg.get(key) for key in ('harness_version','harness_source_revision')}
            if label not in state['harness_versions']:state['harness_versions'][label]=version
            elif version!=state['harness_versions'][label]:failure='harness-version-or-revision-changed'
        if failure is None:
            try:
                signature=case_signature(record)
                if 'case_signature' not in state:state['case_signature']=signature
                elif signature!=state['case_signature']:failure='paired-task-or-image-mismatch'
            except ValueError:failure='paired-case-proof-unavailable'
        arm={'id':identifier,'pair':pair,'profile':label,'exit_code':code,'failure':failure,
             'metrics':observation(record,child,elapsed) if isinstance(record,dict) else {'launcher_wall_seconds':round(elapsed,3)}}
        if isinstance(record,dict):arm['observation']=record
        state['arms'].append(arm);state['active_arm']=None;state['summary']=summarize(state['arms']);write(root/'checkpoint.json',state)
        print(json.dumps({'id':identifier,'failure':failure,'wall_seconds':round(elapsed,3)}),flush=True)
        if failure:
            state['status']='interrupted' if code==130 else 'stopped';state['blocked_arms']=[{'pair':p,'profile':l,'reason':'earlier transport/infrastructure failure'} for p,l in plan['order'][index+1:]];break
    if state['status']=='running':state['status']='completed'
    state['total_wall_seconds']=round(time.monotonic()-started,3);write(root/'checkpoint.json',state)
    if export:
        privacy_check(state)
        export.parent.mkdir(parents=True)
        for arm in state['arms']:
            if 'observation' in arm:write(export.parent/(arm['id']+'.json'),arm['observation'])
        write(export,state)
    print(json.dumps({'status':state['status'],'completed_arms':len(state['arms']),'summary':state['summary']}),flush=True)
if __name__=='__main__':main()
