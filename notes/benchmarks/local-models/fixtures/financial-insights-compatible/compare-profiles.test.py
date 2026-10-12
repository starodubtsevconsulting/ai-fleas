import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch,MagicMock
spec=importlib.util.spec_from_file_location('comparison',Path(__file__).with_name('compare-profiles.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class Comparison(unittest.TestCase):
 def test_alternating_five_pairs(self):
  self.assertEqual(c.ordered_arms(5),[(1,'a'),(1,'b'),(2,'b'),(2,'a'),(3,'a'),(3,'b'),(4,'b'),(4,'a'),(5,'a'),(5,'b')])
 def test_paired_case_identity(self):
  events=[{'id':str(i),'prompt_sha256':'a'*64,'image_sha256':'b'*64,'image_bytes':20} for i in range(7)]
  signature=c.case_signature({'vision':events});self.assertEqual(len(signature),7)
  with self.assertRaises(ValueError):c.case_signature({'vision':events[:6]})
  events[-1]['id']='0'
  with self.assertRaises(ValueError):c.case_signature({'vision':events})
 def test_statistics(self):
  stats=c.spread([1,2,3,4,5]);self.assertEqual(stats['median'],3);self.assertEqual(stats['quartiles'],[2,3,4]);self.assertEqual(stats['min'],1)
  self.assertIsNone(c.spread([1,2])['quartiles']);self.assertEqual(c.spread([None])['count'],0)
 def test_no_missing_metrics_as_zero(self):
  self.assertIsNone(c.known_sum([1,None]));self.assertIsNone(c.known_sum([]));self.assertEqual(c.known_sum([0,0]),0)
 def test_mismatched_profiles(self):
  profile={'private_transport':{},'quality':{'model':'same'},'pdfs':{'a':'hash'},'reference_facts_sha256':'r','expected_source_sha256':'e','generator_sha256':'g'}
  bad=copy.deepcopy(profile);bad['quality']['model']='other'
  with patch.object(c,'read_profile',side_effect=[profile,bad]):
   with self.assertRaises(ValueError):c.comparison_plan('private.json',['a','b'],5)
 def test_transport_failure_stops(self):
  profile={'profile':{'variant':'test'},'variant':{'adapter':'test-adapter','platform':'test-platform','harness':'test-harness'},'pdfs':{},'quality':{'context_window':65536},'expected_source_sha256':'e','generator_sha256':'g','variant_manifest_sha256':'v'}
  self.assertEqual(c.assess_arm({'vision':[{'transport_verification':{'passed':False}}]*7},0,profile,{}),'transport-failure')
  self.assertEqual(c.assess_arm(None,124,profile,{}),'verification-infrastructure-failure')
 def test_accuracy_failure_is_not_transport_failure(self):
  profile={'profile':{'variant':'test'},'variant':{'adapter':'test-adapter','platform':'test-platform','harness':'test-harness'},'pdfs':{},'quality':{'context_window':65536},'expected_source_sha256':'e','generator_sha256':'g','variant_manifest_sha256':'v'}
  record={'vision':[{'transport_verification':{'passed':True},'verification':{'passed':False}}]*7,'source_sha256':{},'source_versions':{'selected-profile-data/expected.json':'e','selected-profile-data/generate.py':'g'},'variant':'test','configuration':{'context_window':65536,'adapter':'test-adapter','platform':'test-platform','harness':'test-harness'},'runtime_context_evidence':{'verified':True,'native_image':True,'context_window':65536},'variant_manifest_sha256':'v','summary':{'vision_passed':0}}
  self.assertIsNone(c.assess_arm(record,0,profile,{}))
  record['configuration']['harness']='another-harness'
  self.assertEqual(c.assess_arm(record,0,profile,{}),'harness-or-variant-mismatch')
 def test_source_drift(self):
  profile={'pdfs':{'document':'same'}}
  record={'vision':[{'transport_verification':{'passed':True}}]*7,'source_sha256':{'document':'changed'}}
  self.assertEqual(c.assess_arm(record,0,profile,{}),'source-changed')
 def test_privacy_rejection(self):
  for secret in ('/Users/person/private','http://host/props','api_key','10.2.3.4'):
   with self.assertRaises(ValueError):c.privacy_check({'value':secret})
  c.privacy_check({'model':'fictional-model','harness':'Hermes'})
 def test_cleanup_only_owned_group(self):
  process=MagicMock();process.pid=321
  with patch.object(c.os,'killpg') as kill:c.terminate_owned_group(process)
  self.assertEqual([x.args[0] for x in kill.call_args_list],[321,321]);self.assertEqual(process.wait.call_count,2)
 def test_pair_differences_and_failure_counts(self):
  def arm(label,seconds):return {'pair':1,'profile':label,'failure':None,'metrics':{'timing':{'total_wall_seconds':seconds,'vision_seconds':seconds-1},'summary':{'vision_passed':7},'usage':{'input':10,'output':20,'cacheRead':0,'cacheWrite':0},'output_lengths':[{'output_chars':100}]}}
  data=c.summarize([arm('a',10),arm('b',15)])
  self.assertEqual(data['paired_observations'][0]['b_minus_a_seconds'],5);self.assertEqual(data['paired_observations'][0]['b_over_a_ratio'],1.5)
  self.assertEqual(data['profiles']['a']['valid_transport_arms'],1)
if __name__=='__main__':unittest.main()
