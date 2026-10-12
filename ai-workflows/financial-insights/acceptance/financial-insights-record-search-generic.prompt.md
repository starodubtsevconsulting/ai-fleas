# Generic parameterized record search

Reusable, sanitized record-search assignment for any authorized Financial
Insights run. The selected workflow profile supplies the authorized reports
root; the selected run profile (see
[financial-insights-record-search-generic.run-profile.schema.json](financial-insights-record-search-generic.run-profile.schema.json))
supplies the period, businesses, search request, and execution profile ID.
The private runner records the response and its metrics. This prompt is
read-only: it initializes no role,
invokes no financial-records operation, and authorizes no financial action.
All names and values shown here are placeholders or fictional examples.

## Runtime inputs

The launcher substitutes these placeholders before sending the Initial
prompt; unresolved placeholders block launch rather than being guessed:

| Placeholder | Source |
| --- | --- |
| `{{SEARCH_REQUEST}}` | User-provided search request (topic, entity, direction). |
| `{{YEAR}}` | Run profile `period.year`; may be omitted (see prompt rules). |
| `{{QUARTER}}` | Run profile `period.quarter`; may be omitted for an open-ended search. |
| `{{BUSINESS_LIST}}` | Run profile `businesses[]`: display name plus folder ID per business. |
| `{{SHARED_EVIDENCE_LIST}}` | Optional run profile `shared_evidence[]`: shared read-only folder IDs and sections. |
| `{{EXECUTION_PROFILE_ID}}` | Run profile `execution_profile_id`, selected separately from the task/data profile. |

The reports root itself is resolved by the runtime from the selected workflow
profile. It is never named in public artifacts.

## Initial prompt

```text
Perform a read-only record search for the following request across the authorized reports root resolved by the selected workflow profile:

Search request: {{SEARCH_REQUEST}}
Period: {{YEAR}} {{QUARTER}}
Businesses: {{BUSINESS_LIST}}
Shared evidence: {{SHARED_EVIDENCE_LIST}}

Rules:
1. Search only the authorized reports root, only the folders identified by the supplied business folder IDs and explicitly supplied shared-evidence folder IDs, and only the requested period folders when a period is supplied. Within each selected business folder, search the incoming (`in`), outgoing (`out`), and statement (`statements`) trees recursively. Shared evidence may be inspected only in its explicitly listed sections. Entries beginning with `_` are private by convention and are out of scope unless explicitly listed as shared evidence.
2. Use filenames only to discover candidates. A filename match is never evidence: inspect the source document content to confirm the entity, record direction, topic, date, amount, currency, and status before reporting any record.
3. When the year is omitted, search the current year first, then broaden the search, and report the year of every match rather than assuming it.
4. Cite every reported inclusion, exclusion, and total to its exact relative source path plus page number (documents) or one-based row number including the header (statement rows). Relative paths are resolved against the reports root; never emit the absolute reports root path.
5. Do not assume payment. An invoice, due date, payment term, or status printed on an invoice does not establish settlement. Report a record as paid only when a corresponding transaction appears in a statement; otherwise report it as unpaid-if-stated or as having no matching payment evidence, whichever the documents support.
6. When a match, entity, direction, currency, date, or status is uncertain, say so explicitly and exclude the record from confirmed totals. Report unreadable, missing, unsupported, or ambiguous evidence as such. Limit completeness claims to the folders and periods actually inspected.
7. This is a read-only search. Do not normalize, rename, create, move, delete, or publish any file; do not create sidecars; do not reconcile by writing; do not make or schedule any payment; do not invoke financial-records commands.
8. The harness records this response only in the private run-evidence destination selected by the run profile. Do not create, write, or publish result documents yourself. Public artifacts (summaries, tickets, commit messages, chat replies meant for publication) must contain no private source data: no document contents, no amounts, no counterparty names, and no absolute source paths.
9. Attribute this run to execution profile {{EXECUTION_PROFILE_ID}}, which is selected separately from the task/data profile; do not infer either profile identity from folder names or paths.

Return only one valid JSON object with this shape (no Markdown fences or prose outside JSON):
{
  "searched": [{"business": "display name", "folder_id": "folder id", "sections": ["in", "out", "statements"], "period": "resolved period or 'unbounded'"}],
  "records": [{"ref": "local reference id", "kind": "incoming|outgoing|statement", "entity": "entity named in document", "folder_business": "business owning the folder", "source": "exact relative path", "page_or_row": 1, "date": "ISO date or 'uncertain'", "amount": "decimal string or 'uncertain'", "currency": "ISO currency code or 'uncertain'", "status": "documented status", "payment_status": "statement-matched|stated-unpaid|no-matching-payment-evidence|not-applicable", "citations": ["relative/path page 1", "relative/statement.csv row 2"]}],
  "totals": {"gross_requested_category": "decimal string", "matched_payments": "decimal string", "unmatched_amount": "decimal string"},
  "exclusions": [{"ref": "local reference id", "reason": "why excluded", "source": "exact relative path", "page_or_row": 1}],
  "uncertainties": ["explicit statement of each uncertain, unreadable, missing, or ambiguous item"],
  "notes": ["..."],
  "limitations": ["..."]
}

Report totals only over statement-supported or content-confirmed records, keep income and expense categories separate, preserve each source currency, and do not invent exchange rates or net unlike categories. Use empty arrays when a section has no entries.
```

## Evaluator boundary

The evaluator compares the response with independently reviewed source facts
for the selected run profile. Reference facts, hidden record links, and
expected totals are never model input. This prompt tests discovery coverage,
content-based classification, statement-supported payment status, citation
exactness, private-output handling, and correct unknown/missing states. It
does not test command-based invoice normalization, statement-adapter
execution, or tax classification; a run that reports such processing as
completed work fails this scenario. The fixed Q4 cross-business prompt and
its evaluator are separate documents and are unchanged by this generic one.
