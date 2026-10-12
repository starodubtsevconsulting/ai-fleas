import unittest
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('runner', Path(__file__).with_name('run-pi.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
from verify import compare_fields, compare_totals, totals

class EvidenceTests(unittest.TestCase):
    def row(self, doc='a', tx='one', amount=100, currency='CAD', day='2026-04-03', status='settled'):
        return {'document':doc,'actual':{'transaction_id':tx,'tax_type':'GST','amount':amount,'currency':currency,'date':day,'status':status}}
    def test_exact_field_check_and_missing_currency(self):
        row = self.row()['actual']
        self.assertTrue(compare_fields(row,row)['passed'])
        self.assertFalse(compare_fields({**row,'currency':None},row)['passed'])
        self.assertFalse(compare_fields({**row,'status':'scheduled'},row)['passed'])
    def test_status_duplicate_currency_and_period(self):
        rows=[self.row(),self.row('b'),self.row('c','two',200,status='scheduled'),self.row('d','three',30,currency=None),self.row('e','four',25,'USD','2026-05-02'),self.row('f','five',20,status='refunded')]
        week=totals(rows,'2026-04-01','2026-04-07')
        self.assertEqual(week['included_documents'],['a','f'])
        self.assertEqual(week['currency_totals']['CAD'],{'gross':100.,'refunds':20.,'net':80.})
        self.assertEqual(week['excluded_documents'],{'b':'duplicate','c':'not_settled','d':'unknown_currency','e':'outside_period'})
        quarter=totals(rows,'2026-04-01','2026-06-30')
        self.assertEqual(quarter['currency_totals']['USD']['net'],25)
        self.assertTrue(compare_totals(week,week)['passed'])
        self.assertFalse(compare_totals(quarter,week)['passed'])
    def test_malformed_aggregate_schema_fails_without_crashing(self):
        good=totals([self.row()],'2026-04-01','2026-04-07')
        bad=[('included_documents',None),('included_documents',['a',3]),
             ('excluded_documents',None),('excluded_documents',[{}]),
             ('excluded_documents',{'b':None}),('currency_totals',[]),
             ('currency_totals',{'CAD':None}),
             ('currency_totals',{'CAD':{'gross':'100','refunds':0,'net':100}})]
        for key,value in bad:
            with self.subTest(key=key,value=value):
                self.assertFalse(compare_totals({**good,key:value},good)['passed'])

    def test_transport_requires_actual_image_and_normal_exit(self):
        event = {'exit_code':0,'stop_reason':'stop','actual':{},'outbound_controls':[{'enable_thinking':False,'image_count':1}]}
        self.assertTrue(runner.transport_check(event,1)['passed'])
        self.assertFalse(runner.transport_check({**event,'exit_code':124},1)['passed'])
        self.assertFalse(runner.transport_check(event,0)['passed'])
        self.assertFalse(runner.transport_check({**event,'outbound_controls':[]},1)['passed'])

    def test_invalid_precision_and_dates(self):
        result=totals([self.row(amount=1.001),self.row('b','two',day=None)],'2026-04-01','2026-06-30')
        self.assertEqual(result['included_documents'],[])
        self.assertEqual(result['excluded_documents'],{'a':'invalid_amount','b':'missing_date'})

if __name__ == '__main__': unittest.main()
