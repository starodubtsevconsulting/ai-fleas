# Prepare a quarter for accountant handover

## Purpose

Within the [Financial Insights workflow](../financial-insights.workflow.md), carry one authorized quarter from inspection through processing, collection, reconciliation and handover, preserving explicit review and closure gates. This is the normative human/agent procedure, not an executable Router projection or a new runtime engine. Narrow record questions use their own bounded flows and do not require quarter closure.

## Entry

Resolve the exact authorized profile, workflow, project subset, organization/businesses, accounts and currencies, calendar quarter, accounting basis and as-of date. Verify initialized role authority or the applicable authorized Admin emulation contract, actual folder mapping, permitted read/write effects, command adapters and required reviewers. A saved-project label alone is insufficient. Unverified scope blocks dependent operations.

Inputs are original records, adjacent CSV/JSON, the current mapped `_common/qN/summary.md`, and the human's requested endpoint (readiness, delivery, review or closure). Revalidate the summary; it is derived evidence. Closed-period records remain protected under the [tax flow](tax-payment.flow.md) and selected persistence contract. Later operational activity preserves its original reporting period.

The configured **Bookkeeper** is accountable for all five operational stages. **Admin** handles administration and authorized coordination/emulation under its own contract; it is not an additional registered worker. Humans/accountants supply external authorization, acceptance, review and closure events. A spawned utility agent is not a registered role or an independent reviewer. Required independent review uses a real authorized reviewer; if unavailable, preserve that gate as pending.

## Steps

### 1. Inspect

- **Owner:** Bookkeeper.
- **Inputs:** verified scope, current sources/sidecars, summary and requested endpoint.
- **Mechanics:** bounded discovery and source checks from [record lookup](record-lookup.flow.md); scoped intake/catch-up inventory from [record organization](record-organization.flow.md). Resolve supported profile-authorized commands before calling them.
- **Outputs/proof:** exact source paths, account/currency and statement-date coverage, valid/stale/missing extraction findings, separate normalization findings and the first unfinished action in the one summary. Include all in-scope originals, including images without sidecars. Reuse valid evidence.
- **Transition:** unfinished records go to Process; missing documents go to Collect; a fully processed inventory goes to Reconcile. Unsupported capability blocks its dependent work, while independent supported records may proceed. Changed scope returns here before further effects.

### 2. Process

