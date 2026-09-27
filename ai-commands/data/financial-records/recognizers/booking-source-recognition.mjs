import { recognizeBookingReservation } from './booking-reservation-recognizer.mjs';

const review = (reason) => ({ status: 'review-required', reason });

export class BookingSourceRecognition {
  evaluate(pdf, expected) {
    if (expected?.section !== 'in' || !/^\d{4}$/.test(String(expected?.year || '')) ||
        !/^q[1-4]$/.test(String(expected?.quarter || '')) ||
        !/^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/.test(String(expected?.branchId || ''))) {
      return review('invalid-context');
    }
    if (!pdf || !Number.isInteger(pdf.pageCount) || pdf.pageCount < 1 || pdf.pageCount > 25 ||
        typeof pdf.normalizedText !== 'string' || pdf.normalizedText.length > 32 * 1024 ||
        typeof pdf.compactText !== 'string' || pdf.compactText.length > 32 * 1024) {
      return review('invalid-pdf-evidence');
    }
    const { recognizedFamily, result } = recognizeBookingReservation({
      normalizedText: pdf.normalizedText,
      compactText: pdf.compactText,
      context: { branchId: expected.branchId },
    });
    if (!recognizedFamily || !result?.supported || !result.relevant || result.classification !== 'accepted' ||
        !Number.isFinite(result.confidence) || result.confidence < 0.8 ||
        result.issuer !== 'Booking.com' || result.documentKind !== 'marketplace-reservation') {
      return review('insufficient-booking-evidence');
    }
    if (result.section !== 'in' || result.year !== expected.year || result.quarter !== expected.quarter ||
        result.branchId !== expected.branchId) return review('context-mismatch');
    const total = result.primaryTotal;
    if (!total || !Number.isFinite(total.amount) || total.amount < 0 ||
        !/^[A-Z]{3}$/.test(String(total.currency || '')) ||
        !/^[a-z][a-z-]{1,39}$/.test(String(total.label || ''))) return review('no-visible-labelled-total');
    return {
      status: 'eligible', destination: 'in', issuer: result.issuer, documentKind: result.documentKind,
      documentDate: result.documentDate, year: result.year, quarter: result.quarter,
      confidence: result.confidence,
      primaryTotal: { ...total, provenance: 'visible-pdf-total' },
      reasons: result.evidenceFlags,
    };
  }
}
