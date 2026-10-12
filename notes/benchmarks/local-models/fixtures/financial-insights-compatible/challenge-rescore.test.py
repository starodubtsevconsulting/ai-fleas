import importlib.util
from pathlib import Path
import unittest
import copy
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rescore',HERE/'challenge-rescore.py');rescore=importlib.util.module_from_spec(spec);spec.loader.exec_module(rescore)
class Tests(unittest.TestCase):
 def reference(self):return {'documents':[{'id':str(i),'expected':{'obligationLifecycle.providerStatus':'to-be-processed'},'field_provenance':{'obligationLifecycle.providerStatus':{'value':'to-be-processed','expected_support':'inferred','source_pages':[1]}}} for i in range(3)]}
 def amended(self,old):
  new=copy.deepcopy(old);new['reference_revision']=2
  for d in new['documents']:d['field_provenance']['obligationLifecycle.providerStatus']['expected_support']='printed'
  return new
 def test_exact_three_support_changes(self):
  old=self.reference();self.assertEqual(len(rescore.validate_correction(old,self.amended(old))),3)
 def test_value_change_rejected(self):
  old=self.reference();new=self.amended(old);new['documents'][0]['expected']['obligationLifecycle.providerStatus']='completed'
  with self.assertRaises(ValueError):rescore.validate_correction(old,new)
 def test_page_change_rejected(self):
  old=self.reference();new=self.amended(old);new['documents'][0]['field_provenance']['obligationLifecycle.providerStatus']['source_pages']=[2]
  with self.assertRaises(ValueError):rescore.validate_correction(old,new)
 def test_unlabelled_revision_rejected(self):
  old=self.reference();new=self.amended(old);new.pop('reference_revision')
  with self.assertRaises(ValueError):rescore.validate_correction(old,new)
if __name__=='__main__':unittest.main()
