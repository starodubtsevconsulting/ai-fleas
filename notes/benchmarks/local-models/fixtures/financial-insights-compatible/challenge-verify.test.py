import importlib.util
import unittest
from pathlib import Path
import copy
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cv',HERE/'challenge-verify.py');cv=importlib.util.module_from_spec(spec);spec.loader.exec_module(cv)
D={'page_count':2,'field_provenance':{'currency':{'value':'CAD','expected_support':'printed','source_pages':[2]},'amounts.arithmetic.total':{'value':2300,'expected_support':'ambiguous','source_pages':[2]}},'arithmetic_issue':{'printed_total':2300,'components_sum':2350}}
T={1:['Reporting period: 2026-09-30'],2:['Total: 2,300.00 Currency: CAD','Components: 1,200.00 + 800.00 + 250.00 + 100.00']}
A={'pages_seen':[1,2],'fields':[{'path':'currency','observed':'CAD','support':'printed','evidence':[{'page':2,'quote':'Currency: CAD'}]},{'path':'amounts.arithmetic.total','observed':2300,'support':'ambiguous','evidence':[{'page':2,'quote':'Total: 2,300.00'}]}],'arithmetic':{'printed_total':2300,'components_sum':2350,'discrepancy':True}}
V={'context_window':65536,'output_tokens':2048,'sampling':{'temperature':0,'top_p':1}}
C=[{'event':'pre','model':'m','image_count':2,'tool_count':0,'tools_in_payload':0,'enable_thinking':False,'max_tokens':2048,'temperature':0,'top_p':1},{'event':'post','model':'m','context_length':65536,'assistant_tool_call_count':0,'finish_reason':'stop'}]
class Tests(unittest.TestCase):
 def score(self,a,d=D,mode='extract',candidate=None):return cv.score(d,T,a,mode,candidate=candidate)['passed']
 def test_literal_conflict(self):self.assertTrue(self.score(A))
 def test_guessed_currency(self):
  d=copy.deepcopy(D);d['visual_assessment']={'currency':{'value':None,'expected_support':'unknown','source_pages':[2]}}
  self.assertFalse(self.score(A,d));a=copy.deepcopy(A);a['fields'][0].update(observed=None,support='unknown',evidence=[]);self.assertTrue(self.score(a,d))
 def test_wrong_quote(self):
  a=copy.deepcopy(A);a['fields'][0]['evidence'][0]['quote']='Currency: USD';self.assertFalse(self.score(a))
 def test_wrong_page(self):
  a=copy.deepcopy(A);a['fields'][0]['evidence'][0]['page']=1;self.assertFalse(self.score(a))
 def test_missing_coverage(self):
  a=copy.deepcopy(A);a['pages_seen']=[2];self.assertFalse(self.score(a))
 def test_duplicate_paths(self):
  a=copy.deepcopy(A);a['fields'].append(a['fields'][0]);self.assertFalse(self.score(a))
 def test_malformed(self):
  for a in (None,[],{'fields':'x'},{'fields':[None]},{'fields':[{'path':[]}]}):self.assertFalse(self.score(a))
 def test_bad_sum(self):
  a=copy.deepcopy(A);a['arithmetic']['components_sum']=2300;self.assertFalse(self.score(a))
 def test_correct_observation_wrong_evidence_value(self):
  a=copy.deepcopy(A);a['fields'][1]['evidence']=[{'page':2,'quote':'Currency: CAD'}];self.assertFalse(self.score(a))
 def test_missing_page_field_unknown(self):
  d=copy.deepcopy(D);d.pop('arithmetic_issue');a={'pages_seen':[1],'arithmetic':{'printed_total':None,'components_sum':None,'discrepancy':None},'fields':[{'path':p,'observed':None,'support':'unknown','evidence':[]} for p in d['field_provenance']]}
  self.assertTrue(cv.score(d,T,a,'extract',page=1)['passed'])
 def test_contextual_status(self):
  a=copy.deepcopy(A);a['fields'][0]['status']='contradiction';a['fields'][1]['status']='ambiguous';self.assertTrue(self.score(a,mode='check',candidate={'currency':'USD'}));a['fields'][0]['status']='match';self.assertFalse(self.score(a,mode='check',candidate={'currency':'USD'}))
 def test_real_two_images(self):self.assertTrue(cv.transport_gate('hermes-native-json',C,'m',V,2,0,{})['passed'])
 def test_missing_image(self):self.assertFalse(cv.transport_gate('hermes-native-json',C,'m',V,1,0,{})['passed'])
 def test_model_tools_thinking(self):
  for field,value in [('model','other'),('tool_count',1),('enable_thinking',True)]:
   c=copy.deepcopy(C);c[0][field]=value;self.assertFalse(cv.transport_gate('hermes-native-json',c,'m',V,2,0,{})['passed'])
 def test_fallback(self):self.assertFalse(cv.transport_gate('hermes-native-json',C+[{'event':'auxiliary'}],'m',V,2,0,{})['passed'])
if __name__=='__main__':unittest.main()
