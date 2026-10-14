---
name: openai-billing-invoices
description: Retrieve OpenAI Platform billing invoice PDFs for a requested period through the visible browser and create normalized source-adjacent extracts.
---

# OpenAI billing invoices

Use this guide through the authorized Financial Insights Bookkeeper workflow. It covers invoice evidence collection and extraction; it does not edit billing settings, change payment methods, or send messages.

## Retrieve invoices

Open **OpenAI Platform → organization settings → Billing → Billing history** in the signed-in browser. If authentication or a human approval gate appears, stop for the human and continue from the resulting visible state. Use the billing-history date/order and pagination to cover the complete requested period; do not assume the first page is complete.

For each in-period row, verify the visible invoice number, created date, amount, and status. Open **View**, then verify the invoice page's printed number, payment date, amount, paid state, and payment method before selecting **Download invoice**. A paid invoice page is evidence of the invoice's paid state; it is not a bank settlement record.

## Normalize and extract

Use the printed invoice number and invoice date for the canonical filename, never the browser download filename. Keep the PDF and its CSV beside each other in the existing period/vendor folder. The CSV should include source-relative path, source SHA-256, quarter, vendor normalized as `OpenAI`, invoice number/date, amount, currency, paid status, payment method and last four digits when visible, review status, extraction status, and an accounting-role note. Keep one CSV per source; do not create a duplicate combined copy.

Before retaining a download, compare its bytes/content and invoice number with existing records. Do not retain duplicates. Update the single quarter summary with the covered invoice range, source provenance, and unresolved pages or access limitations. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).
