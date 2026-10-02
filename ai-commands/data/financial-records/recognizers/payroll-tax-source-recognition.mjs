/**
 * Purpose: classify and extract bounded Canadian payroll-tax obligations and submission confirmations.
 * Caller: financial-records.command.mjs prepare-tax-from-source; tests may call evaluate directly.
 * Input/output: bounded PDF text/page metadata plus explicit branch/year/quarter/out context and source SHA-256;
 * returns a source-backed preparation result without raw text, identifiers, paths, or account data.
 * Effects: validation and planning only; this helper never writes, renames, submits, or settles records.
 */

const ADAPTER = Object.freeze({ id: 'canadian-payroll-tax', version: 1 });
const MONEY = '(\\d{1,3}(?:[ ,]\\d{3})*(?:[.,]\\d{2}))';
const ISO_DATE = '(\\d{4}-\\d{2}-\\d{2})';
const TEXT_DATE = '(\\d{4}\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2})';
const ANY_DATE = `(?:${ISO_DATE}|${TEXT_DATE})`;

export class PayrollTaxSourceRecognition {
  evaluate(pdf, context) {
    if (!validContext(context)) return review('invalid-context');
    const text = bounded(pdf?.normalizedText);
    const compact = String(pdf?.compactText || '').toLowerCase();
    if (!text || !Number.isInteger(pdf?.pageCount)) return review('unsupported-document');
    if (hasConflictingLabelValues(text)) return review('conflicting-evidence');

    const families = [
      detectFederalConfirmation(text, compact),
      detectQuebecConfirmation(text, compact),
      detectQuebecObligation(text, compact),
      detectFederalObligation(text, compact),
    ].filter(Boolean);
    if (families.length !== 1) return review(families.length ? 'ambiguous-document-role' : 'unsupported-document');

    const parsed = families[0](text, pdf.pageCount, compact, pdf.layoutTokens || [], context);
    if (parsed.error) return review(parsed.error);
    if (parsed.completeness.expectedPageCount < parsed.completeness.physicalPageCount) {
      return review('conflicting-page-evidence');
    }
    if (!periodMatches(parsed.reportingPeriod.end, context.year, context.quarter)) return review('wrong-reporting-period');

    const sourceSha256 = String(context.sourceSha256 || '');
    if (!/^[a-f0-9]{64}$/.test(sourceSha256)) return review('invalid-source-hash');
    const filenameDate = parsed.documentRole === 'submission-confirmation'
      ? parsed.dates.submissionDate
      : parsed.reportingPeriod.end;
    const proposedFilename = `${filenameDate}_${parsed.jurisdiction}_payroll-remittance-${parsed.documentRole}.pdf`;
    const destination = [context.year, context.branchId, context.quarter, 'out', 'taxes',
      'payroll-remittances', parsed.jurisdiction, parsed.reportingPeriod.end].join('/');
    const incomplete = parsed.completeness.physicalPageCount < parsed.completeness.expectedPageCount;
    const extraction = {
      schemaVersion: 1,
      recordType: 'payroll-tax-document',
      recordId: `sha256:${sourceSha256}`,
      adapter: ADAPTER,
      source: { sha256: sourceSha256, mediaType: 'application/pdf', textSource: pdf.textSource || 'provided-pdf-text' },
      documentRole: parsed.documentRole,
      jurisdiction: parsed.jurisdiction,
      currency: 'CAD',
      operationalPeriod: { year: context.year, quarter: context.quarter },
      reportingPeriod: parsed.reportingPeriod,
      dates: parsed.dates,
      amounts: parsed.amounts,
      completeness: {
        ...parsed.completeness,
        complete: !incomplete,
        warnings: incomplete ? ['physical-page-count-below-expected'] : [],
      },
      processing: { state: incomplete ? 'incomplete' : 'processing-pending', reviewRequired: true },
      obligationLifecycle: parsed.obligationLifecycle,
      relations: parsed.relations,
      provenance: parsed.provenance,
      ...(parsed.confirmationReferencePresent === true ? { confirmationReferencePresent: true } : {}),
    };
    return {
      status: incomplete ? 'review-required' : 'prepared',
      reason: incomplete ? 'incomplete-pages' : undefined,
      proposedDestination: destination,
      proposedFilename,
      proposedSidecarFilename: `${proposedFilename}.json`,
      extraction,
      applyEligible: !incomplete,
    };
  }
}

