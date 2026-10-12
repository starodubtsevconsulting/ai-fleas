import copy
import unittest
from verify import compare_vision, compare_mechanical, parse_answer
from run import validate_variant, hermes_module, validate_live_props, probe_headers, select_test_profile, NoProbeRedirect, live_profile_check, load_dataset
DOC={'expected':{'amount':12.34,'currency':'CAD'},'destination':'target','filename':'x.pdf','sidecar':'x.pdf.json'}
TEXT='Amount payable: 12.34 Currency CAD'
def answer(status='match',amount=12.34):return {'fields':[{'field':'amount','status':status,'observed':amount,'evidence':{'page':1,'quote':'12.34'}},{'field':'currency','status':'match','observed':'CAD','evidence':{'page':1,'quote':'Currency CAD'}}]}
class Verification(unittest.TestCase):
 def test_correct(self):self.assertTrue(compare_vision(answer(),{'amount':12.34,'currency':'CAD'},DOC,TEXT)['passed'])
 def test_detect_tamper(self):self.assertEqual(compare_vision(answer('contradiction'),{'amount':99,'currency':'CAD'},DOC,TEXT)['contradictions_detected'],1)
 def test_false_accept(self):self.assertEqual(compare_vision(answer(),{'amount':99,'currency':'CAD'},DOC,TEXT)['false_accepts'],1)
 def test_false_reject(self):self.assertEqual(compare_vision(answer('contradiction'),{'amount':12.34,'currency':'CAD'},DOC,TEXT)['false_rejects'],1)
 def test_bad_quote(self):self.assertFalse(compare_vision(answer(),{'amount':12.34,'currency':'CAD'},DOC,'unrelated')['passed'])
 def test_shapes(self):
  for value in (None,{},[],{'fields':[None]},{'fields':'wrong'}):self.assertFalse(compare_vision(value,{},DOC,TEXT)['passed'])
 def test_duplicate(self):
  a=answer();a['fields'].append(copy.deepcopy(a['fields'][0]));self.assertFalse(compare_vision(a,{'amount':12.34,'currency':'CAD'},DOC,TEXT)['passed'])
 def test_omission(self):self.assertEqual(compare_vision({'fields':[]},{},DOC,TEXT)['omissions'],2)
 def test_nonfinite_bool(self):
  for value in (True,float('nan'),float('inf')):self.assertFalse(compare_vision(answer(amount=value),{'amount':12.34,'currency':'CAD'},DOC,TEXT)['passed'])
 def test_unknown(self):
  a=answer('unknown',None);self.assertEqual(compare_vision(a,{'amount':99,'currency':'CAD'},DOC,TEXT)['unknowns'],1)
 def test_wrong_page(self):
  a=answer();a['fields'][0]['evidence']['page']=2;self.assertFalse(compare_vision(a,{'amount':12.34,'currency':'CAD'},DOC,TEXT)['passed'])
 def test_mechanical_naming(self):
  a={'status':'prepared','extraction':{'amount':12.34,'currency':'CAD'},'proposedDestination':'target','proposedFilename':'x.pdf','proposedSidecarFilename':'x.pdf.json'}
  self.assertTrue(compare_mechanical(a,DOC)['passed']);a['proposedDestination']='wrong';self.assertFalse(compare_mechanical(a,DOC)['passed'])
 def test_short_printed_quote(self):
  a=answer();a['fields'][1]['evidence']['quote']='CAD';self.assertTrue(compare_vision(a,{'amount':12.34,'currency':'CAD'},DOC,TEXT)['passed'])
 def test_substring_not_quote(self):
  a=answer();a['fields'][0]['evidence']['quote']='2';self.assertFalse(compare_vision(a,{'amount':12.34,'currency':'CAD'},DOC,TEXT)['passed'])
 def test_provider_literal_enum(self):
  doc={'expected':{'obligationLifecycle.providerStatus':'to-be-processed'}};candidate={'obligationLifecycle':{'providerStatus':'completed'}}
  a={'fields':[{'field':'obligationLifecycle.providerStatus','status':'contradiction','observed':'To be processed','evidence':{'page':1,'quote':'To be processed'}}]}
  self.assertTrue(compare_vision(a,candidate,doc,'Provider status: To be processed')['passed'])
 def test_named_variants(self):
  variant={"adapter":"pi-print-json","supported":True,"context_window":8192,"output_tokens":2048,"thinking":"off","server_enable_thinking":False}
  for name in ("pi-json-aware","alternate-model-pi"):
   self.assertEqual(validate_variant(dict(variant,name=name))["adapter"],"pi-print-json")
 def test_variant_budget(self):
  variant={"adapter":"pi-print-json","context_window":8192,"output_tokens":0,"thinking":"off","server_enable_thinking":False}
  with self.assertRaises(ValueError):validate_variant(variant)
 def test_unknown_adapter(self):self.assertFalse(validate_variant({"adapter":"fictional-harness","supported":True})["supported"])
 def test_hermes_config_isolation(self):
  h=hermes_module();c=h.private_configuration({'model':'fictional-qwen','api':'openai-completions','base_url':'http://fictional.invalid','context_window':65536,'output_tokens':2048,'sampling':{'temperature':0,'top_p':1}})
  self.assertEqual(c['platform_toolsets']['cli'],[]);self.assertEqual(c['fallback_model'],[]);self.assertEqual(c['mcp_servers'],{})
  self.assertEqual(c['agent']['image_input_mode'],'native');self.assertEqual(c['plugins']['enabled'],['benchmark-observer'])
  body=c['providers']['benchmark-native']['extra_body'];self.assertFalse(body['chat_template_kwargs']['enable_thinking']);self.assertEqual(body['max_tokens'],2048)
 def test_hermes_transport_failures(self):
  h=hermes_module();pre={'event':'pre','model':'same-model','image_count':1,'tool_count':0,'tools_in_payload':0,'enable_thinking':False,'max_tokens':2048,'temperature':0,'top_p':1}
  post={'event':'post','model':'same-model','context_length':65536,'assistant_tool_call_count':0,'finish_reason':'stop'}
  controls=[pre,post];self.assertTrue(h.transport_verification(controls,'same-model',65536,2048,{'temperature':0,'top_p':1})['passed'])
  for bad in ({'image_count':0},{'model':'other'},{'tool_count':1},{'enable_thinking':True},{'max_tokens':4096},{'temperature':0.5}):
   self.assertFalse(h.transport_verification([{**pre,**bad},post],'same-model',65536,2048,{'temperature':0,'top_p':1})['passed'])
  for event in ({'event':'auxiliary'},{'event':'api_error'}):self.assertFalse(h.transport_verification(controls+[event],'same-model',65536,2048,{'temperature':0,'top_p':1})['passed'])
  self.assertFalse(h.transport_verification([],'same-model',65536,2048,{})['passed'])
 def test_hermes_no_inherited_credentials(self):
  import os
  from unittest.mock import patch
  from pathlib import Path
  with patch.dict(os.environ,{'OPENROUTER_API_KEY':'test-secret','HERMES_PROFILE':'operational'}):
   env=hermes_module().isolated_environment(Path('/fictional/run/home'),Path('/fictional/source'),Path('/fictional/log'))
   self.assertNotIn('OPENROUTER_API_KEY',env);self.assertNotIn('HERMES_PROFILE',env)
   self.assertEqual(env['HERMES_HOME'],'/fictional/run/home')
 def test_correct_answer_bad_transport_not_pass(self):
  scoring=compare_vision(answer(),{'amount':12.34,'currency':'CAD'},DOC,TEXT)
  bad=hermes_module().transport_verification([],'same-model',65536,2048,{})
  scoring['passed'] &= bad['passed'];self.assertFalse(scoring['passed'])
 def test_hermes_version_privacy(self):
  stdout="Update available\nHermes Agent v0.21.5+7438.gf102b16 (2026.9.24) · upstream f102b16c\nInstall directory: /Users/private/.hermes\nPython: 3.11.14\n"
  value=hermes_module().public_version_line(stdout);self.assertTrue(value.startswith('Hermes Agent v0.21.5'));self.assertNotIn('/Users/',value);self.assertNotIn('Install',value)
  with self.assertRaises(ValueError):hermes_module().public_version_line('Install directory: /Users/private')
 def test_live_props(self):
  props={'model_alias':'same-model','default_generation_settings':{'n_ctx':65536},'modalities':{'vision':True,'audio':False}}
  self.assertTrue(validate_live_props(props,'same-model',65536)['verified'])
  for bad in ({'model_alias':'other'},{'default_generation_settings':{'n_ctx':8192}},{'modalities':{}},{'modalities':{'vision':False}},{'modalities':{'vision':'true'}}):
   with self.assertRaises(ValueError):validate_live_props({**props,**bad},'same-model',65536)
 def test_probe_url_scope(self):
  provider={'baseUrl':'https://fictional.invalid:8000/v1','apiKey':'secret','headers':{'X-Test':'private'}}
  self.assertEqual(probe_headers('https://fictional.invalid:8002/props',provider)['Authorization'],'Bearer secret')
  for url in ('https://elsewhere.invalid/props','http://fictional.invalid/props','https://user@fictional.invalid/props','https://fictional.invalid/v1/props','https://fictional.invalid/props?x=1','https://fictional.invalid/props#x'):
   with self.assertRaises(ValueError):probe_headers(url,provider)
  with self.assertRaises(ValueError):probe_headers('https://fictional.invalid/props',{**provider,'headers':{'X-Test':1}})
  with self.assertRaises(ValueError):NoProbeRedirect().redirect_request(None,None,302,'',{},'https://elsewhere.invalid/props')
 def test_profile_strict_fields_and_paths(self):
  from argparse import Namespace
  from unittest.mock import patch
  from pathlib import Path
  profile={'variant':'pi-matched-64k','agent_dir':'transport','provider':'fictional-provider','model':'same-model','server_props_url':'https://fictional.invalid/props'}
  config={'schema_version':1,'profiles':{'pi-fi-vision':profile}}
  args=Namespace(variant=None,agent_dir=None,provider=None,model=None,variants=None,harness_source=None)
  with patch.object(Path,'read_text',return_value=__import__('json').dumps(config)):
   resolved=select_test_profile(args,'/fictional/profiles.json','pi-fi-vision');self.assertEqual(resolved['agent_dir'],'/fictional/transport')
  for bad in ({**profile,'extra':'wrong'},{**profile,'provider':3}):
   with patch.object(Path,'read_text',return_value=__import__('json').dumps({'schema_version':1,'profiles':{'pi-fi-vision':bad}})):
    with self.assertRaises(ValueError):select_test_profile(args,'/fictional/profiles.json','pi-fi-vision')
  args.model='conflicting-model'
  with patch.object(Path,'read_text',return_value=__import__('json').dumps(config)):
   with self.assertRaises(ValueError):select_test_profile(args,'/fictional/profiles.json','pi-fi-vision')
  with patch.object(Path,'read_text',return_value='not JSON'):
   with self.assertRaises(ValueError):select_test_profile(args,'/fictional/profiles.json','pi-fi-vision')
 def test_live_probe_status_and_json(self):
  import json
  from pathlib import Path
  from unittest.mock import patch,MagicMock
  provider={'baseUrl':'https://fictional.invalid/v1','models':[{'id':'same-model','contextWindow':65536,'maxTokens':2048,'input':['text','image']}]}
  catalog={'providers':{'fixture':provider}}
  profile={'agent_dir':'/fictional/transport','provider':'fixture','model':'same-model','server_props_url':'https://fictional.invalid/props'}
  variant={'adapter':'pi-print-json','context_window':65536,'output_tokens':2048}
  for status,body in ((401,b'{}'),(200,b'invalid JSON'),(200,b'x'*262145)):
   response=MagicMock();response.status=status;response.read.return_value=body
   opener=MagicMock();opener.open.return_value.__enter__.return_value=response
   with patch.object(Path,'read_text',return_value=json.dumps(catalog)),patch('run.urllib.request.build_opener',return_value=opener):
    with self.assertRaises(ValueError):live_profile_check(profile,variant)
   self.assertEqual(opener.open.call_args.kwargs['timeout'],5)
 def test_fictional_only_data_guard(self):
  import json
  from pathlib import Path
  from unittest.mock import patch
  reference={'fictional':False,'source_root':'sample','documents':[]}
  with patch.object(Path,'read_text',return_value=json.dumps(reference)),patch.object(Path,'is_symlink',return_value=False):
   with self.assertRaises(ValueError):load_dataset(Path('/fictional/data'))
 def test_data_escape_and_unlisted_records(self):
  import json
  from pathlib import Path
  from unittest.mock import patch
  reference={'fictional':True,'source_root':'sample','documents':[{'file':'sample/corporate/reports/a.pdf'}]}
  with patch.object(Path,'read_text',return_value=json.dumps(reference)),patch.object(Path,'is_symlink',return_value=False),patch.object(Path,'is_file',return_value=True),patch.object(Path,'rglob',return_value=iter([Path('/fictional/data/corporate/reports/unlisted.pdf')])):
   with self.assertRaises(ValueError):load_dataset(Path('/fictional/data'))
  reference['documents'][0]['file']='sample/corporate/reports/../outside.pdf'
  with patch.object(Path,'read_text',return_value=json.dumps(reference)),patch.object(Path,'is_symlink',return_value=False):
   with self.assertRaises(ValueError):load_dataset(Path('/fictional/data'))
 def test_parse(self):
  self.assertEqual(parse_answer('```json\n{}\n```'),{})
  with self.assertRaises(ValueError):parse_answer('[]')
if __name__=='__main__':unittest.main()
