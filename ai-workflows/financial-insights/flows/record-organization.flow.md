# Organize accounting records and quarter summaries

## Outcome and authority

The Bookkeeper and other authorized flows use one source record with adjacent extracted data, plus one current summary per quarter. The selected profile maps the authorized reports root and business folders. This flow grants no additional read/write scope, changes no publisher policy, and does not turn a task-specific human approval into standing write authority. Existing persistence and review gates apply.

## Shared layout

```text
<reports-root>/<year>/
  _common/
    q1/summary.md
    q2/summary.md
    q3/summary.md
    q4/summary.md
    annual/summary.md
  <business>/qN/
    in/
    out/
    statements/
```

`_common` is a shared derived overview, not a financial entity or primary source. When the authorized mapping includes it, discovery must read the relevant summaries despite generic underscore-folder filters. Continue to ignore unrelated reserved/private folders; this exception grants no broader access. Preserve existing business-specific nesting and case conventions through the profile mapping. Legacy layouts remain readable; this contract does not authorize a mass migration.

## Intake completion invariant

Placing or copying a source into a folder is not completed intake. During the same authorized intake operation, classify the source from its contents, resolve its mapped destination and canonical name, normalize it through the reviewed persistence route, and extract and validate its adjacent CSV and/or JSON before reporting intake complete. This applies to PDF and image records; do not require both sidecar formats for every document. Preserve original source bytes and provenance through any authorized rename or publication, and never silently overwrite a source or sidecar.

Normalization, extraction and cleanup are independent states. A canonical filename alone does not prove extraction, and a CSV/JSON file's existence alone does not prove valid data. Validate canonical identity/destination separately from the sidecar's source-hash binding, applicable schema and field coverage, page/row provenance, currency, and applicable totals/running balances. Keep uncertain OCR fields review-pending. Successful extraction does not establish financial reconciliation or quarter closure.

At the start of intake, quarter-readiness and inventory work, scan the authorized scope for unfinished normalization, image-only sources, absent, invalid or stale sidecars, and cleanup-pending or redundant intake/download copies. Use the same supported preparation, review and publication routes to catch up eligible records. Reuse unchanged sources whose normalization and extraction already validate; do not recreate them. Still finish any pending authorized redundant-copy cleanup. Skip the record completely only when all three states validate or no redundant copies exist. Changed source bytes invalidate the earlier extraction binding and require renewed preparation/review, never silent reuse or overwrite. Isolate an individual failure and continue independent supported work.

For every unfinished record, retain separate normalization/extraction/cleanup status and a concise reason in the same quarter summary: for example unreadable source, OCR verification pending, unknown period/vendor, destination collision, unsupported adapter, or unavailable authorized publication route. State the next action; do not introduce a separate queue, knowledge or readiness folder. Unsupported formats and insufficient permissions are pending work, never successful processing.

This is a same-operation obligation with recovery on the next authorized run. It does not implement or prove an always-running folder watcher, scheduler, generic reconciliation command or universal exporter. Read-only callers may inspect and prepare supported evidence but must report canonical persistence pending when no authorized publication route is available.

## Finish normalization without duplicate copies

Keep one canonical source and its adjacent CSV/JSON. The source and sidecars are complementary evidence, not duplicates. Preserve original source bytes and provenance in the canonical source; this does not require keeping a redundant intake or Downloads copy permanently.

Run the reusable [duplicate-cleanup flow](duplicate-cleanup.flow.md) after durable canonical publication and extraction validation, and when catch-up scans find cleanup-pending copies. It owns candidate comparison, survivor validation, exact bounded removal, reference updates, verification and recovery. Unique or conflicting evidence remains pending unless resolved or removed by exact informed human authorization. Cleanup requires an available authorized route; it does not change the command apply step's input-preservation behavior or add a deletion CLI. Record blocked cleanup in the existing quarter summary and reuse valid extraction when retrying. Do not keep redundant raw-plus-canonical or backup/archive sets by default.

## Ordered method

1. For intake, quarter-readiness or inventory work, run the scoped intake/catch-up scan above for original PDF/image records and adjacent sidecars. Preserve sources and exact paths; process eligible unfinished work through supported authorized routes before reporting intake completion. A bounded read-only question inspects only relevant records and reports discovered intake gaps; it does not require quarter-wide scanning, writing a summary, or completing unrelated intake.
2. Keep an extracted CSV beside its respective source with the same basename: `invoice.pdf` pairs with `invoice.csv`. JSON stores structured metadata and CSV stores tabular fields. Do not force both formats for every source. Preserve existing JSON schema/naming conventions, including `invoice.pdf.json`; do not require renaming it to `invoice.json`.
3. Preserve source-hash bindings (including existing `source.hash` fields), provenance, page/row references, original and normalized names, currency, signed amounts, and full statement coverage dates. An OCR or uncertain image extraction remains explicitly draft/review-pending until checked. Extraction completeness and arithmetic agreement do not establish reconciliation or accountant closure.
4. Check destination collisions before any authorized write. Never overwrite another source or sidecar silently. If `invoice.pdf` and `invoice.png` would both map to `invoice.csv`, flag the collision and request or propose distinct source identities through the authorized route; do not merge them under one source basename. Distinguish duplicate evidence from two distinct payments and preserve unique evidence.
5. Maintain only the applicable `_common/qN/summary.md` as the current quarter overview: collected records and coverage, missing records, unresolved reconciliation/questions, and accountant handover status. Include concise cross-source explanations or reusable Q&A here with citations, scope/basis and verification date. Keep only matters spanning quarters in `annual/summary.md`; link to quarter summaries instead of duplicating their status lists.
6. Revalidate summaries against current sources and sidecars before relying on them. Correct stale conclusions explicitly, preserving pending items and useful unique historical evidence. Do not maintain parallel knowledge, readiness, handover or preparation status folders.
7. Compose combined tables from adjacent records on demand, with provenance, deduplication and reconciliation. Do not keep durable aggregate CSVs, extracted-text caches or archive copies of regenerable intermediates by default. Use in-memory work or an authorized visible runtime checkpoint when needed, then remove regenerable intermediates after completion. Retain genuinely unique evidence and explicitly user-approved exports; do not delete them as caches.

