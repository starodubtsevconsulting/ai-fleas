---
name: hydro-quebec-electricity-bills
description: Retrieve Hydro-Québec electricity bill PDFs through the visible Customer Space and create normalized source-adjacent extracts.
---

# Hydro-Québec electricity bills

Use this guide through the authorized Financial Insights Bookkeeper workflow. It covers electricity-bill evidence collection and extraction; it does not change contracts, payment methods, or account settings.

## Verify the account before downloading

Open the signed-in **Hydro-Québec Customer Space** and go to **Billing → Billing and payment history**. Confirm the account number and the **service address shown by the account’s “Service addresses” details**, not only the mailing address shown in the account list. Open that details view for every candidate account and record the address and contract number before collecting anything. The portal may expose several accounts; select the account whose service address belongs to the authorized organization or property. Do not use a personal account merely because it is visible in the session. If the target account is absent, or the service address cannot be verified, record the account-scope mismatch as `review_pending` and stop rather than downloading the wrong bills.

## Retrieve bills

For the requested quarter, open each bill whose invoice date or covered service period belongs to that quarter. Download the original PDF and verify the printed vendor, account/contract number, service address, invoice date, service start/end, amount before taxes, GST/QST, total, due date, and payment status. A portal payment label is not bank-settlement evidence; match the bill separately against the bank or card statement.

Save the PDF in the existing period/property folder, for example `reports/YYYY/<business>/qN/out/electricity/`. Use a stable basename derived from the printed bill or account identifier. Create exactly one normalized CSV beside the PDF with the same basename and a `.csv` extension. Do not create a second combined copy.

## Normalize and extract

The normalized CSV should include: `source_relative_path`, `source_sha256`, `operational_quarter`, `record_kind`, `vendor_normalized` (`hydro-quebec`), account/contract number, service address, invoice date, service start/end, due date, subtotal, GST, QST, total amount, currency (`CAD`), portal payment status, amount paid when printed, `review_status`, `extraction_status`, `accounting_role`, page reference, source locator, and settlement provenance. Preserve printed values and provenance; leave unavailable fields blank and mark the record `review_pending` rather than inferring them.

Before retaining a download, compare its bytes and bill identifier with existing records. If a duplicate exists, validate the canonical PDF/CSV pair first, preserve any unique conflicting evidence, then use the authorized duplicate-cleanup route and verify references afterward. Update the single quarter summary with covered bill periods, totals, account scope, source provenance, and access limitations. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).
