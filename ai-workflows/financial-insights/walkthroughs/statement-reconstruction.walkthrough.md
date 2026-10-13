# Worked use case: salary cash paid to one employee

Fictional instructional example. The organizations, paths, account labels, descriptions, dates, amounts, rules, observations and result below are invented. This walkthrough shows a reproducible bounded method; it is not executed evidence, a command recipe, or a claim that a small/local-model benchmark passed.

**Request:** “How much salary cash did we pay Morgan in Q2 2027, based on the statements?”

**Requested measure:** outgoing posted cash classified as salary and attributed to Morgan, April 1–June 30, 2027. Keep currencies separate. This does not ask for gross payroll, deductions, a payroll register, tax treatment, or quarter closure. Read the [statement reconstruction flow](../flows/statement-reconstruction.flow.md) for the complete projection schema and the [record organization flow](../flows/record-organization.flow.md) for canonical paths.

## Bounded run

### 1. Resolve the request and effects

Read the user's question as: business = the one authorized fictional organization; target employee = Morgan; period = Q2 2027; basis = statement-posted outgoing cash; account/currency scope = exactly one mapped CAD business account and exactly two mapped USD business accounts, with both USD accounts included only to check a possible internal transfer. The permitted effects are reading these mapped sources and writing the one derived salary projection only if the current profile/task explicitly permits it. If write authority is absent, finish read-only and report persistence as pending.

Select this guide because it matches the employee-specific statement question. Do not load unrelated walkthroughs or broaden the scope to all business records. Full-quarter coverage is required only for the mapped accounts in the requested period; it does not imply that an external payroll report or quarter handover is required.

### 2. Load employee identity and rules from the authorized root

Resolve the profile's actual organization-data root first. If it contains an authorized `employees.md`, read only the relevant employee entry and applicable rule. This fictional excerpt shows the identity and rule fields needed; it is illustrative Markdown, not a required file schema:

```markdown
## Morgan
- employee_id: morgan
- names_and_aliases: Morgan; Morgan M.
- employee_account: masked CAD personal account ending 6620
- identity_and_personal_destination: human-confirmed 2027-06-30
- effective_dates: 2027-04-01 through 2027-06-30
- salary_rule: outgoing transfers to this confirmed personal destination are salary during the effective dates above
- salary_rule_confirmed: human, 2027-06-30
- named_transaction_mapping: human confirmed the April 15 CAD transfer with statement reference 7114 is a payment to Morgan's personal destination ending 6620; confirmation dated 2027-06-30 and effective for this Q2 example
- masked_transaction_mapping: the May 15 CAD statement description identifies destination suffix 6620, which matches Morgan's mapped personal account; the suffix is destination evidence, not a transaction reference

## Additional dated classification rule
- source: human instruction recorded 2027-06-30
- effective_dates: 2027-06-01 through 2027-06-30
- scope: the mapped CAD operating account, exact description `Online transfer sent - 1142`
- classification: salary; employee remains unknown
```

Read only the entry/rule that applies to Morgan and Q2. Preserve the source location and the exact selected rule/alias content used for its canonical content hash; do not use a hash of the whole mutable quarter summary as a rule binding.

If the file is absent, do not create one, search another profile, or guess a mapping. A named statement match may still answer the narrow lookup when its employee classification is supported. A name by itself does not establish a personal destination or salary. If a salary rule is supported but the employee is not, keep the amount in salary-unallocated; if the salary classification itself is unsupported, leave it unresolved.

### 3. Load existing derived evidence without deciding it is fresh

Look for the existing `<business>/q2/out/salary/salary-payments.json` only inside the authorized quarter folder. Compare its exact source roots and source inventory digest, each relevant source hash and coverage interval, the selected dated-rule content hash, and the employee-map hash (or `null` when no map was used).

Read the stored bindings only; they are the comparison target, not proof of currentness. Wait until step 4 has inventoried and hashed the current scope before deciding whether the projection can be reused. Do not re-extract anything yet.

### 4. Inventory only the mapped statements, in bounded batches

