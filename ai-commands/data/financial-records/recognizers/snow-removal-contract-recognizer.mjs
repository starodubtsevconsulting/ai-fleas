/**
 * Pure recognizer contract. Input is bounded in-memory normalized PDF text and
 * selected context only; output contains safe evidence, never source text.
 */
export class SnowRemovalContractRecognizer {
  recognize(input) {
    const text = String(input.normalizedText || '');
    const compact = String(input.compactText || '');
    const context = input.context || {};

    // Check for both CONTRAT and DÉNEIGEMENT/DENEIGEMENT
    const hasContrat = /\bcontrat\b/i.test(text) || compact.includes('contrat');
    const hasDenigement = /\b[dé]neigement\b/i.test(text) || compact.includes('denigement') || compact.includes('deneigement');

    // Check for VERSEMENT or PAIEMENT
    const hasVersement = /\bversement\b/i.test(text) || compact.includes('versement');
    const hasPaiement = /\bpaiement\b/i.test(text) || compact.includes('paiement');

    // All three conditions must be present
    if (!hasContrat || !hasDenigement || !(hasVersement || hasPaiement)) {
      return { recognizedFamily: false };
    }

    const evidenceFlags = [
      'service-contract-keyword',
      hasContrat && 'contrat-keyword',
      hasDenigement && 'denigement-keyword',
      hasVersement && 'versement-keyword',
      hasPaiement && 'paiement-keyword',
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
