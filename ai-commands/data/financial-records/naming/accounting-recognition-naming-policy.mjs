const ALLOWED_SOURCES = new Map([['Booking.com', 'booking']]);
const ALLOWED_KINDS = new Map([['marketplace-reservation', 'marketplace-reservation']]);

export function canonicalAccountingPdfBasename(recognition) {
  if (!recognition || typeof recognition !== 'object') return undefined;
  const date = String(recognition.documentDate || '');
  const source = ALLOWED_SOURCES.get(String(recognition.issuer || ''));
  const kind = ALLOWED_KINDS.get(String(recognition.documentKind || ''));
  if (!source || !kind || !validDate(date)) return undefined;
  return `${date}_${source}_${kind}.pdf`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
