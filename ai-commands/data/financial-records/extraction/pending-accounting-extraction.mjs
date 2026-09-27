const SCHEMA = 'sc.accounting.document-extraction';

export function buildPendingAccountingExtraction(recognition) {
  if (!recognition || recognition.status !== 'eligible' || recognition.documentKind !== 'marketplace-reservation' ||
      recognition.destination !== 'in' || recognition.issuer !== 'Booking.com' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(recognition.documentDate || '')) ||
      !/^\d{4}$/.test(String(recognition.year || '')) || !/^q[1-4]$/.test(String(recognition.quarter || '')) ||
      !Number.isFinite(recognition.confidence) || recognition.confidence < 0.8) return undefined;
  const primary = recognition.primaryTotal;
  if (!primary || !Number.isFinite(primary.amount) || primary.amount < 0 || !/^[A-Z]{3}$/.test(String(primary.currency || '')) || !/^[a-z][a-z-]{1,39}$/.test(String(primary.label || ''))) return undefined;
  return {
    schema: SCHEMA,
    version: 1,
    documentDomain: 'accounting',
    documentType: 'marketplace-reservation',
    section: 'in',
    currency: primary.currency,
    totals: { primary: { label: primary.label, amount: primary.amount, currency: primary.currency, provenance: primary.provenance === 'visible-pdf-ocr-total' ? 'visible-pdf-ocr-total' : 'visible-pdf-total' } },
    layoutHints: { templateKey: 'booking-reservation', issuer: 'Booking.com', dateStrategy: 'check-in' },
    extraction: { status: 'validated', confidence: recognition.confidence, extractor: { workflow: 'financial-insights' } },
    period: {
      year: Number(recognition.year),
      quarter: Number(recognition.quarter.slice(1)),
      documentBucketDate: recognition.documentDate,
    },
    tags: [...new Set((recognition.reasons || []).filter((value) => typeof value === 'string' && /^[a-z][a-z-]{0,39}$/.test(value)).slice(0, 12))],
  };
}

export function validPendingAccountingExtraction(value) {
  return Boolean(value && value.schema === SCHEMA && value.version === 1 && value.documentDomain === 'accounting' &&
    value.documentType === 'marketplace-reservation' && value.section === 'in' &&
    /^[A-Z]{3}$/.test(String(value.currency || '')) && Number.isFinite(value.totals?.primary?.amount) && value.totals.primary.amount >= 0 &&
    /^[a-z][a-z-]{1,39}$/.test(String(value.totals.primary.label || '')) && value.totals.primary.currency === value.currency && ['visible-pdf-total', 'visible-pdf-ocr-total'].includes(value.totals.primary.provenance) &&
    value.extraction?.status === 'validated' && Number.isFinite(value.extraction?.confidence) && value.extraction.confidence >= 0.8 &&
    Number.isInteger(value.period?.year) && value.period.year >= 2000 && value.period.year <= 2100 &&
    Number.isInteger(value.period?.quarter) && value.period.quarter >= 1 && value.period.quarter <= 4 &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.period?.documentBucketDate || '')) &&
    Array.isArray(value.tags) && value.tags.length <= 12);
}
