/**
 * Frozen starter for the Hermes context-capacity integration fixture.
 * The benchmark runner copies this file into a visible staged run directory.
 * Input: an object containing normalizedText and compactText strings.
 * Output: the frozen recognized-family result or { recognizedFamily: false }.
 * Effects: none; this module performs only in-memory recognition.
 */
export class ChangeApprovalRecognizer {
  recognize(input = {}) {
    const normalizedText = String(input.normalizedText ?? '').toUpperCase();

    const legacyMaintenance =
      /\bMAINTENANCE\s+NOTICE\b/.test(normalizedText) &&
      /\bAUTHORIZED\b/.test(normalizedText);

    if (legacyMaintenance) {
      return {
        recognizedFamily: true,
        family: 'workflow-decision',
        subtype: 'legacy-maintenance',
        evidence: [
          'maintenance-notice-keyword',
          'legacy-authorization-keyword',
          'workflow-decision-keyword',
        ],
      };
    }

    return { recognizedFamily: false };
  }
}
