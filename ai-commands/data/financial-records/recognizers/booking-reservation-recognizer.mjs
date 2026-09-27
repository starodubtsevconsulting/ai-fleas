/**
 * Pure recognizer contract. Input is bounded in-memory normalized PDF text and
 * selected context only; output contains safe evidence, never source text.
 */
export function recognizeBookingReservation(input) {
  const text = String(input.normalizedText || '');
  const compact = String(input.compactText || '');
  const context = input.context || {};
  const brand = /\bbooking\.com\b/i.test(text) || compact.includes('bookingcom');
  const details = /\breservation details\b/i.test(text) || compact.includes('reservationdetails');
  if (!brand || !details) return { recognizedFamily: false };

  const identifier = /\b(?:booking|reservation)\s*(?:number|no\.?|id|#)\s*[:#-]?\s*[A-Za-z0-9-]{3,}\b/i.test(text) || /(?:booking|reservation)(?:number|no|id)[a-z0-9]{3,}/.test(compact);
  const checkIn = compactLabeledDate(compact, 'checkin');
  const checkOut = compactLabeledDate(compact, 'checkout');
  const stayFacts = /\b(?:nights?|stay length|guests?|rooms?)\b/i.test(text) || /(?:nights?|staylength|guests?|rooms?)/.test(compact);
  const money = /(?:CAD|USD|EUR|GBP|\$|€|£)\s?\d|\d[\d,.]*\s?(?:CAD|USD|EUR|GBP)\b/i.test(text) || /(?:cad|usd|eur|gbp)/.test(compact);
  const total = /\b(?:total|subtotal|tax|amount)\b/i.test(text) || /(?:totalprice|totalroomprice|subtotal|taxes|amount)/.test(compact);
  const facilitatedPayment = /\b(?:booking\.com facilitated|facilitated by booking\.com|guest payment|payment by guest|booking\.com payments?)\b/i.test(text) || compact.includes('guestpayment') || compact.includes('bookingcomfacilitated');
  const commission = /\b(?:commissionable amount|estimated commission|commission)\b/i.test(text) || compact.includes('commissionableamount') || compact.includes('estimatedcommission');
  const samePeriod = checkIn && checkOut && periodKey(checkIn) === periodKey(checkOut);
  const complete = identifier && checkIn && checkOut && stayFacts && money && total && facilitatedPayment && commission;
  const primaryTotal = visiblePrimaryTotal(text);
  const branch = safeBranchEvidence(compact, String(context.branchId || ''));
  const evidenceFlags = [
    'reservation-details', identifier && 'document-identifier', checkIn && checkOut && 'stay-dates',
    stayFacts && 'stay-facts', money && total && 'monetary-total', facilitatedPayment && 'marketplace-payment',
    commission && 'commission-evidence', samePeriod && 'credible-date',
  ].filter(Boolean);
  const accepted = Boolean(complete && samePeriod);
  return {
    recognizedFamily: true,
    result: {
      supported: accepted,
      relevant: accepted,
      classification: accepted ? 'accepted' : 'uncertain',
      confidence: accepted ? 1 : Math.min(0.79, evidenceFlags.length / 8),
      // Keep only structural, non-monetary evidence available to the visual
      // fallback.  It remains non-actionable until that fallback verifies a
      // supported labelled total.
      documentKind: checkIn && checkOut ? 'marketplace-reservation' : '',
      section: checkIn && checkOut ? 'in' : '',
      year: checkIn ? String(checkIn.getUTCFullYear()) : '',
      quarter: checkIn ? `q${Math.floor(checkIn.getUTCMonth() / 3) + 1}` : '',
      branchId: branch,
      issuer: 'Booking.com',
      documentDate: checkIn ? checkIn.toISOString().slice(0, 10) : '',
      primaryTotal: accepted ? primaryTotal : undefined,
      evidenceFlags,
    },
  };
}

function visiblePrimaryTotal(text) {
  // PDF text items are joined with spaces by understand-pdf.  Keep this
  // narrow to labelled totals, but accept the Unicode dashes emitted by the
  // real Booking layout (for example: "Total price — CAD 1,475.76").
  const match = text.match(/\b(total(?:\s+(?:room\s+)?price)?|amount\s+(?:received|paid)|paid\s+amount|payment\s+received)\s*[:\-\u2010-\u2015]?\s*(?:(CAD|USD|EUR|GBP)\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)(?![\d,.])(?:\s*(CAD|USD|EUR|GBP))?/i);
  if (!match) return undefined;
  const amount = Number(match[3].replace(/,/g, ''));
  const currency = String(match[2] || match[4] || '').toUpperCase();
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return undefined;
  const label = match[1].toLowerCase().replace(/\s+/g, '-');
  return { amount, currency, label };
}

function compactLabeledDate(compact, label) {
  const start = compact.indexOf(label);
  if (start < 0) return undefined;
  const value = compact.slice(start + label.length, start + label.length + 100);
  const month = value.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(\d{1,2})((?:19|20)\d{2})/);
  if (month) return validDate(Number(month[3]), monthNumber(month[1]), Number(month[2]));
  const ymd = value.match(/((?:19|20)\d{2})(\d{2})(\d{2})/);
  return ymd ? validDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3])) : undefined;
}

function validDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day ? value : undefined;
}

function monthNumber(value) {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(value.slice(0, 3)) + 1;
}

function periodKey(date) {
  return `${date.getUTCFullYear()}-q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function safeBranchEvidence(compact, selectedBranch) {
  const selected = selectedBranch.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hasHeading = compact.includes('property') || compact.includes('accommodation');
  if (!hasHeading) return '';
  return selected && compact.includes(selected) ? selectedBranch : 'different-branch';
}