Use the profile-mapped folder for the one CAD account and the two exact USD accounts in step 1. List at most 20 filenames from one mapped account folder at a time; retain the continuation cursor and continue until that folder's relevant statement inventory is complete. Do not list unrelated businesses or accounts.

For each PDF, record its exact relative path and compute SHA-256 from the original PDF bytes with an authorized hash-capable tool. Inspect the printed statement start/end dates, account, and currency. Include statements whose printed coverage overlaps April 1–June 30, including a neighboring statement needed to cover a boundary date. Deduplicate copies by byte hash and keep one logical source; do not merge two different transactions because date and amount happen to match. Compare this complete bounded path/hash list with the existing projection before deciding which source must be processed.

The inventory shows three CAD bank statements covering the requested quarter and adjacent boundary dates, plus a statement interval for each of the two USD accounts used for transfer matching. Recompute the sorted path/hash inventory digest and compare all source intervals, selected rule content, and employee-map binding with the values loaded in step 3. In this example, only the June CAD statement hash changed. April/May and both USD bindings remain current. Reuse those stored rows and evidence; process only the changed June source in steps 5–6, then continue to step 7. If every binding matched, skip extraction and classification steps 5–7 and go to step 8 to validate the cached results and answer. If another source changed, process only its affected pages/rows. A changed unrelated sentence in the quarter summary does not invalidate the selected human rule.

There is no gap in the requested account periods. If a statement ends May 28 and the next starts June 2, coverage is partial for May 29–June 1: report that exact gap rather than assuming no payments.

### 5. Read each sidecar's real schema, then find candidate rows

Open only the adjacent CSV for the changed June source and inspect its actual header before choosing fields. This fictional RBC-like CSV uses the following observed fields; another bank may use different names:

```csv
bank,account,date,in_q2,amount,currency,original_description,normalized_name,source,page,statement_row,printed_balance,review_status
Fictional Bank,Operating account ending 4401,2027-06-15,true,-500.00,CAD,"Online transfer sent - 1142",,fictional-business/q2/statements/bank/june.pdf,2,7,8750.00,draft_extracted
```

Keep `amount` signed: `-500.00` is the derived sign for an outgoing debit; the PDF's debit column may print the positive magnitude. `page=2` is the sidecar's locator for the source page. `statement_row=7` is a sidecar extraction locator, not proof that the PDF prints row number 7. The reference `1142` is a candidate parsed from the original description; confirm it on the PDF before using it as the stable reference. The CSV stores its `original_description` exactly as read. Compute the source SHA-256 from the PDF itself; this example CSV has no hash column, so do not claim it does. If a sidecar claims a source binding, compare it to the computed original hash. A missing or mismatched binding makes that sidecar stale, not the PDF nonexistent.

Read only selected candidate fields in a bounded batch and keep the exact sidecar path, original source path, page, signed amount, currency, description, and parse/verification state. Do not use the filename, normalized name, or a truncated preview as the transaction evidence.

### 6. Recheck changed rows against original PDF pages

For the changed June statement, process a small page batch (for example, pages 1–3) and continue at the next exact page until the statement is covered. Keep each tool response within its actual character/byte output limit; if the reader limit counts characters, pass a character limit rather than a line count. Continue with the page cursor instead of repeating already validated pages.

The fictional original PDF page 2 has this account header and transaction row:

```text
Account: Operating account ending 4401
Statement period: June 1 to June 30, 2027
Currency: CAD
Date       Description                              Debit       Credit
15 Jun     Online transfer sent - 1142              500.00      —
```

The original PDF page supports the account, statement period, currency, date, debit direction, positive printed magnitude, and literal description. The adjacent CSV carries `-500.00`, the signed cash-flow representation; do not say the PDF printed a negative amount. The PDF text and the CSV's `original_description` both preserve the literal spacing `Online transfer sent - 1142`; the projection copies that original description without normalizing it. Use page 2 as the verified locator. The statement has no printed transaction-row number, so set projection `row` to `null`; never copy `statement_row=7` into the printed `row` field. If there is no stable reference, use verified page plus literal description, signed amount, and occurrence identity. If the PDF page or amount cannot be verified, mark that candidate pending and exclude it from subtotals.

