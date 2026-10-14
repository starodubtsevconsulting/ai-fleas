---
name: grok-billing-invoices
description: Retrieve Grok xAI subscription invoices for a requested period through the visible browser and create normalized source-adjacent extracts.
---

# Grok xAI billing invoices

Use this guide through the authorized Financial Insights Bookkeeper workflow. It covers invoice evidence collection and extraction; it does not edit subscriptions, cancel plans, change payment methods, or send messages.

## Retrieve invoices

In the signed-in Grok browser, open **Account menu → Settings → Billing → Manage**. This opens the Stripe customer billing portal. Review **Invoice history** and select each requested-period entry. Skip entries outside the requested quarter. On each invoice page, verify the printed invoice number, payment date, amount, paid state, and payment method, then select **Download invoice**. If authentication or an approval gate appears, stop for the human and continue from the resulting visible state.

## Normalize and extract

Use the printed invoice number and payment date for the canonical filename, never the browser download filename. Keep the PDF and its CSV beside each other under the existing period/vendor folder. The CSV should include source-relative path, source SHA-256, quarter, vendor normalized as `Grok`, invoice number/date, amount, currency, paid status, payment method and last four digits when visible, review status, extraction status, and an accounting-role note. Keep one CSV per source and do not create a combined duplicate.

Before retaining a download, compare its bytes/content and invoice number with existing records. Do not retain duplicates. Update the single quarter summary with the covered invoice dates, source provenance, and unresolved history pages. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).
