"""Independent page-aware challenge scoring; references never enter model context."""
import math
import re


def equal(a,b):
    if type(a) in (int,float) and type(b) in (int,float):
        return math.isfinite(a) and math.isfinite(b) and abs(a-b)<0.005
    return type(a)==type(b) and a==b


def requested_paths(document,page=None):
    return [path for path,proof in document['field_provenance'].items()
            if not (page is not None and proof['expected_support']=='inferred' and len(proof['source_pages'])>1)]


def truth(document,path,page=None):
    proof=dict(document['field_provenance'][path])
    if path=='currency' and document.get('visual_assessment',{}).get('currency'):
        proof=dict(document['visual_assessment']['currency'])
    if page is not None and page not in proof['source_pages']:
        return None,'unknown',[]
    return proof.get('observed_value',proof['value']),proof['expected_support'],proof['source_pages']


def normalize(text):
    return re.sub(r'\s+',' ',text).strip().casefold()


def evidence_valid(evidence,transcript,allowed,required):
    if not isinstance(evidence,list):return False
    pages=set()
    for item in evidence:
        if not isinstance(item,dict) or set(item)!={'page','quote'}:return False
        page=item['page'];quote=item['quote']
        if type(page) is not int or page not in allowed or not isinstance(quote,str) or not quote.strip():return False
        source=normalize(' '.join(transcript.get(page,[])))
        quoted=normalize(quote)
        if not re.search(r'(?<!\w)'+re.escape(quoted)+r'(?!\w)',source):return False
        pages.add(page)
    return not required or bool(pages)


def value_in_evidence(value,evidence,path):
    text=normalize(' '.join(x.get('quote','') for x in evidence))
    if type(value) in (int,float):
        numbers=re.findall(r'(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?![\w.])',text)
        return any(equal(float(x.replace(',','')),value) for x in numbers)
    if path=='obligationLifecycle.providerStatus':return 'to be processed' in text or 'to-be-processed' in text
    if isinstance(value,str):return normalize(value) in text
    return False


def score(document,transcript,answer,mode,page=None,candidate=None,transport=None):
    """Fail closed on schema, page proof and real image transport; keep field failures."""
    expected_pages=[page] if page is not None else list(range(1,document['page_count']+1))
    paths=requested_paths(document,page)
    errors=[];checks=[]
    if not isinstance(answer,dict):return {'passed':False,'errors':['non-object-output'],'fields':[]}
    if set(answer)!={'pages_seen','fields','arithmetic'}:errors.append('output-schema')
    pages=answer.get('pages_seen')
    if not isinstance(pages,list) or any(type(x) is not int for x in pages) or sorted(pages)!=expected_pages:
        errors.append('page-coverage')
    if transport is not None and not transport.get('passed'):errors.append('transport')
    fields=answer.get('fields')
    if not isinstance(fields,list) or any(not isinstance(x,dict) for x in fields):
        return {'passed':False,'errors':errors+['field-schema'],'fields':[]}
    actual_paths=[x.get('path') for x in fields]
    if any(not isinstance(x,str) for x in actual_paths) or len(set(actual_paths))!=len(actual_paths) or set(actual_paths)!=set(paths):
        errors.append('field-path-coverage')
    bypath={x.get('path'):x for x in fields if isinstance(x.get('path'),str)}
    for path in paths:
        value,support,source_pages=truth(document,path,page)
        field=bypath.get(path,{})
        required_keys={'path','observed','support','evidence'}|({'status'} if mode=='check' else set())
        if set(field)!=required_keys:errors.append('field-schema:'+path)
        allowed=[x for x in source_pages if x in expected_pages] or expected_pages
        valid=evidence_valid(field.get('evidence'),transcript,allowed,support!='unknown')
        if valid and support in ('printed','ambiguous'):valid=value_in_evidence(value,field['evidence'],path)
        observed=equal(field.get('observed'),value) and 'observed' in field
        status=None
        if mode=='check':
            status=support if support in ('unknown','ambiguous') else ('unavailable' if path not in (candidate or {}) else 'match' if equal(candidate[path],value) else 'contradiction')
        passed=observed and field.get('support')==support and valid and (status is None or field.get('status')==status)
        checks.append({'path':path,'passed':passed,'expected_support':support,'expected_status':status,
                       'observation_correct':observed,'evidence_correct':valid})
    issue=document.get('arithmetic_issue')
    if not issue and isinstance(answer.get('arithmetic'),dict) and answer['arithmetic'].get('discrepancy') is True:errors.append('false-arithmetic-conflict')
    if issue:
        arithmetic=answer.get('arithmetic')
        if not isinstance(arithmetic,dict) or not equal(arithmetic.get('printed_total'),issue['printed_total']) or not equal(arithmetic.get('components_sum'),issue['components_sum']) or arithmetic.get('discrepancy') is not True:
            errors.append('unresolved-arithmetic-conflict')
    return {'passed':not errors and all(x['passed'] for x in checks),'errors':errors,'fields':checks,
            'correct_fields':sum(x['passed'] for x in checks),'field_count':len(checks)}


def transport_gate(adapter,controls,model,variant,image_count,exit_code,terminal):
    """Count actual attachment events; never synthesize page transport proof."""
    if adapter=='hermes-native-json':
        pre=[x for x in controls if x.get('event')=='pre'];post=[x for x in controls if x.get('event')=='post']
        checks={'one_request':len(pre)==1,'one_response':len(post)==1,
                'model':len(pre)==len(post)==1 and all(x.get('model')==model for x in pre+post),
                'context':len(post)==1 and post[0].get('context_length')==variant['context_window'],
                'no_tools':len(pre)==len(post)==1 and pre[0].get('tool_count')==0 and pre[0].get('tools_in_payload')==0 and post[0].get('assistant_tool_call_count')==0,
                'no_fallback':not any(x.get('event') in ('auxiliary','api_error') for x in controls),
                'normal_stop':len(post)==1 and post[0].get('finish_reason')=='stop'}
    else:
        pre=controls
        checks={'one_request':len(pre)==1,'model':len(pre)==1 and pre[0].get('model')==model,
                'no_tools':len(pre)==1 and pre[0].get('tools_in_payload')==0 and not any(x.get('type')=='toolCall' for x in terminal.get('content',[])),
                'normal_stop':terminal.get('stopReason')=='stop'}
    checks.update({'images':len(pre)==1 and pre[0].get('image_count')==image_count,
                   'thinking':len(pre)==1 and pre[0].get('enable_thinking') is False,
                   'output_cap':len(pre)==1 and pre[0].get('max_tokens')==variant['output_tokens'],
                   'sampling':len(pre)==1 and all(pre[0].get(k)==v for k,v in variant['sampling'].items()),
                   'exit':exit_code==0})
    checks['passed']=all(checks.values());return checks
