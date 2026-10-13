# Worked solution: AI spending

Fictional instructional example; no files described here were executed or measured.

**Request:** “How much did I spend on AI in Q2 2027?”

**Short plan:** resolve card-purchase spending scope; discover outgoing documents and statements; normalize candidate transactions; reconcile duplicates and refunds; calculate supported CAD spending and state coverage. Use settled merchant purchases and credits by transaction date; do not count later payments of the card balance as additional spending.

1. **Map the request before searching.** Read applicable rules and profile mapping. The invented organization has `2027/studio/Q2/{out,statements}` and `2027/consulting/Q2/{out,statements}`. For this example, “spent” means settled merchant purchases and credits with transaction dates April 1–June 30, including tax. State that basis in the answer. Search both businesses; `in` is unnecessary for this question. Why: folder placement alone does not establish payment, date, or category.
2. **Inventory sources, then reuse JSON.** List each mapped `out` section in bounded batches, retaining PDF files with no sidecar. Read only vendor, description, dates, total/currency, payment references, and source links from JSON. Invented observations: `studio/Q2/out/draft-ai-april.pdf` has matching JSON; `consulting/Q2/out/model-api-may.pdf` has none; an upgrade receipt already nets a credit. Extract the missing receipt's first page through the authorized extractor into private evidence. It shows USD 10.00. Why: JSON accelerates reading but is not the source inventory.
3. **Scan statement rows independently.** Read transaction arrays from both businesses' statement sidecars, in page batches. `2027/studio/Q2/statements/card-june.json` reports `total: 500.00, currency: USD` and only three preview rows. Inspect its PDF pages 1–2: CAD 500.00 is the account balance, while a CAD 15.00 “Voice Orchard AI” charge on June 2 appears on page 2. Inspect the other statement: the USD 10.00 API receipt settled as CAD 14.00. Why: a balance is not spending, previews are incomplete, and an AI vendor can appear only in statements.
4. **Normalize before summing.** Use original source content to resolve the erroneous balance/currency field. Preserve both currencies and link receipt and statement evidence to one payment identity. Inspect relevant pages when text is unclear; if pages cannot be inspected, leave the disputed field unresolved. The invented rows below are the work table, not separate sums of receipts and statements.

| Transaction date | Transaction | Original amount | CAD settlement | Decision | Source relative to reports root |
| --- | --- | ---: | ---: | --- | --- |
| Apr 8 | Draft Lantern AI | CAD 20.00 | 20.00 | Include once; receipt and statement agree | `2027/studio/Q2/out/draft-ai-april.pdf` p1; `2027/studio/Q2/statements/card-april.pdf` p2 row 4 |
| May 12 | Model Grove API | USD 10.00 | 14.00 | Include settlement, retain USD charge | `2027/consulting/Q2/out/model-api-may.pdf` p1; `2027/consulting/Q2/statements/card-may.pdf` p2 row 3 |
| May 20 | Draft Lantern upgrade | CAD 40.00 less CAD 10.00 embedded credit | 30.00 | Include net payment once | `2027/studio/Q2/out/draft-upgrade.pdf` p1; `2027/studio/Q2/statements/card-may.pdf` p2 row 6 |
| May 28 | Draft Lantern refund | CAD -5.00 | -5.00 | Include independent settled refund | `2027/studio/Q2/statements/card-may.pdf` p2 row 9 |
| Jun 2 | Voice Orchard AI | CAD 15.00 | 15.00 | Include statement-only payment; receipt/tax detail missing | `2027/studio/Q2/statements/card-june.pdf` p2 row 7 |
| Mar 31 | Draft Lantern prior charge | CAD 9.00 | 9.00 | Exclude by transaction date despite Q2 filing | `2027/studio/Q2/out/prior-charge.pdf` p1; `2027/studio/Q2/statements/card-april.pdf` p2 row 1 |

5. **Reconcile identity and coverage.** The duplicate `draft-ai-april-copy.pdf` has the same receipt/reference as the April row: attach it as evidence, add no payment. Do not subtract the upgrade's embedded CAD 10.00 credit again. Both statement sets cover April 1–June 20 only; June 21–30 has no account evidence. Record the gap and any missing accounts. Why: five included rows can establish a subtotal without proving full-quarter coverage.
6. **Calculate and answer.** Integer cents: `2000 + 1400 + 3000 - 500 + 1500 = 7400`. Gross positive payments are CAD 79.00; the settled refund reduces net spending to CAD 74.00. USD 10.00 is retained as the original charge and is not added again.

**Answer:** “The supported Q2 2027 AI card-purchase spending subtotal is **CAD 74.00**, including tax where charged and net of the CAD 5.00 refund. Sources support April 1–June 20; June 21–30 remains uncovered, so this is not a complete quarter total.” Attach the included rows, exclusions, and coverage above.

**Adapt:** discover vendor/category terms from content, not a fixed vendor list. If a settlement amount is missing, report that original currency separately. If a statement cannot be extracted, retain supported receipt facts but do not infer payment. If the user asks invoiced cost or tax-exclusive expense, change the basis explicitly and repeat the relevant reconciliation. A timed-out batch is retried narrowly from the last checkpoint, not discarded.
