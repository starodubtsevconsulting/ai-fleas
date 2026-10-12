#!/usr/bin/env python3
"""Generate public fictional supported payroll forms and evaluator-only facts."""
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
HERE = Path(__file__).resolve().parent
REL = 'data/corporate/reports/2026/example-consulting/q4/incoming/unprocessed'
COMMON = {'reportingPeriod.end':'2026-09-30','currency':'CAD'}
CASES = [
 ('federal-confirmation','Federal Payroll Deductions EMPTX PD7A submission confirmation',[
  ('Business','Example Consulting (fictional)'), ('Provider status','To be processed'),
  ('Confirmation Number','FICTIONAL-FED-001'), ('Confirmation date','2026-10-03'),
  ('Date payment made to employees','2026 Sep'), ('Due Date','2026-10-15'),
  ('Payment Date','2026-10-11'), ('Gross payroll','24,680.50'),
  ('Number of employees','7'), ('Amount payable','2,345.67'), ('Currency','CAD')],
  {**COMMON,'documentRole':'submission-confirmation','jurisdiction':'ca-federal',
   'dates.submissionDate':'2026-10-03','dates.dueDate':'2026-10-15',
   'dates.scheduledExecutionDate':'2026-10-11','amounts.components.grossPayroll':24680.50,
   'amounts.components.employeeCount':7,'amounts.arithmetic.total':2345.67,
   'obligationLifecycle.state':'scheduled','obligationLifecycle.settlement':'pending',
   'obligationLifecycle.providerStatus':'to-be-processed'}),
 ('quebec-confirmation','Revenu Quebec payment submission confirmation',[
  ('Business','Example Consulting (fictional)'), ('Provider status','To be processed'),
  ('Confirmation reference','FICTIONAL-QC-001'), ('Reporting period end','2026-09-30'),
  ('Confirmation date','2026-10-04'), ('Scheduled execution','2026-10-12'),
  ('Payment total','2,369.24'), ('Currency','CAD')],
  {**COMMON,'documentRole':'submission-confirmation','jurisdiction':'ca-qc',
   'dates.submissionDate':'2026-10-04','dates.scheduledExecutionDate':'2026-10-12',
   'amounts.arithmetic.total':2369.24,'obligationLifecycle.state':'scheduled',
   'obligationLifecycle.settlement':'pending','obligationLifecycle.providerStatus':'to-be-processed'}),
 ('quebec-obligation','Revenu Quebec payroll source deductions TPZ-1015',[
  ('Business','Example Consulting (fictional)'), ('Reporting period start','2026-07-01'),
  ('Reporting period end','2026-09-30'), ('Due date','2026-10-15'),
  ('Income tax','1,234.56'), ('QPP','789.01'), ('Health Services Fund','234.56'),
  ('QPIP','111.11'), ('CNESST','0.00'), ('Total remittance','2,369.24'), ('Currency','CAD')],
  {**COMMON,'documentRole':'obligation','jurisdiction':'ca-qc',
   'reportingPeriod.start':'2026-07-01','dates.dueDate':'2026-10-15',
   'amounts.components.incomeTax':1234.56,'amounts.components.qpp':789.01,
   'amounts.components.healthServicesFund':234.56,'amounts.components.qpip':111.11,
   'amounts.components.cnesst':0,'amounts.arithmetic.total':2369.24,
   'obligationLifecycle.state':'obligation-recorded','obligationLifecycle.settlement':'pending'})
]
def generate_skeleton():
 """Track canonical empty sections without inventing financial records."""
 corporate=HERE/'data/corporate'
 corporate.mkdir(parents=True,exist_ok=True)
 (corporate/'README.md').write_text('# Fictional corporate root\n\nThis fixture contains only the invented Example Consulting organization.\n`reports/2026/example-consulting/` holds the canonical accounting tree; the\nfinancial-records command receives `reports` as its root. No real organization\nrecords or operational configuration are present.\n')
 for quarter in ('q1','q2','q3','q4'):
  for section,description in (
   ('in','Incoming invoices and source documents'),
   ('out/taxes','Outgoing tax evidence; no tax summary or reviewed sidecar is supplied'),
   ('statements','Bank/account statement evidence')):
   target=corporate/'reports/2026/example-consulting'/quarter/section
   target.mkdir(parents=True,exist_ok=True)
   (target/'README.md').write_text('# Fictional empty section\n\n'+description+'.\nThis placeholder preserves the canonical folder in Git. No financial record is\npresent here, and this folder is not an executed benchmark case.\n')
 for jurisdiction in ('ca-federal','ca-qc'):
  target=corporate/'reports/2026/example-consulting/q4/out/taxes/payroll-remittances'/jurisdiction/'2026-09-30'
  target.mkdir(parents=True,exist_ok=True)
  (target/'README.md').write_text('# Proposed fictional payroll bundle\n\nThe benchmark asserts preparation destinations here. It does not publish\ncanonical PDFs or adjacent reviewed JSON sidecars. Originals remain in\n`q4/incoming/unprocessed`; human review and publication are still pending.\n')

def main():
 generate_skeleton()
 docs=[]
 for name,title,rows,facts in CASES:
  target=HERE/REL/(name+'.pdf'); target.parent.mkdir(parents=True,exist_ok=True)
  c=canvas.Canvas(str(target),pagesize=letter,invariant=1,pageCompression=1)
  c.setTitle('Fictional payroll form: '+name); c.setAuthor('Fictional benchmark fixture')
  c.setFillColor(colors.HexColor('#14344c'));c.rect(36,721,540,42,fill=1,stroke=0)
  c.setFillColor(colors.white);c.setFont('Helvetica-Bold',16);c.drawString(48,738,'FICTIONAL TEST FIXTURE')
  c.setFillColor(colors.black);c.setFont('Helvetica-Bold',11);c.drawString(48,699,title)
  c.setFont('Helvetica',9);c.drawString(48,677,'Canada / Quebec payroll remittance - synthetic provider form')
  for i,(label,value) in enumerate(rows):
   y=642-i*35;c.setStrokeColor(colors.HexColor('#cccccc'));c.line(48,y-10,562,y-10)
   c.setFont('Helvetica-Bold',10);c.drawString(48,y,label+':')
   c.setFont('Helvetica',11);c.drawString(295,y,value)
  c.setFont('Helvetica',9)
  if 'confirmation' in name:
   c.drawString(48,166,'Submission scheduling only. No completed or settled payment is evidenced.')
  else:c.drawString(48,166,'Obligation only. No submission or completed payment is evidenced.')
  c.drawString(48,126,'All names, references, dates and amounts are invented. Not a government form.')
  c.drawString(48,108,'For extraction tests only. Page 1 of 1');c.save()
  filename=(facts.get('dates.submissionDate') or '2026-09-30')+'_'+facts['jurisdiction']+'_payroll-remittance-'+facts['documentRole']+'.pdf'
  destination='2026/example-consulting/q4/out/taxes/payroll-remittances/'+facts['jurisdiction']+'/2026-09-30'
  (HERE/'data/corporate/reports'/destination).mkdir(parents=True,exist_ok=True)
  docs.append({'id':name,'file':REL+'/'+name+'.pdf','page':1,'expected':facts,
               'destination':destination,'filename':filename,'sidecar':filename+'.json'})
 (HERE/'expected.json').write_text(json.dumps({'schema_version':1,'fixture_layout_revision':2,'fictional':True,'documents':docs},indent=2)+'\n')
if __name__=='__main__':main()