- **Owner:** Bookkeeper.
- **Inputs:** unfinished existing or newly received records and validated scope.
- **Mechanics:** supported [financial-records](../../../ai-commands/data/financial-records/financial-records.command.md) adapters and authorized PDF/OCR tools; follow the [intake invariant](record-organization.flow.md#intake-completion-invariant) and [versioned publisher](../versioned-data.md). Finish redundant-copy removal using the reusable [duplicate-cleanup flow](duplicate-cleanup.flow.md).
- **Outputs/proof:** source identity/destination normalized through the reviewed persistence route, and independently validated adjacent extraction with source-hash binding, applicable schema/coverage, page/row provenance, currencies and applicable arithmetic. Preserve original source bytes, legacy JSON naming, uncertain OCR fields and collision evidence. Do not require both CSV and JSON for every source. Reuse unchanged already-valid pairs without regeneration, while finishing pending authorized cleanup. Verify redundant-copy cleanup through the authorized route after the durable canonical pair validates; record cleanup-pending separately when blocked.
- **Transition:** only normalization plus validated extraction and verified redundant-copy cleanup (or no redundant copies) completes intake. Continue to Collect for remaining coverage gaps, otherwise Reconcile. Unsupported formats, missing adapter/publication authority, collisions or review-required fields remain unfinished with a reason, owner and next action in the summary. A filename or existing sidecar alone proves neither state. No generic exporter or continuous watcher is assumed.

### 3. Collect

- **Owner:** Bookkeeper.
- **Inputs:** explicit missing-document/coverage list from Inspect or Reconcile.
- **Mechanics:** profile-authorized [statements](../../../ai-commands/data/statements/statements.command.md), [taxes](../../../ai-commands/data/taxes/taxes.command.md) and permitted document/browser capabilities. Official Wise collection uses the command-owned [Wise statements skill](../../../ai-commands/data/statements/skills/wise-statements/SKILL.md); verify account, currency and exact period. A transaction-history export does not replace an official balance statement.
- **Outputs/proof:** original provider records and observed coverage, or an explicit outstanding request/blocker with next action. Human authentication remains human-entered. Collecting does not authorize payments, external messages or otherwise unavailable effects.
- **Transition:** every received PDF/image returns to Process before reconciliation. Unavailable evidence stays pending, never becomes zero activity or a completed checkbox. Resume collection when the provider/human supplies it; do independent supported work meanwhile. Reconcile can assess partial coverage but cannot silently waive required records.

### 4. Reconcile

- **Owner:** Bookkeeper.
- **Inputs:** validated processed records, account/period coverage and explicit remaining gaps.
- **Mechanics:** original-source verification, on-demand tables and matching using [financial-analysis](../../../ai-commands/data/financial-analysis/financial-analysis.command.md), [spending](spending-question.flow.md) and [tax](tax-payment.flow.md) rules within authorized capabilities.
- **Outputs/proof:** income invoices matched to receipts/payouts with fees, FX and currencies separated; expenses matched to invoices and card/bank postings; internal transfers and card-balance payments linked without duplicate income/expense; payroll and tax obligations distinguished from actual settlement; owner transfers classified only with evidence. Check full quarter coverage independently of statement arithmetic. Record unresolved differences, original references and affected milestones in the summary. Material conclusions needing independent review remain pending until that real gate passes.
- **Transition:** missing evidence returns to Collect; invalid or stale extraction returns to Process; scope changes return to Inspect. An unexplained difference remains pending with a next action. Continue to Handover when evidence supports readiness or explicit accountant acceptance permits a documented incomplete handover.

### 5. Handover and close

- **Owner:** Bookkeeper for preparation and recording; human/accountant owns external acceptance and approval events.
- **Inputs:** reconciliation evidence, remaining exceptions, required independent review and requested endpoint.
- **Mechanics:** apply the exact [quarter checklist](record-organization.flow.md#quarter-status-checklist) in the existing summary. Do not create separate readiness, knowledge, queue or handover status files. Prepare bounded evidence under the [evidence contract](../evidence-contract.md). Send externally only when the human explicitly authorizes messaging/delivery and the selected capability permits it.
- **Outputs/proof:** readiness supported by coverage/reconciliation, or explicit accountant acceptance of named exceptions; actual delivery confirmation/date for sent; actual accountant review evidence for reviewed; explicit authorized closure approval/date for closed. Acceptance of exceptions does not prove documents complete or transactions reconciled. Never self-certify external approval.
- **Transition:** stop at the requested proven endpoint. A sent package completes delivery, not accountant review or quarter closure. New contradictory evidence reopens affected checklist items with reason/date; process it through the appropriate earlier stage. Where closed-period mutation is prohibited, preserve the closure history and route the correction through the authorized open-period/reopening procedure rather than silently changing closed records.

## Transition and recovery table

These are procedural events recorded concisely in the existing summary, not a separate persisted state machine. The seven checklist milestones remain independent evidence-based facts.

| Current checkpoint / event | Next action and evidence |
| --- | --- |
| Any / scope-changed | Inspect; reverify authority and invalidate only affected proof. |
| Inspect, Collect or later / copied-record or records-arrived | Process; received originals are not completed intake. |
| Process / normalization-complete + extraction-validated + cleanup-verified-or-unnecessary | Collect if coverage missing, otherwise Reconcile; retain both validation results. |
| Inspect or Reconcile / documents-missing | Collect; record exact missing coverage and next action. |
| Reconcile / extraction-invalid | Process; preserve failed binding/review evidence. |
| Reconcile / unresolved-difference | Remain pending; investigate bounded matches or Collect named evidence. |
| Reconcile / ready | Handover; cite coverage, reconciliation and required review, or explicit accepted exceptions. |
| Handover / sent | Record delivery evidence/date; review and closure remain pending. |
| Handover / accountant-review-complete | Check review with actual evidence; closure requires its own approval. |
| Handover / closure-approved | Check closed only with authorized approval and supporting evidence/date. |
| Any / blocked | Preserve completed proof, first unfinished stage, concrete reason, owner and next action; continue independent supported work. |
| Blocked / resume | Recheck changed scope/source/capability, then resume first unfinished stage; do not restart valid work. |
| Ready or later / new material gap | Reopen affected current milestones with reason/date; preserve prior delivery/review events and route to Inspect, Process or Collect as appropriate. |

## Exit

Return the requested endpoint and its actual evidence, coverage and remaining blockers. Readiness, delivery, accountant review and closure are different outcomes; never infer a later outcome from an earlier one. Persist only through authorized effects. Use the existing [record layout](record-organization.flow.md): source-adjacent extracts, one quarter summary, annual matters separate, combined tables composed on demand. Preserve unique evidence; do not add durable aggregate copies.

On failure, retain valid evidence and the first unfinished stage in the summary with a concrete recovery action. Return supported partial findings without claiming intake, reconciliation or closure passed. The parent workflow resumes that checkpoint on the next authorized run.

## Fictional acceptance scenarios

| Scenario | Expected result |
| --- | --- |
| Stale processed invoice | A changed invoice fails the earlier source-hash binding. Process renewed preparation/review; do not reuse the old extract or overwrite silently. |
| Official Wise statement missing | Collect the correct balance statement through the authorized command skill; send the received PDF to Process before Reconcile. An activity export alone leaves the requirement pending. |
| Final card coverage missing | A statement ends September 22. Record September 23–30 as missing and Collect it, even when statement totals balance. |
| Bank/card duplicate | Match a merchant purchase to its receipt and distinguish the later card payment as a transfer; count one expense under the declared basis. |
| Unsupported adapter | Record separate normalization/extraction blockers and supported inventory; do not rename/publish ad hoc or claim intake complete. |
| Sent is not closed | Actual delivery checks sent. No accountant review or closure approval exists, so both stay unchecked. |
| Gap discovered after readiness | Reopen affected readiness/reconciliation checks with reason/date and route evidence to Process/Collect; retain actual earlier delivery evidence. |
| Valid canonical source | Existing normalization and extraction both validate against unchanged bytes. Reuse them; do not regenerate or duplicate sidecars. |
| Required reviewer unavailable | Keep independent review pending; neither Admin emulation nor Bookkeeper self-review satisfies it. |
| Narrow lookup | Answer a bounded invoice/payment question under its lookup flow; do not require full-quarter collection or closure. |

These scenarios define intended behavior, not executed financial acceptance or proof of adapter/runtime availability.
