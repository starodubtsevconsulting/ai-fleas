---
name: airbnb-reservation-reports
description: Collect Airbnb reservation-detail PDFs for accountant evidence, extract their payout and tax fields, and reconcile them to bank statements. Use this for Airbnb booking records; do not substitute monthly earnings summaries for reservation evidence.
---

# Airbnb reservation-detail reports

Use the Airbnb host reservation detail print view as the canonical PDF source for booking-level evidence. The preferred URL form is the reservation detail page with `legacy_hrd=true&print=true`.

## Procedure

1. In the authenticated Airbnb host account, open **Earnings → Paid** and enumerate every Q3 paid reservation. Use the detailed paid-transactions export as the cross-check so no booking is skipped.
2. Open each reservation's detail page, click the page's **Print** button, choose **Save as PDF** in the browser print dialog, click **Save**, and save one PDF per confirmation code. Do not use the monthly Earnings report download for this evidence.
3. Save the PDF in the mapped quarter source folder and create a same-basename CSV beside it. Preserve the source hash and page provenance.
4. Extract at least: confirmation code, guest, listing, check-in, checkout, booking date, nights, guest-paid room amount, guest-paid taxes, guest total, host room fee, host taxes, Airbnb service fee, co-host payout, host payout total, currency and source URL.
5. Normalize the vendor as `airbnb`, classify the record as a reservation-detail receipt/support record, and mark uncertain fields review-pending. Do not treat guest names or review text as accounting totals.
6. Reconcile the sum of host payout totals to the Airbnb paid-transactions export and to the matching deposits in the verified receiving account. Track Airbnb remitted-tax transfers separately as pass-through tax evidence; do not add them to rental income.
7. Keep the legacy reservation PDFs and adjacent CSVs as the accountant-facing booking evidence. Monthly earnings PDFs are optional summaries only; when the user selects legacy-only evidence, move monthly summary PDFs and their sidecars to the Synology recycle-bin path preserving their original relative path.

## Evidence and cleanup rules

- Never silently overwrite a reservation PDF or sidecar. A changed source hash requires renewed extraction.
- Do not count both a reservation-detail payout and its bank deposit as two income records.
- Keep the detailed paid-transactions CSV only when it adds reconciliation fields (for example remitted-tax rows or payout references); it is not an additional income total.
- Use the Synology reversible-removal contract for retiring superseded files. Do not use Mac Trash or purge the recycle bin.
- Folders beginning with `_` are internal and excluded from ordinary intake. Use `_notes` or `_legacy` only for explanatory markers, not as a substitute for the canonical source folder.