## Quarter status checklist

Keep one authoritative milestone checklist in the quarter's `summary.md`:

```markdown
- [ ] Required documents collected; gaps listed
- [ ] Transactions reconciled; differences explained
- [ ] Questions and pending reviews resolved
- [ ] Package ready for accountants
- [ ] Package sent — date recorded
- [ ] Accountant review completed
- [ ] Quarter closed — approval and date recorded
```

Granular collection checks may support these milestones, but do not imply that a milestone is complete. Ready, sent, reviewed and closed are separate evidence-based states. Each checked milestone must reference supporting evidence or the relevant event date; a date alone does not prove reconciliation or approval. Never infer accountant approval or self-certify a required external review or closure approval.

Missing required documents or unresolved material questions keep readiness unchecked unless the accountant explicitly accepts the documented handover exceptions. Record that acceptance and the remaining exceptions; it does not establish full completion or closure. When new evidence contradicts a checked milestone, reopen the affected items and record the reason and date in the same summary.

## Completion and stop conditions

Intake is complete for a record only when normalization and adjacent extraction both validate and redundant-copy cleanup is verified or no redundant copies exist. Validated normalization/extraction with blocked cleanup remains intake cleanup-pending; it is not a financial reconciliation or closure finding. Organization may report a partial result when unfinished records have explicit reasons and next actions in the single applicable summary; discoverable files alone do not establish completed intake. Missing extraction capability, unverified scope or unauthorized persistence stops that dependent operation; return the supported inventory and blocker. Accountant readiness remains pending until required coverage and reconciliation evidence support it.

## Fictional acceptance scenarios

| Scenario | Expected behavior |
| --- | --- |
| Verified duplicate cleanup | Raw and canonical PDFs have the same byte hash and the canonical sidecar validates. Update references and retire the redundant raw source/sidecar through the authorized route; keep the durable canonical pair. |
| Partial extraction | Canonical publication succeeded but sidecar coverage is incomplete. Preserve the input and report extraction pending; do not remove it. |
| Overlap with unique evidence | An older export contains a different period, currency or FX details. Keep it as distinct evidence unless the human explicitly authorizes removing those exact records despite the loss. |
| Conflicting derivative | Two sidecars contain unique or conflicting fields. Keep review pending until the surviving record preserves required evidence; no automatic derivative deletion. |
| Cleanup failure | The canonical pair validates but removing the redundant download fails. Record cleanup-pending and retry only the verified cleanup step; do not recreate the pair. |
| Copied source | A supported receipt is copied into an authorized intake folder. In the same operation, classify it, review its canonical name/destination, publish through the permitted route and validate its adjacent extraction; copying or renaming alone is not completed intake. |
| Catch-up scan | A quarter inventory finds an unnormalized image and a PDF without a valid sidecar. Process each supported eligible record using the same intake rules; record remaining reasons in the quarter summary. |
| Unchanged or changed source | Skip an unchanged source with validated normalization and extraction. If its bytes change, invalidate the old sidecar binding and require renewed preparation/review without silently overwriting evidence. |
| Blocked source | One receipt needs OCR verification and another has no supported publication adapter. Keep each unfinished with its reason and next action; continue processing an independent supported receipt and leave readiness pending as applicable. |
| Adjacent source | A PDF has an adjacent CSV and existing `.pdf.json`. Reuse validated fields with provenance; preserve JSON naming and do not create redundant copies. |
| Missing next card period | The last card statement ends September 22. Q3 summary records September 23–30 as missing even if every extracted statement balances. |
| Balanced and sent | Every statement balances and the package is sent. Record the sending date, but keep reconciliation, accountant review and closure unchecked until their respective evidence exists. |
| Reopened milestone | A new invoice exposes a material gap after readiness was checked. Reopen readiness and any affected milestones, record the reason/date, and obtain explicit accountant acceptance if handing over with that exception. |
| Duplicate or collision | Two extensions share a stem, or invoice and statement show one expense. Flag the CSV destination collision; do not overwrite. Link matched payment evidence and count the expense once. |
| On-demand aggregation | A requested total is composed from adjacent rows. Transfers between covered accounts are identified rather than counted as new income/expense. Report unresolved matches; discard regenerable work tables unless an export was authorized. |
| Stale summary | A new statement contradicts a cached answer. Revalidate and update the one summary through authorized persistence; do not treat the old answer as source evidence. |
| OCR image | An image-only receipt yields uncertain tax fields. Its adjacent extracted data retains source/page provenance and draft markers; the summary keeps review pending. |
| Legacy compatibility | Existing mapped `In` folders or FAQs remain readable. Adopt the unified summary when authorized, without silently renaming sources, migrating the tree or broadening scope. |

These scenarios specify intended behavior; they are not executed acceptance evidence or a claim that a generic CSV exporter exists.