The unchanged April and May rows retain their prior validated bindings. They are not re-extracted just because June changed. A sidecar/source conflict sends only the affected row back to the original PDF page; other unchanged rows remain reusable.

### 7. Classify each concrete candidate, preserving uncertainty

| Observed statement row | Classification evidence | Decision |
| --- | --- | --- |
| April 15, CAD debit `-1000.00`, reference `7114`, named Morgan | Its prior source hash, page, row facts, selected rule, and employee-map binding are unchanged in step 4; reuse this already verified record. A dated human mapping explicitly links this transaction reference to Morgan's confirmed personal destination; the name alone would not establish that link. | Retain in Morgan's CAD salary-paid subtotal without re-extracting the April source. |
| May 15, CAD debit `-500.00`, description `Online transfer sent to personal account ****6620` | Its prior source hash and bindings are unchanged in step 4; reuse this already verified record. The statement's masked destination suffix matches Morgan's effective-dated personal-account mapping. It is not a transaction reference, and the same salary rule applies to the confirmed destination. | Retain in Morgan's CAD salary-paid subtotal without re-extracting the May source. |
| June 15, CAD debit `-500.00`, reference `1142`, recurring description with no recipient | The changed PDF page and matching CSV row in steps 5–6 confirm the date, debit, amount, currency, reference, and exact description. A separately dated human rule covers this recurring description as salary but does not identify an employee. | Include in salary-unallocated CAD. Do not assign it to Morgan. |
| Recalled CAD 500 payment to Casey | No corresponding transaction row, date, or reference exists in the authorized statement scope. | Keep the recollection unresolved. Add no transaction row and do not add CAD 500 to any subtotal. |
| June 15 USD debit and equal USD credit in a second authorized account | The original pages show the same date, amount, currency, and transfer reference on both accounts. | Link both legs as one internal transfer and exclude them from salary; do not count the transfer twice. |

Apply dated human rules only within their effective period and exact account/description/identity scope. A recurring amount alone is a search clue, not proof of salary. Keep source-observed facts, human classification, payment matching, and employee attribution as distinct fields.

### 8. Calculate and check the evidence state

Sum the magnitudes of included negative CAD salary rows by employee: Morgan receives a statement-supported subtotal of **CAD 1,500** (`1,000 + 500`). The separate salary-unallocated subtotal is **CAD 500**. Preserve each source row's negative sign in the projection. Keep the matched USD transfer out of both salary subtotals and do not convert it to CAD.

The statement periods cover the requested CAD and USD accounts, so source coverage for those accounts is supported. Morgan-specific classification is supported for the two mapped rows. The unnamed CAD 500 row remains salary-unallocated. Casey's recollection remains unresolved. Payment matching is supported for the USD internal transfer. Overall review remains pending while the human-recalled payment is unmatched and the salary-unallocated recipient remains unknown. These independent states prevent a covered statement period from being mistaken for complete employee attribution.

### 9. Save only the authorized derived view

