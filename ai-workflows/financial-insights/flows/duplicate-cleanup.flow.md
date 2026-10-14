# Clean up duplicate accounting records

## Purpose

A reusable bounded flow in [Financial Insights](../financial-insights.workflow.md), owned by Bookkeeper. Retire verified redundant copies after normalization and extraction, keeping one durable canonical source with its complementary adjacent CSV/JSON. Invoke during [record intake](record-organization.flow.md), the quarter Process stage, or a standalone scoped cleanup request; full-quarter preparation or closure is not required.

## Entry

Verify exact profile/workflow/project authority, mapped roots, selected records, permitted effects and the available cleanup route. Inputs are exact source and sidecar paths, canonical identity/ownership, applicable schemas, source-hash bindings and normalization/extraction proof. Discovery can identify unfinished records, but deletion waits for durable canonical publication and validated extraction. Read-only callers report a bounded proposed removal set and blockers; this flow adds no write authority.

Use existing authorized file tools or publisher effects. For the Synology reports tree, the cleanup effect is a reversible move into the root `recycle-bin/` under the same sync root, preserving the original relative path beneath that folder. Permanent deletion and Mac Trash are not the cleanup route. The [financial-records command](../../../ai-commands/data/financial-records/financial-records.command.md) transactional apply preserves its input; this flow does not change that behavior or implement a cleanup adapter, deletion CLI or automatic watcher.

## Steps

1. **Bookkeeper — identify bounded candidate groups.** Inspect only authorized roots, preserve exact paths and compare source bytes/hashes, full document identity, periods, currencies and sidecar metadata. Classify identical source copies separately from overlapping exports, corrections, distinct supporting evidence and regenerable derivatives. Filename similarity, one payment amount or matching vendor alone proves no duplication. A source plus its CSV/JSON are complementary, not duplicates. Do not follow symlinks into other roots or delete symlink/out-of-scope targets. Proof: candidate paths, actual comparisons and retained/pending distinctions.
2. **Bookkeeper — establish the survivor.** Use the existing canonical identity, destination and ownership; do not choose by newest filename or timestamp. Verify the surviving original source is durable and its adjacent extraction matches the source hash, applicable schema, pages/rows, currencies and applicable totals/balances. Preserve unique original bytes, provenance, corrections and required sidecar fields. Different periods, currencies, FX details or conflicting metadata remain distinct/pending unless resolved without loss. Proof: exact survivor paths and validation results. Partial extraction, collisions or ambiguous identity stop dependent cleanup.
3. **Bookkeeper — bound and inspect the removal set.** Keep the exact proposed files, survivor mappings, reasons, reference changes and authorization in memory or the existing quarter summary, not a parallel persistent manifest. Include derivatives only after comparing their fields, not because their PDF hashes match. Review unique/conflicting fields before removal. Where the human explicitly authorizes removal of exact records despite understood unique-evidence loss, record that exception and loss; do not generalize it into standing permission. Update live document links safely to verified survivors; preserve historical provenance such as original filenames, hashes and origin rather than rewriting original facts because a path was retired. Preserve unique citations rather than inventing equivalent evidence. Proof: inspectable bounded removal set and resolvable surviving references.
4. **Bookkeeper — move only validated redundant files to the recycle bin.** Immediately recheck candidate/survivor identity and source hashes against the inspected set, then move those exact files to the root Synology `recycle-bin/`, preserving each original relative path. Changed source bytes, new conflicts, uncertain durability or unavailable authority/capability stop that dependent move and require revalidation. Never move the raw input before the durable canonical pair validates. Do not create a second backup/archive copy. Proof: actual move results and destination paths, executor and failed/pending paths; a proposed action or successful extraction is not removal evidence.
5. **Bookkeeper — verify and checkpoint.** Recheck surviving source hashes, valid sidecars and references, absence of only the exact listed files from the active reports tree, and presence of each staged item at its preserved path under `recycle-bin/`. Keep distinct evidence and complementary sidecars. In the same applicable `_common/qN/summary.md`, record concise moved/retained/pending results with reasons, evidence and next action; do not create a separate cleanup status file. On partial failure retain successful proof and mark `cleanup-pending`. Proof: observed survivor validation, verified active-path absence, recycle-bin destination and remaining blockers.

## Exit

Cleanup passes when the canonical source/sidecars remain validated and all authorized redundant files in the bounded set are verified absent from the active tree and present in the recycle bin, or no redundant copies exist. Return moved-to-recycle-bin, retained and pending outcomes with evidence. Cleanup alone establishes neither reconciliation, accountant readiness nor quarter closure.

Resume the parent intake/Process checkpoint, or finish the standalone cleanup request. Later authorized catch-up scans must find cleanup-pending records even when normalization/extraction already pass. Reinspect surviving pairs and remaining candidates before retrying only unfinished cleanup; do not republish, regenerate valid extraction or blindly retry a stale deletion set. Source changes return to preparation/review. Independent safe work may continue while a group is blocked.

## Fictional acceptance scenarios

| Scenario | Expected behavior |
| --- | --- |
| Exact copy | Intake PDF and canonical PDF have identical bytes; durable canonical CSV validates. Update references, remove only the verified redundant pair and verify the canonical pair remains. |
| Partial CSV | Canonical CSV omits a statement page. Keep inputs; extraction remains pending and deletion is blocked. |
| Invoice and receipt | Two documents support one payment. Retain both distinct sources; avoid counting the financial event twice during reconciliation. |
| Same PDF, conflicting JSON | Identical PDFs have JSON with conflicting tax or classification fields. Resolve required evidence first; source equality alone does not authorize deleting either derivative. |
| Broader history | An older export includes earlier periods and FX details. Retain distinct evidence; remove only after exact informed human authorization, recording the lost coverage/details. |
| Failed removal | Survivor validates but one download cannot be removed. Record cleanup-pending; next run validates current state and retries only that removal. |
| Changed canonical | Canonical bytes change after planning. Abort dependent deletion and revalidate normalization/extraction and the removal set. |
| Complementary sidecars | One PDF has valid CSV and `.pdf.json`. Retain all complementary records and existing JSON naming; they are not redundant copies. |

These scenarios define expected behavior, not executed cleanup or runtime acceptance evidence.
