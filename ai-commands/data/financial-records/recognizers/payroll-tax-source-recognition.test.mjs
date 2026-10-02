/**
 * Run: node ai-commands/data/financial-records/recognizers/payroll-tax-source-recognition.test.mjs
 * Passing verifies bounded classification, extraction, lifecycle, provenance, arithmetic, period, and naming proposals
 * for sanitized synthetic text. It does not verify real tax forms, publication, payment, or settlement.
 */
import assert from 'node:assert/strict';
import { PayrollTaxSourceRecognition } from './payroll-tax-source-recognition.mjs';

const recognizer = new PayrollTaxSourceRecognition();
const hash = 'a'.repeat(64);
const context = { branchId: 'example-branch', year: '2031', quarter: 'q3', section: 'out', sourceSha256: hash };
const pdf = (normalizedText, pageCount = 1) => ({ normalizedText, compactText: normalizedText.toLowerCase().replace(/[^a-z0-9]/g, ''), pageCount });

const federal = recognizer.evaluate(pdf([
  'Canada Revenue Agency PD7A payroll deductions', 'Remittance period end: 2031-06-30',
  'Gross payroll: 24,680.50', 'Number of employees: 7', 'Amount payable: 2,345.67', 'Page 1 of 3',
].join(' ')), context);
assert.equal(federal.status, 'review-required');
assert.equal(federal.reason, 'incomplete-pages');
assert.equal(federal.extraction.documentRole, 'obligation');
assert.equal(federal.extraction.jurisdiction, 'ca-federal');
assert.equal(federal.extraction.amounts.components.grossPayroll, 24680.50);
assert.equal(federal.extraction.amounts.components.employeeCount, 7);
assert.equal(federal.extraction.amounts.arithmetic.total, 2345.67);
assert.equal(federal.extraction.completeness.physicalPageCount, 1);
assert.equal(federal.extraction.completeness.expectedPageCount, 3);
assert.equal(federal.extraction.processing.state, 'incomplete');
assert.equal(federal.applyEligible, false);

const quebecText = [
  'Revenu Quebec payroll source deductions', 'Reporting period start: 2031-04-01',
  'Reporting period end: 2031-06-30', 'Due date: 2031-07-15', 'Income tax: 1,234.56',
  'QPP: 789.01', 'Health Services Fund: 234.56', 'QPIP: 111.11', 'CNESST: 0.00',
  'Total remittance: 2,369.24', 'Page 1 of 1',
].join(' ');
const quebec = recognizer.evaluate(pdf(quebecText), context);
assert.equal(quebec.status, 'prepared');
assert.equal(quebec.extraction.documentRole, 'obligation');
assert.equal(quebec.extraction.jurisdiction, 'ca-qc');
assert.equal(quebec.extraction.amounts.arithmetic.computedTotal, 2369.24);
assert.equal(quebec.extraction.amounts.arithmetic.matches, true);
assert.equal(quebec.proposedDestination,
  '2031/example-branch/q3/out/taxes/payroll-remittances/ca-qc/2031-06-30');
assert.equal(quebec.proposedFilename, '2031-06-30_ca-qc_payroll-remittance-obligation.pdf');
assert.equal(quebec.proposedSidecarFilename, `${quebec.proposedFilename}.json`);
assert.equal(quebec.extraction.processing.state, 'processing-pending');
assert.equal(quebec.extraction.obligationLifecycle.state, 'obligation-recorded');
assert.deepEqual(quebec.extraction.source, {
  sha256: hash, mediaType: 'application/pdf', textSource: 'provided-pdf-text',
});
assert.equal(quebec.extraction.provenance['amounts.components.qpp'].source, 'source-pdf-visible-content');

const confirmation = recognizer.evaluate(pdf([
  'Revenu Quebec payment submission confirmation', 'Provider status: To be processed',
  'Reporting period end: 2031-06-30', 'Confirmation date: 2031-07-03',
  'Scheduled execution: 2031-07-12', 'Payment total: 2,369.24', 'Page 1 of 1',
].join(' ')), context);
assert.equal(confirmation.status, 'prepared');
assert.equal(confirmation.extraction.documentRole, 'submission-confirmation');
assert.equal(confirmation.proposedFilename, '2031-07-03_ca-qc_payroll-remittance-submission-confirmation.pdf');
assert.equal(confirmation.extraction.obligationLifecycle.state, 'scheduled');
assert.equal(confirmation.extraction.obligationLifecycle.settlement, 'pending');
assert.equal(confirmation.extraction.relations[0].type, 'confirms-submission-of');
assert.doesNotMatch(JSON.stringify(confirmation), /paid|settled|account|identifier/i);

assert.equal(recognizer.evaluate(pdf(quebecText.replace('2,369.24', '2,369.25')), context).reason, 'arithmetic-mismatch');
assert.equal(recognizer.evaluate(pdf(quebecText.replace('Total remittance: 2,369.24', '')), context).reason, 'missing-total');
assert.equal(recognizer.evaluate(pdf(quebecText), { ...context, quarter: 'q1' }).reason, 'wrong-reporting-period');
assert.equal(recognizer.evaluate(pdf(quebecText), { ...context, section: 'in' }).reason, 'invalid-context');
assert.equal(recognizer.evaluate(pdf('unrelated document'), context).reason, 'unsupported-document');
assert.equal(recognizer.evaluate(pdf(`${quebecText} Canada Revenue Agency PD7A`), context).reason, 'ambiguous-document-role');
assert.equal(recognizer.evaluate(pdf(quebecText.replace('Page 1 of 1', 'Page 1 of 1'), 2), context).reason,
  'conflicting-page-evidence');
