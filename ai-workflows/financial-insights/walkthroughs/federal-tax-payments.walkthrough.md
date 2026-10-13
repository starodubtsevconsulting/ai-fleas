# Worked use case: federal taxes paid

Fictional instructional example; these files and observations are invented, not executed evidence or tax advice.

**Request:** “How much tax did I pay to the federal government in Q2 2027?”

**Plan:** resolve the authorized organization and accounts; use April 1–June 30 posted payments; search remittance records and statements independently; identify the federal program; match payment instructions to settled debits; calculate once per payment. Apply the general [tax-payment method](tax-payments.walkthrough.md), adapting the jurisdiction rather than copying its facts.

1. **Discover by payment coverage.** Resolve the actual reports mapping and read its rules. Inventory the mapped Q2 outgoing tax records and account statements in bounded batches. Also search adjacent quarters: a Q1 liability can settle in April, and a June confirmation may have been filed under Q3. The folder and print dates do not determine inclusion.
2. **Read and classify.** Pair originals with sidecars and extract missing fields into private evidence. Retain recipient, federal program, liability period, requested date, posted date, status, currency, amount, and reference. A generic bank label such as “commercial taxes” does not establish federal jurisdiction; match its reference to a document identifying the recipient and program.
3. **Establish settlement.** The fictional Q1 payroll form totals CAD 310.00. Its instruction is marked “To be processed”; the April statement supplies the matching posted debit. A corporation instalment confirmation stored in Q3 requests CAD 120.00 on June 28, and the June statement confirms that debit. Count both on the Q2 payment basis. A Q2 payroll instruction requests payment July 14: retain it as an obligation/payment request outside Q2, not a Q2 cash payment.

| Original evidence | Recipient / program | Liability period | Requested / posted | CAD | Decision |
| --- | --- | --- | --- | ---: | --- |
| `2027/studio/Q1/out/taxes/payroll.pdf` p1; `2027/studio/Q2/statements/april.pdf` p1 row 6, reference `EX-F0412` | Federal revenue authority / payroll remittance | Q1 | Apr 12 / Apr 12 | 310.00 | Include once |
| `2027/studio/Q3/out/taxes/instalment.pdf` p1; `2027/studio/Q2/statements/june.pdf` p2 row 4, reference `EX-F0628` | Federal revenue authority / corporation instalment | Current tax year | Jun 28 / Jun 28 | 120.00 | Include despite Q3 filing location |
| `2027/studio/Q2/out/taxes/payroll-request.pdf` p1 | Federal revenue authority / payroll remittance | Q2 | Jul 14 / unknown | 310.00 | Exclude from Q2 cash; settlement unproven |
| `2027/studio/Q2/statements/april.pdf` p1 row 7 | Provincial revenue authority / documented provincial remittance | Q1 | unknown / Apr 13 | 840.00 | Exclude from federal subtotal |

4. **Reconcile and complete coverage.** Match account, reference, amount/currency, and dates; investigate conflicts. Deduplicate repeated statements and confirmation/statement representations. Inspect original statement columns if extraction loses debit/credit direction. Finish all relevant statement batches and report missing accounts or dates. Keep provincial, municipal, unknown-program payments, and unclassified government credits separate. A payroll remittance may include contributions: retain its documented components rather than calling every dollar income tax.
5. **Calculate and answer.** With complete April–June coverage for the supplied account, use integer cents: `31,000 + 12,000 = 43,000`, or **CAD 430.00**. Do not add the July instruction or provincial remittance.

**Answer:** “The supplied organization's account confirms **CAD 430.00 paid in federal tax remittances during Q2 2027**: CAD 310.00 payroll remittance on April 12 and CAD 120.00 corporation instalment on June 28. The July payroll request is outside the payment period. This covers the supplied account, not personal taxes or undisclosed accounts.” Attach the source-linked rows and coverage record.

**Recover:** if the instruction is available but the matching bank period is missing, report it as scheduled/unproven and return only the confirmed subtotal. If a bank debit has no reliable jurisdiction/program match, retain it unresolved. A cache may point to sources, but cannot substitute for those checks.
