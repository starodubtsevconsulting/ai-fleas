/**
 * Pure recognizer contract. Input is bounded in-memory normalized PDF text and
 * selected context only; output contains safe evidence, never source text.
 */
export class SnowRemovalContractRecognizer {
  recognize(input) {
    const text = String(input.normalizedText || '');
    const compact = String(input.compactText || '');
    const context = input.context || {};

    // Check for French phrases: CONTRAT DE DÉNEIGEMENT and VERSEMENT/PAIEMENT
    const hasContrat = /\bcontrat\b/i.test(text) || compact.includes('contrat');
    const hasDenigement = /\b[dé]neigement\b/i.test(text) || compact.includes('denigement') || compact.includes('deneigement');

    // Check for VERSEMENT or PAIEMENT
    const hasVersement = /\bversement\b/i.test(text) || compact.includes('versement');
    const hasPaiement = /\bpaiement\b/i.test(text) || compact.includes('paiement');

    // Check for English phrase: SNOW REMOVAL CONTRACT and PAYMENT
    const hasSnowRemovalContract = /\bsnow\s+removal\s+contract\b/i.test(text);
    const hasPayment = /\bpayment\b/i.test(text);

    // All three conditions must be present (French: contrat + denigement + versement/paiement)
    // or (English: snow removal contract + payment)
    const isFrenchMatch = hasContrat && hasDenigement && (hasVersement || hasPaiement);
    const isEnglishMatch = hasSnowRemovalContract && hasPayment;

    if (!isFrenchMatch && !isEnglishMatch) {
      return { recognizedFamily: false };
    }

    const evidenceFlags = [
      'service-contract-keyword',
      hasContrat && 'contrat-keyword',
      hasDenigement && 'denigement-keyword',
      hasVersement && 'versement-keyword',
      hasPaiement && 'paiement-keyword',
      hasSnowRemovalContract && 'snow-removal-contract-keyword',
      hasPayment && 'payment-keyword',
    ].filter(Boolean);

    return {
      recognizedFamily: true,
      result: {
        supported: false,
        relevant: false,
        classification: 'uncertain',
        confidence: 0.6,
        documentKind: 'service-contract',
        section: 'review',
        evidenceFlags,
      },
    };
  }
}