function detectFederalObligation(text, compact) {
  const federal = /(?:pd7a|canada revenue agency|cra|f[eé]d[eé]ral)/i.test(text)
    || compact.includes('federalpayrolldeductions');
  const payroll = /(?:payroll|source deductions?|retenues?\s+(?:d['’]?)?\s*la\s+source|p[eé]riode\s+de\s+versement)/i.test(text);
  const confirmation = /(?:to be processed|submission confirmation|confirmation number|emptx)/i.test(text);
  if (!federal || !payroll || confirmation) return undefined;
  return parseFederalObligation;
}

function detectFederalConfirmation(text, compact) {
  const federal = /(?:federal payroll deductions|pd7a|emptx)/i.test(text)
    || compact.includes('federalpayrolldeductions');
  const confirmation = /(?:to be processed|confirmation number|submission confirmation)/i.test(text);
  if (!federal || !confirmation) return undefined;
  return parseFederalConfirmation;
}

function detectQuebecConfirmation(text, compact) {
  const qc = /(?:qu[eé]bec\s+payroll\s+source\s+deductions|payroll\s+source\s+deductions.{0,80}qu[eé]bec|revenu\s+qu[eé]bec)/i.test(text);
  const confirmation = /(?:to be processed|submission confirmation|scheduled execution|payment confirmation)/i.test(text)
    || compact.includes('tobeprocessed');
  if (!qc || !confirmation) return undefined;
  return parseQuebecConfirmation;
}

function detectQuebecObligation(text, compact) {
  const qc = /(?:qu[eé]bec|revenu qu[eé]bec)/i.test(text);
  const payroll = /(?:source deductions?|qpp|qpi?p|health services fund|cnesst|tpz-1015|p[eé]riode\s+vis[eé]e|rrq|rqap|fss)/i.test(text)
    || compact.includes('payrollsourcedeductions');
  const confirmation = /(?:to be processed|submission confirmation|scheduled execution|payment confirmation)/i.test(text);
  if (!qc || !payroll || confirmation) return undefined;
  return parseQuebecObligation;
}

function parseFederalObligation(text, physicalPageCount, compact, layoutTokens, context) {
  const end = fieldDate(text, ['period end', 'remittance period end', 'fin de la période'])
    || federalPeriodEnd(text, compact, context?.quarter);
  const embedded = layoutTokens.filter((token) => token.source === 'embedded-pdf-text' && token.page === 1);
  const grossPayroll = fieldMoney(text, ['gross payroll']) || centsToken(embedded, { xMin: 0.60, xMax: 0.76, yMin: 0.62, yMax: 0.72 });
  const employeeCount = fieldInteger(text, ['number of employees'])
    ?? integerToken(embedded, { xMin: 0.80, xMax: 0.90, yMin: 0.62, yMax: 0.72 });
  const total = fieldMoney(text, ['amount payable', 'amount paid', 'total remittance', 'total'])
    || centsToken(embedded, { xMin: 0.47, xMax: 0.60, yMin: 0.62, yMax: 0.72 });
  if (!end) return { error: 'missing-reporting-period' };
  if (grossPayroll === undefined || employeeCount === undefined) return { error: 'missing-required-field' };
  if (total === undefined) return { error: 'missing-total' };
  const expectedPageCount = expectedPages(text, compact) || physicalPageCount;
  return {
    documentRole: 'obligation', jurisdiction: 'ca-federal',
    reportingPeriod: { start: undefined, end }, dates: { dueDate: fieldDate(text, ['due date']) },
    amounts: {
      components: { grossPayroll, employeeCount },
      arithmetic: { total, computedTotal: total, matches: true },
    },
    completeness: { physicalPageCount, expectedPageCount },
    obligationLifecycle: { state: 'obligation-recorded', settlement: 'pending' },
    relations: [],
    provenance: provenance(['reportingPeriod.end', 'amounts.components.grossPayroll',
      'amounts.components.employeeCount', 'amounts.arithmetic.total']),
  };
}

function parseFederalConfirmation(text, physicalPageCount, compact, layoutTokens) {
  const end = employeePaymentPeriodEnd(text);
  const submissionDate = fieldDate(text, ['print date', 'confirmation date', 'submission date']);
  const dueDate = fieldDate(text, ['due date']);
  const scheduledExecutionDate = fieldDate(text, ['payment date', 'scheduled execution', 'execution date']);
  const embedded = layoutTokens.filter((token) => token.source === 'embedded-pdf-text' && token.page === 1);
  const grossPayroll = fieldMoney(text, ['gross payroll'])
    || centsToken(embedded, { xMin: 0.36, xMax: 0.50, yMin: 0.52, yMax: 0.57 });
  const employeeCount = fieldInteger(text, ['number of employees'])
    ?? integerToken(embedded, { xMin: 0.36, xMax: 0.50, yMin: 0.56, yMax: 0.59 });
  const total = fieldMoney(text, ['amount payable', 'payment total', 'total payment', 'total'])
    || centsToken(embedded, { xMin: 0.36, xMax: 0.50, yMin: 0.59, yMax: 0.64 });
  const providerStatus = /to be processed/i.test(text) ? 'to-be-processed' : undefined;
  const confirmationReferencePresent = /confirmation number[^a-z0-9]{0,20}[a-z0-9-]{4,}/i.test(text);
  if (!end) return { error: 'missing-reporting-period' };
  if (!submissionDate || !dueDate || !scheduledExecutionDate || grossPayroll === undefined
    || employeeCount === undefined || !providerStatus || !confirmationReferencePresent) {
    return { error: 'missing-required-field' };
  }
  if (total === undefined) return { error: 'missing-total' };
  return {
    documentRole: 'submission-confirmation', jurisdiction: 'ca-federal',
    reportingPeriod: { start: undefined, end },
    dates: { submissionDate, dueDate, scheduledExecutionDate },
    amounts: { components: { grossPayroll, employeeCount }, arithmetic: { total, computedTotal: total, matches: true } },
    completeness: { physicalPageCount, expectedPageCount: expectedPages(text, compact) || physicalPageCount },
    obligationLifecycle: { state: 'scheduled', providerStatus, settlement: 'pending' },
    relations: [{ type: 'confirms-submission-of', targetRef: `tax-obligation:ca-federal:${end}` }],
    confirmationReferencePresent,
    provenance: provenance(['reportingPeriod.end', 'dates.submissionDate', 'dates.dueDate',
      'dates.scheduledExecutionDate', 'amounts.components.grossPayroll', 'amounts.components.employeeCount',
      'amounts.arithmetic.total', 'obligationLifecycle.providerStatus', 'confirmationReferencePresent']),
  };
}

function parseQuebecObligation(text, physicalPageCount, compact, layoutTokens, context) {
  const range = frenchPeriodRange(text);
  const quarterDates = isoDates(text).filter((date) => date.startsWith(`${context?.year}-`));
  const labelledStart = fieldDate(text, ['period start', 'reporting period start', 'début de la période']);
  const labelledEnd = fieldDate(text, ['period end', 'reporting period end', 'fin de la période']);
  const start = (labelledStart?.startsWith(`${context?.year}-`) ? labelledStart : undefined) || range?.start
    || quarterDates.find((date) => [1, 4, 7, 10].includes(Number(date.slice(5, 7))));
  const end = (labelledEnd?.startsWith(`${context?.year}-`) ? labelledEnd : undefined) || range?.end
    || quarterDates.find((date) => [3, 6, 9, 12].includes(Number(date.slice(5, 7))));
  const dueDate = fieldDate(text, ['due date', 'date limite', 'date d’échéance', "date d'echeance"])
    || quarterDates.find((date) => end && date > end);
  let components = {
    incomeTax: fieldMoney(text, ['income tax', 'quebec income tax']),
    qpp: fieldMoney(text, ['qpp', 'quebec pension plan']),
    healthServicesFund: fieldMoney(text, ['health services fund', 'hsf']),
    qpip: fieldMoney(text, ['qpip', 'quebec parental insurance plan']),
    cnesst: fieldMoney(text, ['cnesst']),
  };
  if (Object.values(components).some((value) => value === undefined)) {
    const ocr = layoutTokens.filter((token) => token.source === 'local-ocr' && token.page === 1);
    components = {
      incomeTax: centsToken(ocr, { xMin: 0.50, xMax: 0.66, yMin: 0.75, yMax: 0.785 }),
      qpp: centsToken(ocr, { xMin: 0.50, xMax: 0.66, yMin: 0.785, yMax: 0.815 }),
      healthServicesFund: centsToken(ocr, { xMin: 0.50, xMax: 0.66, yMin: 0.815, yMax: 0.85 }),
      qpip: centsToken(ocr, { xMin: 0.66, xMax: 0.82, yMin: 0.75, yMax: 0.785 }),
      cnesst: centsToken(ocr, { xMin: 0.85, xMax: 0.94, yMin: 0.79, yMax: 0.82 }),
    };
  }
  if (!start || !end) return { error: 'missing-reporting-period' };
  if (Object.values(components).some((value) => value === undefined)) return { error: 'missing-required-field' };
  const total = fieldMoney(text, ['total remittance', 'amount payable', 'total à remettre', 'total a remettre', 'total'])
    || centsToken(layoutTokens.filter((token) => token.source === 'local-ocr'),
      { xMin: 0.82, xMax: 0.98, yMin: 0.72, yMax: 0.89 });
  if (total === undefined) return { error: 'missing-total' };
  const computedTotal = money(Object.values(components).reduce((sum, value) => sum + value, 0));
  if (computedTotal !== total) return { error: 'arithmetic-mismatch' };
  return {
    documentRole: 'obligation', jurisdiction: 'ca-qc', reportingPeriod: { start, end },
    dates: { dueDate },
    amounts: { components, arithmetic: { total, computedTotal, matches: true } },
    completeness: { physicalPageCount, expectedPageCount: expectedPages(text, compact) || physicalPageCount },
    obligationLifecycle: { state: 'obligation-recorded', settlement: 'pending' }, relations: [],
    provenance: provenance(['reportingPeriod.start', 'reportingPeriod.end', 'dates.dueDate',
      ...Object.keys(components).map((key) => `amounts.components.${key}`), 'amounts.arithmetic.total']),
  };
}

function parseQuebecConfirmation(text, physicalPageCount, compact, layoutTokens) {
  const end = fieldDate(text, ['period end', 'reporting period end', 'remittance period']);
  const submissionDate = fieldDate(text, ['confirmation date', 'submission date', 'print date']);
  const scheduledExecutionDate = fieldDate(text, ['scheduled execution', 'payment date', 'execution date']);
  const total = fieldMoney(text, ['payment total', 'total payment', 'amount payable', 'amount', 'total'])
    || centsToken(layoutTokens, { xMin: 0.55, xMax: 0.70, yMin: 0.62, yMax: 0.78 });
  const providerStatus = /to be processed/i.test(text) ? 'to-be-processed' : undefined;
  if (!end) return { error: 'missing-reporting-period' };
  if (!submissionDate || !scheduledExecutionDate || !providerStatus) return { error: 'missing-required-field' };
  if (total === undefined) return { error: 'missing-total' };
  return {
    documentRole: 'submission-confirmation', jurisdiction: 'ca-qc',
    reportingPeriod: { start: fieldDate(text, ['period start', 'reporting period start']), end },
    dates: { submissionDate, scheduledExecutionDate },
    amounts: { components: {}, arithmetic: { total, computedTotal: total, matches: true } },
    completeness: { physicalPageCount, expectedPageCount: expectedPages(text, compact) || physicalPageCount },
    obligationLifecycle: { state: 'scheduled', providerStatus, settlement: 'pending' },
    relations: [{ type: 'confirms-submission-of', targetRef: `tax-obligation:ca-qc:${end}` }],
    provenance: provenance(['reportingPeriod.end', 'dates.submissionDate',
      'dates.scheduledExecutionDate', 'amounts.arithmetic.total', 'obligationLifecycle.providerStatus']),
  };
}

function fieldDate(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${escape(label)}[^0-9]{0,80}${ANY_DATE}`, 'i'));
    if (match) return normalizeDate(match[1] || match[2]);
  }
  return undefined;
}

function fieldMoney(text, labels) {
  return field(text, labels, MONEY, (value) => {
    const parsed = Number(value.replace(/[ ,]/g, '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? money(parsed) : undefined;
  });
}

function fieldInteger(text, labels) {
  return field(text, labels, '(\\d{1,6})', (value) => Number(value));
}

function field(text, labels, pattern, convert) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${escape(label)}\\s*(?::|=|-)?\\s*${pattern}`, 'i'));
    if (match) return convert(match[1]);
  }
  return undefined;
}

