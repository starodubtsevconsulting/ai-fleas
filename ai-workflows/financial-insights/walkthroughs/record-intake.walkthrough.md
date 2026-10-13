# Worked use case: copied records and catch-up intake

Fictional instructional example; paths, observations and results are invented, not executed evidence.

**Request:** “I copied these receipts into the quarter folder. Normalize and extract them, and catch anything we missed.”

**Scope and plan:** verify the actual authorized profile, mapped business/quarter, permitted writes and supported adapters. Follow [record organization](../flows/record-organization.flow.md), not a universal naming template. The example uses `2027/studio/Q2/out`; this path grants no authority. Bookkeeper processes existing records and records blockers in `2027/_common/q2/summary.md`. It does not need to reconcile the whole quarter to report intake status.

## Branch A: publication is unsupported

Inspect the mapped receipt folder and relevant summary in bounded batches, retaining exact paths and continuation cursors. The fictional inventory finds `scan-01.pdf`, `shop-photo.png` and valid prior pairs. Include originals without sidecars and finish the scoped inventory before claiming its coverage complete.

Resolve command capabilities and publication permission for these exact source types/destinations. Here the available generic `Out` normalization route is unsupported. Stop that dependent publication. Do not invent a CLI, call a private driver or claim read-only preparation published the pair. Continue independent supported work.

**Blocked answer:** “The scoped inventory is complete, but the available route cannot publish these receipt pairs. Normalization and adjacent extraction persistence remain pending. I can report supported read-only facts; intake is not complete.” Record the concrete capability blocker and next action in the existing summary only when writing it is authorized.

## Branch B: a supported route has been verified

This is an alternative fictional branch, not a continuation that bypasses Branch A. Proceed only after observing a supported adapter and authorized reviewed publication route for the exact records and destinations. Otherwise return Branch A's pending outcome.

| Bounded operation | Fictional observation | Decision and next action |
| --- | --- | --- |
| Inspect `scan-01.pdf` p1 | Its content identifies a May supplier receipt; the filename supplies no reliable identity | Propose the mapped canonical identity/name, check collisions, and use the reviewed publication route. Preserve original bytes/provenance. |
| Extract the complete receipt with the resolved PDF capability and validate fields against the source | Total CAD 50.00 is clear; pretax/tax rows sum to CAD 50.00; source hash and p1 provenance agree | Validate the adjacent CSV and/or JSON using the actual applicable schema. A PDF's CSV uses the same basename; preserve existing `.pdf.json` conventions. Do not require both formats. Validate normalization and extraction independently, then follow the [duplicate-cleanup flow](../flows/duplicate-cleanup.flow.md). Intake is complete only when authorized cleanup is verified or no redundant copies exist. |
| Finish cleanup after the canonical receipt pair validates | Its source hash, sidecars and references validate; one redundant intake copy remains | Remove only the verified copy through the authorized route and recheck the survivor. A failed removal stays cleanup-pending; retry cleanup without regenerating valid extraction. |
| Inspect the photo with the authorized image/OCR capability | Total CAD 30.00 is legible, but a tax digit is obscured | Preserve the supported facts and uncertain field; keep extraction review-pending with reason and next action in the one summary. OCR success alone does not check that field. |
| Check proposed destinations before publication | A distinct PDF and PNG would both produce `receipt.csv` | Preserve both sources and flag the collision. Resolve distinct source identities through the authorized route; never overwrite or merge their extracts silently. |
| Resume the scoped scan on a later run | One unchanged pair still validates; another source's bytes have changed | Reuse the unchanged pair. Invalidate the changed source's old extraction binding and require renewed preparation/review, preserving earlier evidence. Do not silently overwrite or trust stale rows. |

**Supported-branch answer, only after successful verified effects:** “The scan is complete for the stated folder. One receipt is normalized with validated adjacent extraction and verified duplicate cleanup; the photo needs tax-field review, and the same-stem collision needs a distinct identity. The changed source needs reprocessing. Unchanged valid pairs were reused.” If any publication was not observed to succeed, report that record pending instead.

**Recovery and retention:** isolate each failed record and continue independent eligible work. Keep separate normalization/extraction/cleanup status, source citations, reasons and next actions in the one quarter summary through authorized writes. Do not create a parallel intake queue, durable manifest, extraction cache or combined CSV. Compose any requested combined table on demand. Intake completion does not establish reconciliation, accountant readiness or quarter closure.
