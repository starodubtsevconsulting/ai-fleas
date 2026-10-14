---
name: stripe-transaction-export
description: Export and normalize Stripe transaction activity for an authorized account, including an explicit zero-row export when the selected period has no activity.
---

# Stripe transaction export

Use this skill for an account whose display name, legal owner and purpose have been verified against the selected private organization profile. Do not put the real display name or account identifier in a public skill.

1. Open the authenticated Stripe Dashboard and go to **Transactions**.
2. Select **Export**.
3. Choose **Custom** and set the exact requested period dates in UTC when supported. Verify the portal's timezone and record the effective date bounds with the export.
4. Keep the default transaction columns unless the accounting request requires a documented addition.
5. Export the CSV and wait for Stripe to show **Your export is ready**. Download the completed CSV.
6. Store one normalized, source-native CSV in the mapped quarter's `statements/stripe/` folder. Do not invent a PDF for a CSV-native Stripe export and do not create a second accounting extract from the same download.
7. Verify the row count, date bounds, currencies, gross amounts, fees, net amounts, payout rows, and metadata fields. A header-only file with zero rows is valid evidence of no Stripe activity for the selected period, provided the export period and account are recorded.
8. Match non-empty exports to the bank payout rows. Keep Stripe charges, fees, and payouts distinct; a payout is a settlement transfer and must not be counted as a second sale.

Record the account name, exact export dates, download filename, row count, and any bank matching result in the quarter summary. Preserve the downloaded CSV as the evidence source.
