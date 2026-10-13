---
name: wave-invoices
description: Retrieve Wave sales invoice PDFs for a requested period through the visible browser. Use for invoice evidence collection, not invoice edits, payment recording, or customer messaging.
---

# Wave sales invoices

Use this guide through the authorized Financial Insights Bookkeeper workflow. It describes visible browser navigation only; it adds no `financial-records` command ID or executable browser/PDF extraction support. Human authentication and any account access gates remain with the human.

Retrieve requested sales invoice PDFs from the correct signed-in Wave business. Do not edit invoices, change their status, record payments, send invoices, or send reminders.

## Find the requested invoices

The observed signed-in route is **Sales & Payments → Invoices**. The page initially selects **Unpaid**, which can omit paid invoices. Switch to the **All invoices** tab, enter the full requested quarter in the **From** and **To** fields, then select **Search**. Verify the visible filters and that customer/status filters cover the requested scope (observed as **All customers** and **All statuses**). In an observed Q3 search, the exact quarter range returned three invoices and zero drafts; this verified the all-invoices/date-filter completeness sequence for that request. For other periods, businesses, or UI states, verify the visible result count, range, and statuses before claiming coverage. Check each result's invoice date and due date separately; the due date is not the invoice date. Identify draft status and report whether drafts are included in the requested scope or remain excluded/pending.

Open each in-scope invoice and confirm its printed invoice date, invoice number, status, and requested business/period before download. If an authentication or approval gate appears, stop for the human to complete it and continue from the resulting visible state.

For each confirmed invoice, use **More actions → Export as PDF**, then the **Export to PDF** modal's **Download PDF** action. The observed downloaded filename used the due date. Normalize and identify files using the invoice's printed invoice date and invoice number, never the download filename alone.

## Preserve and report evidence

Before adding a PDF, compare it with existing records by actual bytes/content and inspect any validated adjacent sidecar. Do not retain a duplicate. Preserve unique evidence and existing canonical sources; only perform duplicate cleanup when the authorized workflow permits it and the surviving record and its references have been validated.

Use the existing authorized period/section mapping. Keep a source-adjacent CSV/JSON only when an applicable supported extraction route produces and validates it; this skill does not implement generic invoice extraction. Maintain the single quarter summary with invoice coverage, source provenance, skipped drafts, and unresolved items. Wave's **Unpaid** status is application state, not proof that money remains unpaid; payment status requires separate bank/reconciliation evidence. Collection alone does not establish reconciliation or quarter closure.

Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md) for canonical records, sidecars, quarter summary, and authorized cleanup.
