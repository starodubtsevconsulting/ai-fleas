---
name: aws-billing-invoices
description: Retrieve AWS billing invoice PDFs for a requested period through the visible browser. Use for vendor invoice evidence, not AWS account changes or payment actions.
---

# AWS billing invoices

Use this guide through the authorized Financial Insights Bookkeeper workflow. It describes visible browser navigation only; it adds no AWS command, provider adapter, generic PDF extraction, or browser runtime. Human authentication and account access gates remain with the human.

## Retrieve the requested invoices

1. In the signed-in AWS console, open **Billing and Cost Management → Bills → Invoices**. Verify the selected payer/business context and billing period before collecting anything.
2. Select each billing period overlapping the requested accounting period. Record the invoice number, invoice date, service/billing period, printed currencies, taxes, and total from the invoice. Do not infer the accounting period from the download date or filename.
3. Open the invoice PDF from its invoice-number link and save/download it. Do not change payment methods, billing settings, account access, or make payments.
4. If an authentication, approval, or access gate appears, pause for the human. Continue only from the visible authorized state.
5. Check the requested quarter's payment basis against the authorized bank/card statement. Match vendor, amount, currency, and transaction/posting date; an invoice alone does not prove payment. Preserve service period separately from invoice date and cash period. An invoice issued after quarter end is not a quarter invoice merely because its service period overlaps; record it according to the established accounting basis and leave classification for review.

## Normalize, extract, and validate

Return every downloaded source to the authorized Bookkeeper Process stage. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md) and the [duplicate-cleanup flow](../../../../../ai-workflows/financial-insights/flows/duplicate-cleanup.flow.md): normalize the canonical source name from printed invoice date, invoice number, and vendor; preserve original bytes; create the applicable source-adjacent CSV/JSON using an actually supported extraction route; verify source-hash binding, page coverage, labeled totals/taxes/currency and exact statement match; then remove only verified redundant downloads through the authorized cleanup route. Keep a downloaded file in place if normalization/extraction or survivor validation is pending.

Use the existing profile-mapped quarter folders and single quarter summary. Keep one canonical PDF with its adjacent extracted data, not a second aggregate copy. Record out-of-period invoices as excluded from quarter coverage or route them under the profile's accounting basis. An unmatched or ambiguous invoice remains review-pending with a concrete next action.

## Limits

This procedure is browser guidance, not proof that AWS retrieval is automated or that a PDF extractor is available. Do not claim extraction complete unless a supported route produced a source-bound, validated sidecar. Collection and statement matching do not establish business allocation, posting, tax treatment, accountant readiness, or quarter closure. Follow the Financial Records command's persistence and review gates.
