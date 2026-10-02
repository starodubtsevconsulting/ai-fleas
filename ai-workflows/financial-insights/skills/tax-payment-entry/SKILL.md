---
name: tax-payment-entry
description: Prepare a profile-authorized bank tax-payment form from an exact source remittance PDF, with side-by-side evidence checking, deliberate field entry, human-only authentication and final submission, and post-submit reconciliation. Use when assisting with a tax payment in a visible banking interface; never use it to submit autonomously.
---

# Tax payment entry

Use this skill only within an initialized Financial Insights scope whose profile authorizes the selected project,
provider, account alias, and visible browser route. Invoking the skill authorizes neither a new payment nor final
submission. Confirm the exact payment the human wants prepared before changing a bank form.

## Establish the evidence view

1. Follow the [`tax-payment` flow](../../flows/tax-payment.flow.md). Resolve the exact source remittance PDF from the
   authorized financial-records project. Before entering values in the bank form, require the PDF to have the reviewed
   canonical filename and destination plus an adjacent `<canonical-pdf>.json` sidecar produced by the
   profile-authorized `financial-records` normalization path. Require the sidecar to be schema-versioned and bound to
   the exact canonical PDF content hash. The sidecar supplies reviewed field candidates but does not replace the PDF
   as source evidence.
   OCR-derived values are candidates, never exact or payment-ready by themselves. If the preparation identifies
   `ocrVerificationRequired` fields, keep the authoritative original PDF open side by side and have the human verify
   every field in that exact bounded list before creating the review artifact. The attestation must remain bound to
   the same source hash and proposal revision; do not accept free-form notes or copied values as attestation.
2. If the filename or sidecar is missing or invalid, run the authorized prepare, review, apply, and reconcile path
   first. Treat canonical naming and sidecar publication as one logical transaction, not two optional cleanup steps.
   If the current processor does not support the document, stop as `processing pending / review required`; do not
   hand-author JSON, rename the PDF ad hoc, or substitute values extracted only in chat. Never overwrite a collision
   or silently add a filename suffix.
3. Open the canonical PDF in a visible file/PDF preview beside the banking form before entering payment values. In Codex,
   use the workspace file preview in a side panel. Keep it available through final review so the human can compare the
   bank fields with the original document.
4. Build a compact field map from each bank label to the reviewed JSON field and its PDF page, source label, and source
   value. Include the payee or remittance type, reporting period, due or payment date, each amount component, and the
   expected total. Mark values not explicitly present in the PDF as derived, provider-supplied, or unresolved; never
   present them as extracted. Stop if the reviewed JSON and visible PDF disagree.
5. Stop on a missing page, illegible value, conflicting document, arithmetic mismatch, uncertain payee, or ambiguous
   period/date. Ask the human to resolve the evidence instead of guessing from an older payment or filename.

## Fill deliberately and visibly

- Use only the visible provider interface and its ordinary controls. Do not call hidden bank APIs, inject scripts, or
  bypass a security or anti-automation control.
- Enter one field at a time. After each entry, wait for the page to settle, read the visible value back, compare it
  with the field map, and only then move to the next field. Do not use rapid multi-field bursts.
- Pause after the reporting-period/date group and after the amount group. Keep the PDF visible and give the human a
  clear opportunity to inspect the matched values before advancing.
- This deliberate sequence is for reliability and review, not human impersonation. Do not randomize timing, simulate
  behavioral biometrics, or claim the interaction was performed by the human.
- The human enters usernames or client-card identifiers when not already safely retained by the provider, plus all
  passwords, MFA codes, CAPTCHA responses, security answers, and other secret authentication data. Do not request,
  store, transcribe, or expose those values.
- If the provider says automation is prohibited, requires genuine human entry, presents a security challenge, or
  behaves unexpectedly, stop and hand control to the human.

## Final review and submission boundary

Before advancing to the final review page, compare the visible form with the open PDF and field map again. Verify the
payee, reporting period, date, each component, and calculated total. On the final review page, repeat the comparison
and stop before the control that submits, confirms, pays, schedules, or otherwise authorizes the transaction.

The human must activate that final control. After the human reports submission, inspect the provider confirmation and
capture only the minimum authorized evidence needed for reconciliation. Classify it as `submitted` or `scheduled`,
not `paid` or `settled`, until a later bank record independently confirms settlement. When the provider produces a
separate confirmation PDF, normalize it into the existing reporting-period tax-case bundle with a distinct
submission-confirmation filename and adjacent JSON sidecar. Use the actual submission/confirmation date in its
filename; keep any scheduled execution date in structured data. Never add `_payed`, `_paid`, or another mutable-status
suffix. Preserve provider confirmation identifiers only in the authorized private financial-records store; never
place real identifiers or screenshots in normalized JSON or the public skill. Record only the bounded
`confirmationReferencePresent` boolean when the normalization contract requires it. The final bank submit remains a
human-only action even after all OCR-only fields have been verified.
