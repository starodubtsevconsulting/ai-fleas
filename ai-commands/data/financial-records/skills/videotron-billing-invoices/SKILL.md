---
name: videotron-billing-invoices
description: Retrieve Vidéotron phone and internet invoice PDFs through the visible customer portal and create normalized source-adjacent extracts.
---

# Vidéotron billing invoices

Use this guide through the authorized Financial Insights Bookkeeper workflow. It covers invoice evidence collection and extraction; it does not change services, payment methods, or account settings.

## Retrieve invoices

Open **Vidéotron → Connexion** in the signed-in browser. Vidéotron's current sign-in may require the customer ID rather than the email address; use the saved browser credential or ask the human for that ID when the browser cannot supply it. If a one-time code, reCAPTCHA, or other approval gate appears, stop for the human and continue from the visible resulting state.

After sign-in, open **Compte client → Factures/Mes factures**. Select the requested quarter and cover every invoice whose service period or invoice date belongs to that quarter. For each row, open the invoice and verify the printed vendor, invoice number, invoice date, service period, subtotal, taxes, total, due date, and portal payment status. Download the PDF. If the portal offers a line-item or account-details CSV, keep it only when it contains unique detail and does not collide with the normalized extract. Always create the normalized CSV beside the PDF.

Do not treat a portal's “paid” label as bank-settlement evidence. Match settlement separately against the bank or card statement when that evidence is available.

## Normalize and extract

Use the printed invoice number and invoice date for the canonical filename, never the browser download filename. Keep each PDF and its normalized CSV beside each other with exactly the same basename and different extensions in the mapped period/vendor folder, for example `reports/YYYY/<business>/qN/out/internet & phones/`. Use one normalized CSV per source and do not create a competing combined copy. Keep any unique native detail export separately with a clear `-details.csv` suffix.

The normalized CSV should include: source-relative path, source SHA-256, `operational_quarter`, `record_kind`, `vendor_normalized` (`videotron`), invoice number/date, service start/end, due date, printed subtotal, GST, QST, total amount, currency (`CAD`), portal status, amount paid when printed, review status, extraction status, accounting role, page reference, source locator, and settlement provenance. Preserve printed values and their page/source provenance; leave unavailable fields blank and mark the record `review_pending` rather than inferring them.

Before retaining a download, compare its bytes and invoice number with existing records. If a duplicate exists, validate the canonical survivor and its extraction first, preserve unique or conflicting evidence, then use the authorized duplicate-cleanup route and verify references afterward. Update the single quarter summary with the covered invoice periods, totals, source provenance, and any access limitations. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).
