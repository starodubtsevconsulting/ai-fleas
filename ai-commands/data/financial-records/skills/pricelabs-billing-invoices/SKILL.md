---
name: pricelabs-billing-invoices
description: Collect and normalize PriceLabs Dynamic Pricing invoices and their listing-detail exports for financial-records intake.
---

# PriceLabs billing invoices

Use this skill when a signed-in PriceLabs account is the source for vendor invoices. The source of record is the invoice PDF; the optional native CSV is a listing-detail export and does not contain the invoice total.

## Route

1. Open the authenticated PriceLabs account.
2. Open the account menu, choose **Billing**, then **Dynamic Pricing Invoices**.
3. Review invoice number, service start/end dates, due date, paid date, amount due, amount paid, and status before downloading.
4. Download the PDF and, when useful for listing context, the adjacent native CSV. In Chrome’s PDF viewer, use **Download** and save the PDF with a stable vendor/invoice filename.
5. Keep one normalized CSV beside each retained PDF. Preserve the PDF unchanged and bind the CSV to its SHA-256 hash.

## Normalization

Use `vendor_normalized=pricelabs`, `record_kind=vendor_invoice`, `currency=USD`, and `accounting_role=business expense`. Preserve invoice number, invoice date, service dates, due date, paid date, amount, amount paid, and printed status. Mark fully paid invoices `review_status=confirmed` only for the invoice record; bank settlement matching remains separate. Mark unpaid or outstanding invoices `review_status=review_pending`, keep `amount_paid=0.00` when printed, and never infer that payment occurred.

Assign `operational_quarter` from the requested period and the source's service dates. If the service period crosses a quarter boundary, record that in notes and do not move the source out of its source-adjacent folder. The invoice date may be later than the service start.

PriceLabs’ native listing-details CSV lists the billed listing and sync metadata. It is supporting context only, not a second invoice total. Preserve it beside the PDF with a `-details.csv` suffix when it contains unique listing or sync evidence; remove only byte-identical duplicate downloads after validating the survivor. The normalized invoice CSV remains the accounting extract. Never create a combined export; regenerate one from adjacent CSVs when needed.

## Verification

Check that the normalized CSV’s invoice number, dates, amount, paid status, and amount paid match the PDF. Record PDF page/field provenance and the native listing-details URL when present. Confirm the PDF and normalized CSV share the same basename and directory, the source hash matches the retained PDF, and any retained `-details.csv` is unique evidence rather than a duplicate download. For an unpaid invoice, confirm the source explicitly says unpaid/outstanding and leave settlement matching for later bank reconciliation.
