---
name: rbc-tax-payment-confirmations
description: Retrieve completed payroll-tax payment confirmations from RBC Business Online Banking's Can-Act Tax Filing Service, save normalized PDFs, and create adjacent CSV extracts.
---

# RBC tax-payment confirmations

Use this flow when a bank statement contains a tax debit whose confirmation document is missing.

## Route

1. In authenticated RBC Business Online Banking, open **Main → Tax Filing Services**.
2. Continue into the Can-Act Government Payment & Filing Service. The service may require a fresh RBC sign-in.
3. Open **Transaction history** and search a bounded date range containing the statement debit.
4. Match the transaction type, payment date, amount, and statement reference. Open the row to inspect the completed payment details.
5. Confirm the status is `Completed`, then capture the confirmation number, tax-account number, payment date, remittance or employee-payment period, due date, source account, and any payroll components.
6. Use the detail page's **Print** action, then Chrome **Save as PDF**. Save the PDF beside the mapped quarter's tax records with a normalized filename such as `rbc-tax-confirmation-YYYY-MM-DD-<program>-<reference>.pdf`. Keep actual confirmation and account identifiers only in the private source and adjacent extract.
7. Create one adjacent CSV with the same stem. Include the source PDF path and SHA-256, exact amounts, dates, confirmation number, tax account, status, period, and evidence text. Keep `posting_status=not_posted` unless an accountant-posting step explicitly changes it.
8. Update the matched RBC statement row and quarter summary. Replace `reference_only`/missing-document status only when the confirmation agrees on date, amount, account, and route.

## Guardrails

- A bank statement description is evidence of a debit, not the tax period or tax account. Never infer those fields when the Can-Act confirmation is unavailable.
- Distinguish `PAY` (Quebec payroll source deductions) from `EMPTX` (federal payroll deductions). Preserve the exact confirmation number, including hyphens and letters.
- Treat `Completed` as confirmation evidence, but keep the record unposted until the accountant workflow posts it.
- Keep the original bank statement untouched. Do not create a second combined extract; the PDF and CSV remain source-adjacent.
- If the portal has no matching row or only a future/scheduled payment, record a review-pending limitation and do not fabricate a confirmation PDF.
