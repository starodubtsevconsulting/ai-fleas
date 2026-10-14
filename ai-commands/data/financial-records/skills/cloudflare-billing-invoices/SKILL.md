---
name: cloudflare-billing-invoices
description: Retrieve Cloudflare consolidated billing invoices for a requested period through the visible dashboard and create normalized source-adjacent extracts.
---

# Cloudflare billing invoices

Use this guide through the authorized Financial Insights Bookkeeper workflow. It covers invoice evidence collection and extraction; it does not change Cloudflare configuration, plans, or payment methods.

## Retrieve invoices

In the signed-in Cloudflare dashboard, open **Manage account → Billing → Invoices and documents**. Cloudflare may show consolidated invoices rather than individual payment receipts. Review every listed date in the requested period. Verify the visible invoice date, invoice number, amount, and status, then use the row-actions menu and select **Download**. If authentication or an approval gate appears, stop for the human and continue from the resulting visible state.

## Normalize and extract

Use the printed invoice date and invoice number for the canonical filename, never the generated download filename. Keep the PDF and its CSV beside each other under the existing period/vendor folder. The CSV should include source-relative path, source SHA-256, quarter, vendor normalized as `Cloudflare`, invoice number/date, amount, currency, paid status, payment method and last four digits when visible, review status, extraction status, and an accounting-role note. Keep one CSV per source and do not create a combined duplicate.

Before retaining a download, compare its bytes/content and invoice number with existing records. Do not retain duplicates. Treat the consolidated invoice as source evidence; do not infer separate receipts or bank settlement from it. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).