assert.equal(recognizer.evaluate(pdf(`${quebecText} Reporting period end: 2031-05-31`), context).reason,
  'conflicting-evidence');
assert.equal(recognizer.evaluate(pdf([
  'Revenu Quebec payment submission confirmation', 'Reporting period end: 2031-06-30',
  'Confirmation date: 2031-07-03', 'Scheduled execution: 2031-07-12', 'Payment total: 2,369.24',
].join(' ')), context).reason, 'missing-required-field');

const formPdf = (normalizedText, compactText, layoutTokens) => ({
  normalizedText, compactText, layoutTokens, pageCount: 1, textSource: 'embedded-pdf-text+local-ocr',
});
const federalForm = recognizer.evaluate(formPdf(
  'PD7A fédéral Retenues à la source Période de versement Page 1 de 3',
  'pd7afederalretenuesalasourceperiodedeversement203106page1de3',
  [
    { value: '2468050', x: 0.64, y: 0.67, page: 1, source: 'embedded-pdf-text' },
    { value: '7', x: 0.84, y: 0.67, page: 1, source: 'embedded-pdf-text' },
    { value: '234567', x: 0.51, y: 0.67, page: 1, source: 'embedded-pdf-text' },
  ]), context);
assert.equal(federalForm.reason, 'incomplete-pages');
assert.equal(federalForm.extraction.amounts.components.grossPayroll, 24680.50);
assert.equal(federalForm.extraction.amounts.components.employeeCount, 7);

const qcLayout = [
  ['123456', 0.54, 0.76], ['78901', 0.54, 0.80], ['23456', 0.55, 0.83],
  ['11111', 0.69, 0.76], ['000', 0.896, 0.803], ['236924', 0.86, 0.76],
].map(([value, x, y]) => ({ value, x, y, page: 1, source: 'local-ocr' }));
const qcForm = recognizer.evaluate(formPdf(
  'TPZ-1015 Revenu Québec Période visée 2031-04-01 au 2031-06-30 Date limite 2031-07-15 '
    + 'A Impôt B RRQ C FSS D RQAP F CNESST Total à remettre',
  'tpz1015revenuquebecperiodevisee2031040120310630totalaremettre', qcLayout), context);
assert.equal(qcForm.status, 'prepared');
assert.equal(qcForm.extraction.amounts.arithmetic.total, 2369.24);

const federalConfirmation = recognizer.evaluate(formPdf([
  'Federal Payroll Deductions EMPTX PD7A submission confirmation', 'Status To be processed',
  'Confirmation Number FICTIONAL-REFERENCE', 'Print Date 2031 Jul 03',
  'Date payment made to employees 2031 Jun', 'Due Date 2031 Jul 15', 'Payment Date 2031 Jul 11',
  'Gross payroll', 'Number of employees', 'Amount payable',
].join(' '), 'federalpayrolldeductionsemptxpd7atobeprocessed2031jun', [
  { value: '2468050', x: 0.419, y: 0.55, page: 1, source: 'embedded-pdf-text' },
  { value: '7', x: 0.419, y: 0.573, page: 1, source: 'embedded-pdf-text' },
  { value: '234567', x: 0.419, y: 0.613, page: 1, source: 'embedded-pdf-text' },
]), context);
assert.equal(federalConfirmation.status, 'prepared');
assert.equal(federalConfirmation.extraction.documentRole, 'submission-confirmation');
assert.equal(federalConfirmation.extraction.jurisdiction, 'ca-federal');
assert.equal(federalConfirmation.extraction.reportingPeriod.end, '2031-06-30');
assert.deepEqual(federalConfirmation.extraction.dates, {
  submissionDate: '2031-07-03', dueDate: '2031-07-15', scheduledExecutionDate: '2031-07-11',
});
assert.deepEqual(federalConfirmation.extraction.amounts.components, { grossPayroll: 24680.50, employeeCount: 7 });
assert.equal(federalConfirmation.extraction.amounts.arithmetic.total, 2345.67);
assert.equal(federalConfirmation.extraction.confirmationReferencePresent, true);
assert.equal(federalConfirmation.extraction.obligationLifecycle.state, 'scheduled');
assert.equal(federalConfirmation.extraction.obligationLifecycle.settlement, 'pending');
assert.equal(federalConfirmation.extraction.relations[0].type, 'confirms-submission-of');
assert.equal(federalConfirmation.proposedFilename,
  '2031-07-03_ca-federal_payroll-remittance-submission-confirmation.pdf');
assert.match(federalConfirmation.proposedDestination,
  /\/q3\/out\/taxes\/payroll-remittances\/ca-federal\/2031-06-30$/);
assert.doesNotMatch(JSON.stringify(federalConfirmation), /FICTIONAL-REFERENCE/);
console.log('payroll-tax source recognition: PASS');
