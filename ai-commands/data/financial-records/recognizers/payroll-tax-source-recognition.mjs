/**
 * Purpose: classify and extract bounded Canadian payroll-tax obligations and submission confirmations.
 * Caller: financial-records.command.mjs prepare-tax-from-source; tests may call evaluate directly.
 * Input/output: bounded PDF text/page metadata plus explicit branch/year/quarter/out context and source SHA-256;
 * returns a source-backed preparation result without raw text, identifiers, paths, or account data.
 * Effects: validation and planning only; this helper never writes, renames, submits, or settles records.
 */

const ADAPTER = Object.freeze({ id: 'canadian-payroll-tax', version: 2 });
const MONEY = '(\\d{1,3}(?:[ ,]\\d{3})*(?:[.,]\\d{2}))';
const ISO_DATE = '(\\d{4}-\\d{2}-\\d{2})';
const TEXT_DATE = '(\\d{4}\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2})';
const ANY_DATE = `(?:${ISO_DATE}|${TEXT_DATE})`;

export class PayrollTaxSourceRecognition {
  evaluate(pdf, context) {
    if (!validContext(context)) return review('invalid-context');
    const text = bounded(pdf?.normalizedText);
    const channels = evidenceChannels(pdf, text);
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

    const parsed = families[0](text, pdf.pageCount, compact, pdf.layoutTokens || [], context, channels);
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
    const fieldProvenance = { ...parsed.evidence,
      documentRole: classificationEvidence(channels, parsed),
      jurisdiction: classificationEvidence(channels, parsed),
      'obligationLifecycle.state': { source: 'derived-rule', confidence: 'exact' },
      'obligationLifecycle.settlement': { source: 'derived-rule', confidence: 'exact' } };
    const criticalFields = paymentCriticalFields(parsed);
    const ocrVerificationRequired = criticalFields.filter((field) =>
      ['ocr-text', 'ocr-layout'].includes(fieldProvenance[field]?.source));
    const unresolvedCriticalFields = criticalFields.filter((field) => !fieldProvenance[field]
      || fieldProvenance[field].source === 'unresolved');
    const extraction = {
      schemaVersion: 2,
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
      provenance: fieldProvenance,
      ocrVerificationRequired,
      unresolvedCriticalFields,
      ...(parsed.confirmationReferencePresent === true ? { confirmationReferencePresent: true } : {}),
    };
    const unresolved = unresolvedCriticalFields.length > 0;
    return {
      status: incomplete || unresolved ? 'review-required' : 'prepared',
      reason: incomplete ? 'incomplete-pages' : (unresolved ? 'unresolved-critical-evidence' : undefined),
      proposedDestination: destination,
      proposedFilename,
      proposedSidecarFilename: `${proposedFilename}.json`,
      extraction,
      reviewEligible: !incomplete && unresolvedCriticalFields.length === 0,
      applyEligible: !incomplete && unresolvedCriticalFields.length === 0 && ocrVerificationRequired.length === 0,
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

function parseFederalObligation(text, physicalPageCount, compact, layoutTokens, context, channels) {
  const endField = readAcross(channels, (value) => fieldDate(value,
    ['period end', 'remittance period end', 'fin de la période']))
    || readAcross(channels, (value) => federalPeriodEnd(value, '', context?.quarter));
  const embedded = layoutTokens.filter((token) => ['embedded-layout', 'embedded-pdf-text'].includes(token.source) && token.page === 1);
  const grossField = readAcross(channels, (value) => fieldMoney(value, ['gross payroll']))
    || tokenField(embedded, { xMin: 0.60, xMax: 0.76, yMin: 0.62, yMax: 0.72 }, false);
  const employeeField = readAcross(channels, (value) => fieldInteger(value, ['number of employees']))
    || tokenField(embedded, { xMin: 0.80, xMax: 0.90, yMin: 0.62, yMax: 0.72 }, true);
  const totalField = readAcross(channels, (value) => fieldMoney(value,
    ['amount payable', 'amount paid', 'total remittance']))
    || tokenField(embedded, { xMin: 0.47, xMax: 0.60, yMin: 0.62, yMax: 0.72 }, false);
  const dueField = readAcross(channels, (value) => fieldDate(value, ['due date']));
  const end = endField?.value; const grossPayroll = grossField?.value;
  const employeeCount = employeeField?.value; const total = totalField?.value;
  if (!end) return { error: 'missing-reporting-period' };
  if (grossPayroll === undefined || employeeCount === undefined) return { error: 'missing-required-field' };
  if (total === undefined) return { error: 'missing-total' };
  const expectedPageCount = expectedPages(text, compact) || physicalPageCount;
  return {
    documentRole: 'obligation', jurisdiction: 'ca-federal',
    reportingPeriod: { start: undefined, end }, dates: { dueDate: dueField?.value },
    amounts: {
      components: { grossPayroll, employeeCount },
      arithmetic: { total, computedTotal: total, matches: true },
    },
    completeness: { physicalPageCount, expectedPageCount },
    obligationLifecycle: { state: 'obligation-recorded', settlement: 'pending' },
    relations: [],
    evidence: { 'reportingPeriod.end': endField.evidence,
      'amounts.components.grossPayroll': grossField.evidence,
      'amounts.components.employeeCount': employeeField.evidence,
      'amounts.arithmetic.total': totalField.evidence,
      'amounts.arithmetic.computedTotal': { source: 'derived-arithmetic', confidence: 'exact' },
      ...(dueField ? { 'dates.dueDate': dueField.evidence } : {}) },
  };
}

function parseFederalConfirmation(text, physicalPageCount, compact, layoutTokens, context, channels) {
  const endField = readAcross(channels, employeePaymentPeriodEnd);
  const submissionField = readAcross(channels, (value) => fieldDate(value,
    ['print date', 'confirmation date', 'submission date']));
  const dueField = readAcross(channels, (value) => fieldDate(value, ['due date']));
  const scheduledField = readAcross(channels, (value) => fieldDate(value,
    ['payment date', 'scheduled execution', 'execution date']));
  const embedded = layoutTokens.filter((token) => ['embedded-layout', 'embedded-pdf-text'].includes(token.source) && token.page === 1);
  const grossField = readAcross(channels, (value) => fieldMoney(value, ['gross payroll']))
    || tokenField(embedded, { xMin: 0.36, xMax: 0.50, yMin: 0.52, yMax: 0.57 }, false);
  const employeeField = readAcross(channels, (value) => fieldInteger(value, ['number of employees']))
    || tokenField(embedded, { xMin: 0.36, xMax: 0.50, yMin: 0.56, yMax: 0.59 }, true);
  const totalField = readAcross(channels, (value) => fieldMoney(value,
    ['amount payable', 'payment total', 'total payment']))
    || tokenField(embedded, { xMin: 0.36, xMax: 0.50, yMin: 0.59, yMax: 0.64 }, false);
  const statusField = readAcross(channels, (value) => /to be processed/i.test(value) ? 'to-be-processed' : undefined);
  const referenceField = readAcross(channels, (value) =>
    /confirmation number[^a-z0-9]{0,20}[a-z0-9-]{4,}/i.test(value) ? true : undefined);
  const end = endField?.value; const submissionDate = submissionField?.value; const dueDate = dueField?.value;
  const scheduledExecutionDate = scheduledField?.value; const grossPayroll = grossField?.value;
  const employeeCount = employeeField?.value; const total = totalField?.value;
  const providerStatus = statusField?.value; const confirmationReferencePresent = referenceField?.value;
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
    evidence: { 'reportingPeriod.end': endField.evidence, 'dates.submissionDate': submissionField.evidence,
      'dates.dueDate': dueField.evidence, 'dates.scheduledExecutionDate': scheduledField.evidence,
      'amounts.components.grossPayroll': grossField.evidence,
      'amounts.components.employeeCount': employeeField.evidence,
      'amounts.arithmetic.total': totalField.evidence,
      'amounts.arithmetic.computedTotal': { source: 'derived-arithmetic', confidence: 'exact' },
      'obligationLifecycle.providerStatus': statusField.evidence,
      confirmationReferencePresent: referenceField.evidence },
  };
}

function parseQuebecObligation(text, physicalPageCount, compact, layoutTokens, context, channels) {
  const rangeField = readAcross(channels, frenchPeriodRange);
  const startField = readAcross(channels, (value) => fieldDate(value,
    ['period start', 'reporting period start', 'début de la période']))
    || (rangeField && { value: rangeField.value.start, evidence: rangeField.evidence });
  const endField = readAcross(channels, (value) => fieldDate(value,
    ['period end', 'reporting period end', 'fin de la période']))
    || (rangeField && { value: rangeField.value.end, evidence: rangeField.evidence });
  const dueField = readAcross(channels, (value) => fieldDate(value,
    ['due date', 'date limite', 'date d’échéance', "date d'echeance"]));
  let componentFields = {
    incomeTax: readAcross(channels, (value) => fieldMoney(value, ['income tax', 'quebec income tax'])),
    qpp: readAcross(channels, (value) => fieldMoney(value, ['qpp', 'quebec pension plan'])),
    healthServicesFund: readAcross(channels, (value) => fieldMoney(value, ['health services fund', 'hsf'])),
    qpip: readAcross(channels, (value) => fieldMoney(value, ['qpip', 'quebec parental insurance plan'])),
    cnesst: readAcross(channels, (value) => fieldMoney(value, ['cnesst'])),
  };
  if (Object.values(componentFields).some((value) => !value)) {
    const ocr = layoutTokens.filter((token) => ['ocr-layout', 'local-ocr'].includes(token.source) && token.page === 1);
    componentFields = {
      incomeTax: tokenField(ocr, { xMin: 0.50, xMax: 0.66, yMin: 0.75, yMax: 0.785 }, false),
      qpp: tokenField(ocr, { xMin: 0.50, xMax: 0.66, yMin: 0.785, yMax: 0.815 }, false),
      healthServicesFund: tokenField(ocr, { xMin: 0.50, xMax: 0.66, yMin: 0.815, yMax: 0.85 }, false),
      qpip: tokenField(ocr, { xMin: 0.66, xMax: 0.82, yMin: 0.75, yMax: 0.785 }, false),
      cnesst: tokenField(ocr, { xMin: 0.85, xMax: 0.94, yMin: 0.79, yMax: 0.82 }, false),
    };
  }
  const start = startField?.value; const end = endField?.value; const dueDate = dueField?.value;
  const components = Object.fromEntries(Object.entries(componentFields).map(([key, item]) => [key, item?.value]));
  if (!start || !end) return { error: 'missing-reporting-period' };
  if (Object.values(components).some((value) => value === undefined)) return { error: 'missing-required-field' };
  const totalField = readAcross(channels, (value) => fieldMoney(value,
    ['total remittance', 'amount payable', 'total à remettre', 'total a remettre']))
    || tokenField(layoutTokens.filter((token) => token.page === 1
      && ['ocr-layout', 'local-ocr'].includes(token.source)),
      { xMin: 0.82, xMax: 0.98, yMin: 0.72, yMax: 0.79 }, false);
  const total = totalField?.value;
  if (total === undefined) return { error: 'missing-total' };
  const computedTotal = money(Object.values(components).reduce((sum, value) => sum + value, 0));
  if (computedTotal !== total) return { error: 'arithmetic-mismatch' };
  return {
    documentRole: 'obligation', jurisdiction: 'ca-qc', reportingPeriod: { start, end },
    dates: { dueDate },
    amounts: { components, arithmetic: { total, computedTotal, matches: true } },
    completeness: { physicalPageCount, expectedPageCount: expectedPages(text, compact) || physicalPageCount },
    obligationLifecycle: { state: 'obligation-recorded', settlement: 'pending' }, relations: [],
    evidence: { 'reportingPeriod.start': startField.evidence, 'reportingPeriod.end': endField.evidence,
      'dates.dueDate': dueField?.evidence || { source: 'unresolved' },
      ...Object.fromEntries(Object.entries(componentFields).map(([key, item]) =>
        [`amounts.components.${key}`, item.evidence])),
      'amounts.arithmetic.total': totalField.evidence,
      'amounts.arithmetic.computedTotal': { source: 'derived-arithmetic', confidence: 'exact' } },
  };
}

function parseQuebecConfirmation(text, physicalPageCount, compact, layoutTokens, context, channels) {
  const endField = readAcross(channels, (value) => fieldDate(value,
    ['period end', 'reporting period end', 'remittance period']));
  const startField = readAcross(channels, (value) => fieldDate(value,
    ['period start', 'reporting period start']));
  const submissionField = readAcross(channels, (value) => fieldDate(value,
    ['confirmation date', 'submission date', 'print date']));
  const scheduledField = readAcross(channels, (value) => fieldDate(value,
    ['scheduled execution', 'payment date', 'execution date']));
  const totalField = readAcross(channels, (value) => fieldMoney(value,
    ['payment total', 'total payment', 'amount payable']))
    || tokenField(layoutTokens.filter((token) => token.page === 1
      && ['embedded-layout', 'embedded-pdf-text', 'ocr-layout', 'local-ocr'].includes(token.source)),
    { xMin: 0.55, xMax: 0.70, yMin: 0.62, yMax: 0.78 }, false);
  const statusField = readAcross(channels, (value) => /to be processed/i.test(value) ? 'to-be-processed' : undefined);
  const referenceField = readAcross(channels, (value) =>
    /confirmation (?:number|reference)[^a-z0-9]{0,20}[a-z0-9-]{4,}/i.test(value) ? true : undefined);
  const end = endField?.value; const submissionDate = submissionField?.value;
  const scheduledExecutionDate = scheduledField?.value; const total = totalField?.value;
  const providerStatus = statusField?.value;
  if (!end) return { error: 'missing-reporting-period' };
  if (!submissionDate || !scheduledExecutionDate || !providerStatus || !referenceField) {
    return { error: 'missing-required-field' };
  }
  if (total === undefined) return { error: 'missing-total' };
  return {
    documentRole: 'submission-confirmation', jurisdiction: 'ca-qc',
    reportingPeriod: { start: startField?.value, end },
    dates: { submissionDate, scheduledExecutionDate },
    amounts: { components: {}, arithmetic: { total, computedTotal: total, matches: true } },
    completeness: { physicalPageCount, expectedPageCount: expectedPages(text, compact) || physicalPageCount },
    obligationLifecycle: { state: 'scheduled', providerStatus, settlement: 'pending' },
    relations: [{ type: 'confirms-submission-of', targetRef: `tax-obligation:ca-qc:${end}` }],
    confirmationReferencePresent: true,
    evidence: { 'reportingPeriod.end': endField.evidence,
      ...(startField ? { 'reportingPeriod.start': startField.evidence } : {}),
      'dates.submissionDate': submissionField.evidence,
      'dates.scheduledExecutionDate': scheduledField.evidence,
      'amounts.arithmetic.total': totalField.evidence,
      'amounts.arithmetic.computedTotal': { source: 'derived-arithmetic', confidence: 'exact' },
      'obligationLifecycle.providerStatus': statusField.evidence,
      confirmationReferencePresent: referenceField.evidence },
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
  return centsTokenEvidence(tokens, bounds)?.value;
}

function centsTokenEvidence(tokens, bounds) {
  const candidates = tokens.filter((token) => inBounds(token, bounds) && token.value.length >= 3)
    .map((token) => ({ ...token, amount: Number(token.value) / 100 }))
    .filter((token) => Number.isFinite(token.amount));
  const token = candidates.sort((a, b) => b.amount - a.amount)[0];
  return token ? { value: money(token.amount), token } : undefined;
}

function integerToken(tokens, bounds) {
  return integerTokenEvidence(tokens, bounds)?.value;
}

function integerTokenEvidence(tokens, bounds) {
  const token = tokens.find((candidate) => inBounds(candidate, bounds) && /^\d{1,3}$/.test(candidate.value));
  return token ? { value: Number(token.value), token } : undefined;
}

function inBounds(token, bounds) {
  const x = token.bbox?.x ?? token.x;
  const y = token.bbox?.y ?? token.y;
  return x >= bounds.xMin && x <= bounds.xMax && y >= bounds.yMin && y <= bounds.yMax;
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

function evidenceChannels(pdf, combinedText) {
  if (pdf?.evidenceChannels && typeof pdf.evidenceChannels === 'object') {
    return { embedded: bounded(pdf.evidenceChannels.embeddedText), ocr: bounded(pdf.evidenceChannels.ocrText) };
  }
  if (pdf?.textSource === 'local-ocr') return { embedded: '', ocr: combinedText };
  if (String(pdf?.textSource || '').includes('+local-ocr')) return { embedded: '', ocr: '' };
  return { embedded: combinedText, ocr: '' };
}

function readAcross(channels, reader) {
  const embeddedValue = reader(channels.embedded);
  if (embeddedValue !== undefined) return { value: embeddedValue,
    evidence: { source: 'labelled-embedded-text', confidence: 'exact' } };
  const ocrValue = reader(channels.ocr);
  if (ocrValue !== undefined) return { value: ocrValue, evidence: { source: 'ocr-text', confidence: 'candidate' } };
  return undefined;
}

function tokenField(tokens, bounds, integer) {
  const selected = integer ? integerTokenEvidence(tokens, bounds) : centsTokenEvidence(tokens, bounds);
  if (!selected) return undefined;
  const isOcr = ['ocr-layout', 'local-ocr'].includes(selected.token.source);
  return { value: selected.value, evidence: { source: isOcr ? 'ocr-layout' : 'embedded-layout',
    confidence: isOcr ? boundedConfidence(selected.token.confidence) : 'exact',
    page: selected.token.page, bbox: boundedBbox(selected.token) } };
}

function classificationEvidence(channels, parsed) {
  if (familyTextMatches(channels.embedded, parsed)) return { source: 'labelled-embedded-text', confidence: 'exact' };
  if (familyTextMatches(channels.ocr, parsed)) return { source: 'ocr-text', confidence: 'candidate' };
  return { source: 'unresolved' };
}

function paymentCriticalFields(parsed) {
  const fields = ['documentRole', 'jurisdiction', 'reportingPeriod.end',
    ...Object.keys(parsed.dates || {}).map((key) => `dates.${key}`),
    ...Object.keys(parsed.amounts?.components || {}).map((key) => `amounts.components.${key}`),
    'amounts.arithmetic.total'];
  if (parsed.reportingPeriod.start) fields.push('reportingPeriod.start');
  if (parsed.obligationLifecycle?.providerStatus) fields.push('obligationLifecycle.providerStatus');
  fields.push('obligationLifecycle.state', 'obligationLifecycle.settlement');
  if (parsed.documentRole === 'submission-confirmation' && parsed.confirmationReferencePresent === true) {
    fields.push('confirmationReferencePresent');
  }
  return [...new Set(fields)].sort();
}

function familyTextMatches(text, parsed) {
  if (!text) return false;
  const jurisdiction = parsed.jurisdiction === 'ca-federal' ? /pd7a|federal payroll|f[eé]d[eé]ral/i
    : /revenu qu[eé]bec|qu[eé]bec payroll|tpz-1015/i;
  const role = parsed.documentRole === 'submission-confirmation'
    ? /confirmation|to be processed/i
    : /remittance|retenues|versement|source deductions|p[eé]riode\s+vis[eé]e|total\s+[aà]\s+remettre/i;
  return jurisdiction.test(text) && role.test(text);
}

function boundedConfidence(value) { return Math.max(0, Math.min(1, Number(value || 0))); }
function boundedBbox(token) {
  const source = token.bbox || { x: token.x, y: token.y, width: 0, height: 0 };
  return Object.fromEntries(['x', 'y', 'width', 'height'].map((key) =>
    [key, Math.max(0, Math.min(1, Number(source[key] || 0))) ]));
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
