---
name: newegg-purchase-invoices
description: Collect Newegg Canada purchase invoices through the visible browser and create normalized source-adjacent extracts for hardware and equipment records.
---

# Newegg purchase invoices

Use this skill in the authorized Financial Insights Bookkeeper workflow when a Newegg Canada invoice is the source for a business hardware or equipment purchase. It covers evidence collection and extraction; it does not decide capitalization, personal use, tax eligibility, or bank settlement without supporting evidence.

## Retrieve and preserve

Open the signed-in Newegg order or invoice page in the visible browser. For each requested in-period invoice, verify the printed invoice number, invoice date, bill-to and ship-to identity, line items, discount, taxes, total, currency, and payment terms before downloading. If the source is a shared Drive PDF, download the original file once and inspect the PDF itself; the Drive filename is not the canonical accounting filename.

Keep the unchanged PDF and one normalized CSV beside each other in the existing period/vendor folder. Use a stable filename containing vendor, invoice date, and invoice number. Compare invoice number, contents, and source hash with existing records before retaining a download; do not create a duplicate or a combined Newegg export.

## Normalize and extract

Use `normalized_vendor=newegg-canada`, `document_type=vendor_invoice`, and the printed invoice date as `document_date`. Preserve invoice number, SKU/item number, item description, quantity, unit/extended prices, discounts, subtotal, GST/HST, PST/QST, shipping, total, currency, payment terms, customer number, and the bill-to/ship-to evidence in the CSV or notes. Use `posting_status=not_posted` and `review_required=yes` until a matching statement transaction and business-use treatment are established. A printed VISA/CAD term is payment-method evidence, not proof that the bank statement has been matched.

Hardware such as a computer or monitor may be a capital asset, a business expense, or a mixed/personal purchase. Preserve the line items and flag the classification for accountant review; never split or capitalize it from the invoice alone. Link a statement row only when date, amount, card/account evidence, and vendor support the match. Keep the invoice total separate from any later statement or reimbursement record.

## Verification

Confirm the CSV shares the PDF basename and directory, the source SHA-256 matches the retained PDF, arithmetic agrees (`subtotal + GST/HST + PST/QST + shipping = total` after discounts), and the invoice number/date/total match the PDF. Update the single quarter summary with the source provenance, retained record, duplicate decision, payment-match status, and unresolved asset or tax questions. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).
