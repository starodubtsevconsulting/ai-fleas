# Accounting workflow

Run the complete Accounting workflow test suite from the `ai` application directory:

```bash
../ai-workflows/accounting/accounting-frontend/app.sh --test
```

This fail-fast route includes the rendered standalone UI suite (native-style PDF drag/drop, production bootstrap
routing, rejection messaging, and in-process ingestion acceptance), backend pre-save PDF understanding/ingestion tests,
production startup/controller route metadata, and Angular template/type compilation. It intentionally uses `ngc` rather
than the host Angular build, whose Abort 134 is a sandbox infrastructure limitation.

`npm run test:workflow-standalone-ui` remains available for the focused standalone UI suite.

The workflow-owned Accounting PDF driver is
`accounting-backend/driver/acc-report.command.sh`. It is an internal backend
process boundary, not a user/agent command, so it is intentionally not added to
the managed `ai-commands` registry. The backend invokes its `understand-pdf`
action during prepare, before the user can confirm canonical ingestion. Run
`acc-report.command.sh self-check` for a no-document structured availability
check. The runtime also exposes the read-only
`GET /api/accounting/pdf-understanding-status` safe metadata endpoint.

Dropping or choosing PDFs does not persist them. It creates bounded, expiring,
mode-0600 pending reviews. The same-pane Recognition and Extracted data tabs
show only safe structured fields and the naming-policy proposal. **Add to In**
performs the one-time revalidated logical publish of the canonical PDF and its
validated JSON sidecar; **Reject / Discard** removes both staged artifacts.
Driver failures are classified without raw stderr, document text, paths, names,
environment, or secrets.

The proposed filename is read-only. Confirmed additions need no follow-up
action. **Normalize files** and **Extract missing JSON** are idempotent
reconciliation tools for supported PDFs placed directly in a section folder;
they safely skip completed items and preserve ambiguous or colliding originals.

The authoritative lifecycle, privacy, failure, naming, and future-scope rules
are in [`spec.md`](./spec.md); the command above is their canonical test route.

Understanding uses the explicitly declared, lockfile-pinned Mozilla
`pdfjs-dist` engine from the workspace runtime, independent of Homebrew or the
launcher's `PATH`. PDF.js parses the document, decodes the first page operator
list as the renderability gate, and extracts bounded visible text from at most
the first five pages. Self-check imports this exact same resolved module.
Visible text is classified from ordinary invoice/receipt/payout vocabulary,
issuer and identifier signals, totals/tax/currency evidence, and credible labeled
document dates. Dates infer reporting year and quarter; cross-quarter dates are
uncertain. Destination branch text is optional, while an explicit contradictory
property/business/branch label rejects. Bank statements map to Statements and
outgoing vendor/amount-due bills map to Out instead of In. PDF metadata is
advisory only and never overrides visible content. OCR is not currently configured, so blank text layers
and scanned/image-only PDFs are rejected as uncertain for manual review.

Booking.com Reservation Details classify as `marketplace-reservation` only
from combined visible reservation/stay, total/payment, and commission signals.
Check-in owns the period when check-out remains in the same quarter; crossing
stays require review. Branch recognition exposes only the selected normalized
token or a generic conflict, never the complete property heading.

Document-family detection is modular: the PDF.js driver owns bounded loading,
normalization, ordered recognizer dispatch, result validation, and safe failure
mapping. Booking-specific predicates live in the pure
`driver/recognizers/booking-reservation-recognizer.mjs` module with no file,
process, filename, metadata, or filesystem access.

The naming policy consumes only safe recognition fields. Booking marketplace
reservations become exactly
`YYYY-MM-DD_booking_marketplace-reservation.pdf`; source/kind are allowlisted,
branch stays in the folder context, and personal/property/reservation/payment or
original-filename data is never included. Missing fields and collisions fail
closed for review without overwrite or invented suffixes. Direct filesystem
intake remains a supported reconciliation path using the same recognition,
naming, extraction, collision, and privacy policies; section-level normalizer
compatibility wording applies only to legacy safe recognition artifacts.
