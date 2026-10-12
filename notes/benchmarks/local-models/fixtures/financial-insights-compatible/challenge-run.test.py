import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch,Mock
import argparse
import json
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('challenge_run',HERE/'challenge-run.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Tests(unittest.TestCase):
 def test_actual_data_plan_no_inference(self):
  cfg=runner.shared.REPO/'notes/benchmarks/local-models/runs/hermes-pi-comparison-2026-10-12/challenge-profiles.json'
  if not cfg.exists():self.skipTest('private configuration absent')
  for name in ('pi-fi-vision','hermes-fi-vision'):
   args=argparse.Namespace(profile_config=str(cfg),test_profile=name,variant=None,agent_dir=None,provider=None,model=None,harness_source=None,variants=None,data_root=None)
   with patch.object(runner.shared,'setup_pi',side_effect=AssertionError('inference forbidden')),patch.object(runner.shared,'live_profile_check',side_effect=AssertionError('probe forbidden')):
    _,_,data,_,_=runner.plan(args)
   self.assertEqual(len(data['documents']),5);self.assertEqual(sum(x['page_count'] for x in data['documents']),6)
 def test_native_two_page_argv_and_count(self):
  # argv construction is reviewed separately; scoring cannot turn a single payload into two.
  controls=[{'image_count':1,'model':'m','enable_thinking':False,'max_tokens':2048,'temperature':0,'top_p':1}]
  gate=runner.verifier.transport_gate('pi-print-json',controls,'m',{'output_tokens':2048,'sampling':{'temperature':0,'top_p':1}},2,0,{'stopReason':'stop','content':[]})
  self.assertFalse(gate['passed'])
 def test_timeout_kills_only_own_group(self):
  import subprocess,signal
  process=Mock(pid=12345);process.communicate.side_effect=[subprocess.TimeoutExpired(['test'],1),('partial','error')]
  with patch.object(runner.subprocess,'Popen',return_value=process),patch.object(runner.os,'killpg') as kill:
   code,_,_,_=runner.invoke(['test'],HERE,None,1)
  self.assertEqual(code,124);kill.assert_called_once_with(12345,signal.SIGTERM)
 def test_output_json_non_object(self):
  self.assertEqual(runner.observations('[]\nnull\n{"event":"pre"}\nnoise'),[{'event':'pre'}])
if __name__=='__main__':unittest.main()
