/**
 * Reviewed reference implementation for verifier self-checking only.
 * Caller: benchmark maintainers, never the worker under evaluation.
 * Input/output: the same pure recognition contract as the frozen starter.
 * Effects: none; this file must remain unreadable to benchmark workers.
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

    const changeRequest = /\bCHANGE\s+REQUEST\b/.test(normalizedText);
    const approval = /\bAPPROVE\b/.test(normalizedText);
    const cancelled = /\bCANCELLED\b/.test(normalizedText);

    if (changeRequest && approval && !cancelled) {
      return {
        recognizedFamily: true,
        family: 'workflow-decision',
        subtype: 'change-approval',
        evidence: [
          'change-request-keyword',
          'approval-keyword',
          'workflow-decision-keyword',
        ],
      };
    }

    return { recognizedFamily: false };
  }
}