function expectedPages(text, compact = '') {
  const match = text.match(/page\s+\d+\s+(?:of|de|sur)\s+(\d+)/i);
  if (match) return Number(match[1]);
  const compactMatch = compact.match(/page\d+(?:of|de|sur)(\d+)/i);
  return compactMatch ? Number(compactMatch[1]) : undefined;
}

function frenchPeriodRange(text) {
  const match = text.match(new RegExp(`p[eé]riode\\s+vis[eé]e[^0-9]{0,400}${ISO_DATE}[^0-9]{0,80}${ISO_DATE}`, 'i'));
  return match ? { start: normalizeDate(match[1]), end: normalizeDate(match[2]) } : undefined;
}

function federalPeriodEnd(text, compact = '', selectedQuarter) {
  const year = text.match(/(?:ann[eé]e|year)[^0-9]{0,60}(20\d{2})/i)?.[1]
    || text.match(/\b(20\d{2})\b/)?.[1];
  const monthToken = text.match(/(?:mois|month)[^a-z0-9]{0,60}(0?[1-9]|1[0-2]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)?.[1]
    || text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i)?.[1];
  const compactPeriods = [...compact.matchAll(/(20\d{2})(0[1-9]|1[0-2])/g)]
    .map((match) => ({ year: match[1], month: match[2] }));
  const selectedQuarterNumber = Number(String(selectedQuarter || '').slice(1));
  const matchingPeriods = selectedQuarter
    ? compactPeriods.filter(({ month }) => {
      const reportingQuarter = Math.ceil(Number(month) / 3);
      return reportingQuarter === selectedQuarterNumber || reportingQuarter === selectedQuarterNumber - 1;
    })
    : compactPeriods;
  const compactPeriod = matchingPeriods.length ? [undefined, matchingPeriods[0].year, matchingPeriods[0].month] : undefined;
  const resolvedYear = compactPeriod?.[1] || year;
  const resolvedMonthToken = compactPeriod?.[2] || monthToken;
  if (!resolvedYear || !resolvedMonthToken) return undefined;
  const month = /^\d+$/.test(resolvedMonthToken) ? Number(resolvedMonthToken) : monthNumber(resolvedMonthToken);
  if (!month) return undefined;
  const day = new Date(Date.UTC(Number(resolvedYear), month, 0)).getUTCDate();
  return `${resolvedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function employeePaymentPeriodEnd(text) {
  const match = text.match(/date\s+payment\s+made\s+to\s+employees[^0-9]{0,100}(20\d{2})\s+([a-z]+)/i);
  if (!match) return undefined;
  const month = monthNumber(match[2]);
  if (!month) return undefined;
  const day = new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate();
  return `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoDates(text) { return [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map((match) => match[0]).filter(validDate); }

function centsToken(tokens, bounds) {
  const candidates = tokens.filter((token) => inBounds(token, bounds) && token.value.length >= 3)
    .map((token) => ({ ...token, amount: Number(token.value) / 100 }))
    .filter((token) => Number.isFinite(token.amount));
  return candidates.length ? money(candidates.sort((a, b) => b.amount - a.amount)[0].amount) : undefined;
}

function integerToken(tokens, bounds) {
  const candidate = tokens.find((token) => inBounds(token, bounds) && /^\d{1,3}$/.test(token.value));
  return candidate ? Number(candidate.value) : undefined;
}

function inBounds(token, bounds) {
  return token.x >= bounds.xMin && token.x <= bounds.xMax && token.y >= bounds.yMin && token.y <= bounds.yMax;
}

function normalizeDate(value) {
  if (validDate(value)) return value;
  const match = String(value || '').match(/^(20\d{2})\s+([a-z]+)\s+(\d{1,2})$/i);
  if (!match) return undefined;
  const month = monthNumber(match[2]);
  const result = `${match[1]}-${String(month).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
  return month && validDate(result) ? result : undefined;
}

function monthNumber(value) {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(String(value || '').slice(0, 3).toLowerCase()) + 1;
}

function hasConflictingLabelValues(text) {
  const checks = [
    [['period end', 'reporting period end', 'remittance period end'], ISO_DATE],
    [['period start', 'reporting period start'], ISO_DATE],
    [['due date'], ISO_DATE],
    [['confirmation date', 'submission date'], ISO_DATE],
    [['scheduled execution', 'payment date', 'execution date'], ISO_DATE],
    [['gross payroll'], MONEY], [['number of employees'], '(\\d{1,6})'],
    [['income tax', 'quebec income tax'], MONEY], [['qpp', 'quebec pension plan'], MONEY],
    [['health services fund', 'hsf'], MONEY], [['qpip', 'quebec parental insurance plan'], MONEY],
    [['cnesst'], MONEY], [['total remittance', 'amount payable', 'payment total', 'total payment'], MONEY],
  ];
  return checks.some(([labels, pattern]) => {
    const values = new Set();
    for (const label of labels) {
      const matches = text.matchAll(new RegExp(`${escape(label)}\\s*(?::|=|-)?\\s*${pattern}`, 'gi'));
      for (const match of matches) values.add(match[1].replace(/[ ,]/g, '').replace(',', '.'));
    }
    return values.size > 1;
  });
}

function provenance(fields) {
  return Object.fromEntries(fields.map((name) => [name, {
    source: 'source-pdf-visible-content', location: 'labelled-field-or-bounded-form-layout', confidence: 'exact',
  }]));
}

function periodMatches(end, year, quarter) {
  if (!validDate(end)) return false;
  const month = Number(end.slice(5, 7));
  if (!end.startsWith(`${year}-`)) return false;
  const reportingQuarter = Math.ceil(month / 3);
  const operationalQuarter = Number(quarter.slice(1));
  return reportingQuarter === operationalQuarter || reportingQuarter === operationalQuarter - 1;
}

function validContext(context) {
  return context?.section === 'out' && /^\d{4}$/.test(String(context.year || ''))
    && /^q[1-4]$/.test(String(context.quarter || ''))
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(String(context.branchId || ''));
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function money(value) { return Number(Number(value).toFixed(2)); }
function escape(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function bounded(value) { return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 32 * 1024); }
function review(reason) { return { status: 'review-required', reason, applyEligible: false }; }
