---
name: wise-statements
description: Download official Wise balance statements through the visible browser for a specified account, currency, and period. Use for accounting statement collection, not payments or account changes.
---

# Wise statements

Use this command-owned operational browser skill only through an initialized caller whose selected profile authorizes the
[`statements` command](../../statements.command.md). Resolve the requested Wise account, browser access, and source/destination authorization from the effective scope and current direct human instructions where allowed. An open tab does not establish account or workflow identity. This guide adds no command ID or executable operation. The existing `tax-candidates` CLI does not download statements through a browser.

Collect an official balance statement for the requested account, currency, and exact period. An activity export labeled “This is not an official statement” does not satisfy this request.

## Browser workflow

Use the current host's supported browser control and its visible UI state. Follow observed controls; do not use hidden APIs or guess selectors. Let the human complete login or authentication when needed.

The observed signed-in Wise path is:

1. From Home, select the requested currency balance.
2. Open **More → Statements and reports → Statements**. Choose Statements rather than Transaction exports.
3. Select **Create a statement**.
4. Set the exact date range. **Last quarter** is relative to today: verify its explicit start and end dates against the request, or use a custom range.
5. Verify currency and select **Don't repeat** for a one-time statement; do not create a recurring schedule.
6. Select **PDF**. Fees shown separately and stamp/sign are optional choices; preserve the user's preferences and report selected options.
7. Generate, then inspect **Statement summary** for dates, currency, PDF format, fees, and stamp/sign settings before **Download statement**.

Wise may show **Approve this using app** during download. Ask the human to approve the Wise mobile notification, wait, and inspect the resulting browser state. If approval is pending or fails, report that actual blocker; never claim completion or bypass authentication.

This navigation was observed through mobile approval and a completed PDF download. Native CSV export was not verified; inspect the current UI if that option is needed.

## Save and verify

After a successful download, inspect the original PDF for the requested period and currency, opening/closing balances, and official statement identity. Investigate any “not an official statement” label before marking the requirement satisfied. Save only to the authorized destination, preserve the original, and avoid overwriting an existing file.

For extraction, inspect the actual column headings: in the observed PDF, **Incoming** and **Outgoing** are movements, while **Amount** is the running balance. Rows run newest first. With fees shown separately, fee rows are separate movements; the transfer outgoing excludes that fee, so do not deduct a fee again merely because its description mentions it. Legal/stamp pages may contain no transaction rows. Verify running balances and avoid double counting.

If CSV is requested, use a native CSV for the same period when the visible UI supports it; otherwise perform authorized extraction. Keep exact signed amounts, transaction dates, original descriptions, and source/page provenance. Preserve uncertainty or review flags rather than converting drafts into confirmed records. Place the one-to-one CSV beside its PDF with the same basename; follow existing JSON naming when applicable. Compose combined data on demand instead of saving redundant copies.

Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md) within the authorized mapping. Update the single authorized quarter summary with the collected statement and remaining gaps. Collection does not establish reconciliation, accountant approval, or quarter closure.
