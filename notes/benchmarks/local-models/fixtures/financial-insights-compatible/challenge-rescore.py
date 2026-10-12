#!/usr/bin/env python3
"""Labelled reference-only amendment; never changes captured model observations."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[4]
spec=importlib.util.spec_from_file_location('challenge_verify',HERE/'challenge-verify.py');cv=importlib.util.module_from_spec(spec);spec.loader.exec_module(cv)
DATA=REPO/'ai-profile/example/data/financial-insights-challenges'
PUBLIC=REPO/'models/qwen3.8-flash-next/benchmarks/gx10'
OLD_COMMIT='4e2eb0fec907e772722228b7c8435431b96b7635'
RECORDS=('financial-insights-challenges-hermes-2026-10-12.json','financial-insights-challenges-pi-2026-10-12.json','financial-insights-challenge-hermes-multipage-pilot-attempt2-2026-10-12.json','financial-insights-challenge-pi-multipage-pilot-2026-10-12.json')
FAILED='financial-insights-challenge-hermes-multipage-pilot-2026-10-12.json'


def digest(raw):return hashlib.sha256(raw).hexdigest()


def validate_correction(old,new):
    normalized=copy.deepcopy(new)
    revision=normalized.pop('reference_revision',None)
    if revision!=2:raise ValueError('explicit reference revision 2 required')
    original=copy.deepcopy(old);original.pop('reference_revision',None)
    changes=[]
    for doc in normalized['documents']:
        if 'obligationLifecycle.providerStatus' not in doc['field_provenance']:continue
        proof=doc['field_provenance']['obligationLifecycle.providerStatus']
        if proof['expected_support']!='printed':raise ValueError('provider support must be printed')
        proof['expected_support']='inferred'
        changes.append({'document':doc['id'],'path':'obligationLifecycle.providerStatus','old_support':'inferred','new_support':'printed'})
    if len(changes)!=3 or normalized!=original:raise ValueError('reference amendment changes more than three support annotations/revision metadata')
    return changes


def counts(rows):
    return {'count':len(rows),'raw_observations_correct':sum(x['observation_correct'] for x in rows),'strict_fields_correct':sum(x['passed'] for x in rows)}


def aggregate(observations,documents):
    result={}
    for mode in ('extract','check'):
        observations_mode=[o for o in observations if o['mode']==mode]
        rows=[f for o in observations_mode for f in o['verification']['fields']]
        financial=[f for f in rows if f['path']=='currency' or f['path'].startswith(('reportingPeriod.','dates.','amounts.'))]
        semantics=[f for f in rows if f not in financial]
        known=[];unknown=[];arithmetic=[]
        for o in observations_mode:
            doc=documents[o['document']]
            for field in o['verification']['fields']:
                if field not in financial:continue
                _,support,_=cv.truth(doc,field['path'],o['page'])
                (unknown if support=='unknown' else known).append(field)
            arithmetic.append({'id':o['id'],'answer':(o.get('answer') or {}).get('arithmetic'),'errors':[x for x in o['verification']['errors'] if 'arithmetic' in x]})
        result[mode]={'requests':len(observations_mode),'all_fields':counts(rows),'financial_fields':counts(financial),'visible_known_financial':counts(known),'unknown_financial':counts(unknown),'canonical_semantic_fields':counts(semantics),'strict_requests_passed':sum(o['verification']['passed'] for o in observations_mode),'arithmetic':arithmetic}
    return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--results',required=True);args=parser.parse_args()
    output=Path(args.results).resolve()
    if not output.is_relative_to(PUBLIC) or output.exists():raise ValueError('fresh scoped public amendment result required')
    old_raw=subprocess.run(['git','show',OLD_COMMIT+':'+str(DATA.relative_to(REPO)/'expected.json')],cwd=REPO,text=False,capture_output=True,check=True).stdout
    new_raw=(DATA/'expected.json').read_bytes();old=json.loads(old_raw);new=json.loads(new_raw)
    changes=validate_correction(old,new)
    transcript_raw=(DATA/'transcripts.json').read_bytes();transcripts=json.loads(transcript_raw)
    source_transcripts={d['id']:{p['page']:p['visible_text'] for p in d['pages']} for d in transcripts['documents']}
    documents={d['id']:d for d in new['documents']}
    current_pdf_hashes={}
    for doc in new['documents']:
        relative=Path(doc['file']).relative_to(new['source_root'])
        source=(DATA/relative).resolve();source.relative_to(DATA.resolve())
        current_pdf_hashes[doc['id']]=digest(source.read_bytes())
        if current_pdf_hashes[doc['id']]!=doc['sha256']:raise ValueError('current PDF bytes differ from reference')
    records=[]
    for name in RECORDS:
        raw=(PUBLIC/name).read_bytes();record=json.loads(raw)
        if record['dataset_versions']['expected.json']!=digest(old_raw) or record['dataset_versions']['transcripts.json']!=digest(transcript_raw):raise ValueError('captured reference/transcript mismatch')
        if record['source_versions']['challenge-verify.py']!=digest((HERE/'challenge-verify.py').read_bytes()):raise ValueError('evaluator changed since captured run')
        if record.get('blocked_stage') or any(not o['transport_verification']['passed'] for o in record['observations']):raise ValueError('only valid transport records can be rescored')
        if any(current_pdf_hashes.get(doc)!=sha for doc,sha in record['source_sha256'].items()):raise ValueError('captured PDF hash differs from current source')
        candidates={m['document']:m['candidate'] for m in record['mechanical']}
        corrected=[]
        for o in record['observations']:
            verification=cv.score(documents[o['document']],source_transcripts[o['document']],o['answer'],o['mode'],o['page'],candidates.get(o['document']),o['transport_verification'])
            corrected.append({**o,'verification':verification})
        records.append({'source_record':name,'source_record_sha256':digest(raw),'original_execution_commit':record['execution_commit'],'original_evaluator_sha256':record['source_versions']['challenge-verify.py'],'original_summary':record['summary'],'corrected_summary':aggregate(corrected,documents),'corrected_verifications':[{'id':o['id'],'mode':o['mode'],'document':o['document'],'page':o['page'],'verification':o['verification']} for o in corrected],
                        'mechanical_outcomes':{'prepared':sum(m['status']=='prepared' for m in record['mechanical']),'review_required':sum(m['status']=='review-required' for m in record['mechanical']),'boundary':'review-required conflict is a safety outcome, not zero-value extraction accuracy'},'timing_unchanged':record['timing']})
        if (PUBLIC/name).read_bytes()!=raw:raise ValueError('captured record changed during rescore')
    failed=(PUBLIC/FAILED).read_bytes()
    result={'schema_version':1,'fictional':True,'kind':'reference-only-amendment','inference_started':False,'model_answers_changed':False,'original_records_overwritten':False,'old_reference_sha256':digest(old_raw),'new_reference_sha256':digest(new_raw),'reference_revision':2,'transcripts_sha256_unchanged':digest(transcript_raw),'verified_current_pdf_sha256':current_pdf_hashes,'changes':changes,'evaluator_sha256':digest((HERE/'challenge-verify.py').read_bytes()),'rescore_source_sha256':digest(Path(__file__).read_bytes()),'records':records,'excluded_transport_failure':{'source_record':FAILED,'sha256':digest(failed),'reason':'first native pilot supplied one of two pages; excluded from accuracy comparison'},'boundary':'Same captured answers and genuine transport observations; only three reference support annotations corrected. Numeric values, source PDFs, transcripts, prompt and evaluator unchanged.'}
    output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'records_rescored':len(records),'inference_started':False,'reference_revision':2}))

if __name__=='__main__':main()
