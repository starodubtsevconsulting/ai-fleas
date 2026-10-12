"""Independent evaluator; never imports model candidate values as truth."""
import json
import math
import re

def parse_answer(text):
    value=text.strip()
    if value.startswith('```'):
        value=re.sub(r'^```(?:json)?\s*','',value);value=re.sub(r'\s*```$','',value)
    result=json.loads(value)
    if not isinstance(result,dict):raise ValueError('answer must be an object')
    return result

def get_path(value,path):
    for part in path.split('.'):
        if not isinstance(value,dict) or part not in value:return None
        value=value[part]
    return value

def set_path(value,path,replacement):
    parts=path.split('.')
    for part in parts[:-1]:value=value.setdefault(part,{})
    value[parts[-1]]=replacement

def equal(left,right):
    if isinstance(right,(int,float)) and not isinstance(right,bool):
        return isinstance(left,(int,float)) and not isinstance(left,bool) and math.isfinite(left) and abs(left-right)<0.005
    return type(left) is type(right) and left==right

def compare_mechanical(proposal,doc):
    extraction=proposal.get('extraction',{}) if isinstance(proposal,dict) else {}
    fields=[{'field':key,'expected':wanted,'actual':get_path(extraction,key),
             'passed':equal(get_path(extraction,key),wanted)} for key,wanted in doc['expected'].items()]
    naming=isinstance(proposal,dict) and all(proposal.get(k)==doc[d] for k,d in
        [('proposedDestination','destination'),('proposedFilename','filename'),('proposedSidecarFilename','sidecar')])
    prepared=isinstance(proposal,dict) and proposal.get('status')=='prepared'
    return {'passed':prepared and naming and all(x['passed'] for x in fields),'fields':fields,
            'field_count':len(fields),'field_matches':sum(x['passed'] for x in fields),'canonical_naming_passed':naming,
            'prepared':prepared,'human_review':'pending-not-published',
            'currency_provenance':'command assigns CAD from jurisdiction context; fixture independently prints CAD'}

def norm(text):return re.sub(r'\s+',' ',str(text).casefold()).strip()

def compare_vision(answer,candidate,doc,source_text):
    rows=answer.get('fields') if isinstance(answer,dict) else None
    schema_ok=isinstance(rows,list) and all(isinstance(x,dict) and isinstance(x.get('field'),str) for x in rows)
    indexed={};duplicates=set()
    if schema_ok:
        for row in rows:
            if row['field'] in indexed:duplicates.add(row['field'])
            indexed[row['field']]=row
    outcomes=[]
    for key,wanted in doc['expected'].items():
        proposed=get_path(candidate,key); wanted_status='match' if equal(proposed,wanted) else 'contradiction'
        row=indexed.get(key,{})
        status=row.get('status')
        evidence=row.get('evidence',{})
        quote=evidence.get('quote') if isinstance(evidence,dict) else None
        evidence_ok=(isinstance(evidence,dict) and evidence.get('page')==1 and
                     isinstance(quote,str) and bool(quote.strip()) and
                     re.search(r'(?<!\w)'+re.escape(norm(quote))+r'(?!\w)',norm(source_text)) is not None)
        observed=row.get('observed')
        if key=='obligationLifecycle.providerStatus' and isinstance(observed,str):
            observed=re.sub(r'[\s_]+','-',observed.strip().casefold())
        observed_ok=equal(observed,wanted)
        passed=key not in duplicates and status==wanted_status and observed_ok and evidence_ok
        outcomes.append({'field':key,'expected_status':wanted_status,'status':status,'passed':passed,
                         'value_correct':observed_ok,'source_quote_verified':evidence_ok,
                         'false_accept':wanted_status=='contradiction' and status=='match',
                         'false_reject':wanted_status=='match' and status=='contradiction',
                         'omitted':key not in indexed,'unknown':status=='unknown'})
    extra=sorted(set(indexed)-set(doc['expected']))
    return {'passed':schema_ok and not extra and not duplicates and all(x['passed'] for x in outcomes),
            'schema_valid':schema_ok,'extra_fields':extra,'duplicate_fields':sorted(duplicates),
            'field_count':len(outcomes),'fields_passed':sum(x['passed'] for x in outcomes),
            'expected_matches':sum(x['expected_status']=='match' for x in outcomes),
            'expected_contradictions':sum(x['expected_status']=='contradiction' for x in outcomes),
            'contradictions_detected':sum(x['expected_status']=='contradiction' and x['passed'] for x in outcomes),
            'false_accepts':sum(x['false_accept'] for x in outcomes),'false_rejects':sum(x['false_reject'] for x in outcomes),
            'omissions':sum(x['omitted'] for x in outcomes),'unknowns':sum(x['unknown'] for x in outcomes),'fields':outcomes}
