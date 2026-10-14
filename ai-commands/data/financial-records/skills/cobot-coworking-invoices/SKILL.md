---
name: cobot-coworking-invoices
description: Collect and normalize Le Quartier Général/Cobot coworking invoices from the authenticated membership portal, keeping each PDF beside one CSV and matching portal invoices to card settlements without double counting.
metadata:
  short-description: Extract Cobot coworking invoices
---

# Cobot coworking invoices

Use this skill when a financial-insights Bookkeeper needs source invoices from the Le Quartier Général Cobot membership portal. It applies to invoice collection, PDF extraction, vendor normalization, and invoice-to-card matching for a reporting quarter.

## Source collection

1. Open the authenticated Cobot membership page and use **Membership → Your Invoices**. Do not use a generic public search or invent an invoice from a bank row.
2. Select every invoice whose issue date belongs to the target quarter, plus any invoice needed to explain a target-quarter card charge. Open the individual invoice page and verify the visible invoice number, issue date, service period, paid date/status, subtotal/net amount, taxes, total, and payable amount.
3. Download the individual PDF from that invoice page. Keep the original PDF as the authoritative source. If the portal page says Paid but the PDF has no payment date, preserve both facts separately.
4. Store the PDF in the quarter’s existing coworking folder, normally `reports/YYYY/<org-or-workstream>/qN/out/co-working/`. Use one canonical basename per invoice, for example `le-quartier-general-invoice-2026-08-23-2026-2316.pdf`.

## Adjacent normalized record

Create exactly one same-basename `.csv` next to each retained PDF. Do not create a combined copy, extraction cache, or second CSV elsewhere. Follow the financial-records adjacent CSV schema used by neighboring records, including:

- `normalized_vendor=le-quartier-general`
- `document_type=invoice`, `currency=CAD`, `operational_quarter=qN`
- issue date in `document_date` with `date_role=issue_date`
- invoice number in `document_number`
- printed net amount in `subtotal`, combined TPS/TVQ in `gst` only when the source does not separate them, and printed total in `total`
- service-period text in `reporting_period` or `text`; do not replace the invoice date with the service period
- `source_relative_path` relative to the year reports root (`reports/YYYY/`) and a SHA-256 of the PDF
- `extraction_method=embedded_pdf_text`, `source_page=1`, and the relevant source text/evidence

Preserve French descriptions and accents in `text`; normalize only the vendor identity. Keep `raw_vendor` as printed and use the lowercase ASCII slug `le-quartier-general` for `normalized_vendor`.

## Payment matching and duplicate control

The Cobot portal’s Paid label/payment date and a Mastercard settlement describe one economic expense. Match by invoice amount, provider, card ending, and expected posting lag. Record the card date and lag in `review_notes`; never add the invoice total and card settlement together.

The following Q3 2026 matches are recorded examples from this intake; for a new quarter, revalidate every match against that quarter’s statement CSV/PDF before marking it verified:

- invoice 2026-2235, CAD 15.13, issued/paid July 22 → Mastercard posted July 22;
- invoice 2026-2250, CAD 78.18, issued July 23/paid July 28 → Mastercard posted July 28 (five-day lag);
- invoice 2026-2316, CAD 172.47, issued August 23/paid August 28 → Mastercard posted August 28 (five-day lag);
- invoice 2026-2410, CAD 114.98, issued September 23, service September 28–October 27 → portal shows Paid, but the service period crosses into Q4; leave period treatment or settlement matching review-pending until supported.

Set `review_required=no` and `review_status=verified` only when the PDF fields and payment match are supported. Use `review_required=yes` and an explicit `review_pending` status for missing settlement, cross-quarter treatment, or conflicting source evidence. A portal “Paid” status alone does not prove that the cash settlement belongs inside the reporting quarter.

## Completion check

Before reporting completion, confirm that every retained Cobot PDF has exactly one adjacent CSV with the exact same basename, every CSV points to an existing PDF under the year-root convention, hashes match, vendor normalization is consistent, and no basename collision or combined duplicate was created. If a collision or duplicate is found, validate the canonical survivor and its extraction first, preserve unique/conflicting evidence, use the authorized duplicate-cleanup route, and verify references after cleanup. Update the quarter summary with the invoice list, payment matches, posting lags, and any cross-quarter review item.
