---
name: cibc-mortgage-details
description: Retrieve CIBC mortgage details through the visible signed-in browser and create a normalized source-adjacent extract from the printed visual page.
---

# CIBC mortgage details

Use this guide through the authorized Financial Insights Bookkeeper workflow. It covers read-only mortgage evidence collection and extraction; it does not change payments, loan settings, or account information.

## Retrieve the visual record

Open the signed-in **CIBC Online Banking** dashboard. Select the mortgage under **Lending Accounts**, verify the mortgage number and account balance, and open the detailed view. Confirm the visible payment history includes the requested quarter. Use the page's **Print page** action and save the rendered page as a PDF. If CIBC requests additional authentication or the session is not signed in, stop for the human and continue from the visible resulting state.

The printed page is the source record. Preserve the PDF bytes and record the retrieval date. Do not treat the current balance as a Q3 expense and do not infer tax treatment from the page.

## Normalize and extract

Keep the PDF and normalized CSV beside each other in the mapped business quarter's mortgage folder, for example `reports/YYYY/<business>/qN/out/mortgage/`, with the same basename and different extensions. Extract the account number, mortgage number, currency, as-of date, balance, payment frequency and amount, fixed/variable rate, maturity date and balance, and each requested-period payment's date, principal, interest and total paid. Use the visible labels and page references; leave unavailable fields blank and mark them `review_pending` rather than inferring them.

The mortgage principal and interest are different accounting roles. Principal reduces the loan balance and is not an expense. Interest is a financing-cost candidate that still requires business/property allocation and accountant review. Match each payment to the bank statement separately; the mortgage page is not settlement evidence. Do not count the same payment from both the mortgage page and the bank statement.

Before retaining a download, compare its bytes and account/mortgage identifiers with existing records. If a duplicate exists, validate the canonical survivor and its extract before using the authorized duplicate-cleanup route. Update the single quarter summary with the covered payment dates, principal/interest totals, source provenance, and any missing insurance or settlement evidence. Follow the record organization flow.