When the current profile/task authorizes this durable effect, write one file at `<business>/q2/out/salary/salary-payments.json`. The canonical fields and freshness rules are in the [approved salary projection contract](../flows/statement-reconstruction.flow.md#approved-salary-payment-projection). Though stored under `out/`, this JSON is explicitly a derived, non-posting, non-additive projection, not a source expense. The excerpt below shows the three verified CAD row decisions and currency-specific subtotals; angle-bracket values are instructions to compute from the source bytes, not verified hashes or IDs:

```json
{
  "schema_version": "statement-salary-projection.v1",
  "artifact_type": "statement_salary_payments",
  "derived": true,
  "posting": false,
  "additive_expense": false,
  "source_path_base": "reports/2027",
  "scope": {"business": "fictional-business", "year": 2027, "quarter": "Q2", "currency_basis": "original_statement_currency"},
  "coverage": {"status": "covered", "accounts": [{"account": "Operating account ending 4401", "currency": "CAD", "from": "2027-04-01", "through": "2027-06-30", "status": "covered"}, {"account": "Fictional USD account A", "currency": "USD", "from": "2027-04-01", "through": "2027-06-30", "status": "covered_for_transfer_match"}, {"account": "Fictional USD account B", "currency": "USD", "from": "2027-04-01", "through": "2027-06-30", "status": "covered_for_transfer_match"}], "missing": []},
  "rows": [
    {"payment_id": "<compute-from-source-hash-account-date-reference>", "account": "Operating account ending 4401", "date": "2027-04-15", "reference": "7114", "currency": "CAD", "signed_amount": "-1000.00", "source_path": "fictional-business/q2/statements/bank/april.pdf", "source_sha256": "<compute-from-original-PDF-bytes>", "page": 2, "row": null, "original_description": "Online transfer sent - 7114 Morgan", "employee_id": "morgan", "classification_status": "human_rule_confirmed", "salary_subtotal_inclusion": "included", "match_pending": false},
    {"payment_id": "<compute-from-source-hash-account-date-page-description-amount-occurrence>", "account": "Operating account ending 4401", "date": "2027-05-15", "reference": null, "currency": "CAD", "signed_amount": "-500.00", "source_path": "fictional-business/q2/statements/bank/may.pdf", "source_sha256": "<compute-from-original-PDF-bytes>", "page": 1, "row": null, "locator_type": "text_occurrence", "occurrence": 1, "original_description": "Online transfer sent to personal account ****6620", "employee_id": "morgan", "classification_status": "human_rule_confirmed", "salary_subtotal_inclusion": "included", "match_pending": false},
    {"payment_id": "<compute-from-source-hash-account-date-reference>", "account": "Operating account ending 4401", "date": "2027-06-15", "reference": "1142", "currency": "CAD", "signed_amount": "-500.00", "source_path": "fictional-business/q2/statements/bank/june.pdf", "source_sha256": "<compute-from-original-PDF-bytes>", "page": 2, "row": null, "original_description": "Online transfer sent - 1142", "employee_id": null, "classification_status": "human_rule_confirmed_employee_unallocated", "salary_subtotal_inclusion": "included", "match_pending": false}
  ],
  "employee_subtotals": [{"employee_id": "morgan", "currency": "CAD", "amount": "1500.00"}],
  "unallocated_subtotals": [{"currency": "CAD", "amount": "500.00"}],
  "review_state": "review_pending"
}
```

The actual file also includes the complete mapped source inventory, exact SHA-256 bindings, dated classification-rule bindings, pending items, and limitations required by the normative contract. Do not add an adjacent PDF or CSV for this derived JSON. Its location among `out/` records is a salary-topic grouping; its metadata keeps it separate from source expenses. If persistence is not authorized, do not write; return the result and say the durable projection is pending.

### 10. Recheck before answering and stop at the requested scope

Before saving or returning the result, verify that every `payment_id` is stable from source hash, account, date, and reference; no logical row is duplicated; each page/reference/hash resolves to its original source; and the arithmetic matches the included rows. Do not use a printed `row` value unless the PDF actually prints one. Check that CAD and USD remain separate and that the negative row sign is preserved while the “salary paid” subtotal is positive.

If the source inventory, source PDF hash, human-rule content, employee-map binding, or coverage changes, mark the projection stale and refresh only the affected rows. Resume at that source and page after validating unchanged bindings; do not rerun extraction for the whole quarter. A missing account interval makes coverage partial. A missing recipient makes employee attribution partial or unallocated, not zero. A missing authority or unavailable source blocks only its dependent operation.

The existing quarter summary links to the projection and states its status and limitations; it does not copy the rows or totals. Expense consumers exclude the derived view from additive ingestion and match the underlying statement row once. Stop when the requested statement-backed subtotal, separate unallocated amount, coverage, and unresolved cases are reproducible. Do not require unrelated quarter closure.

**Answer:** “The Q2 statements support **CAD 1,500 in salary cash paid to Morgan**: CAD 1,000 named in the statement and CAD 500 matched to Morgan's authorized masked-account record. Another CAD 500 is salary under the dated rule but remains employee-unallocated. Casey's recalled CAD 500 has no matching bank row and is unresolved. The USD debit and credit are one internal transfer and excluded. The covered statements do not establish gross payroll, deductions, or tax treatment.”

This worked case is fictional and has not been executed as a model benchmark or operational run.
