---
name: booking-commission-invoices
description: Collect Booking.com property commission invoice PDFs from the Extranet, create source-adjacent extracts and compare them with bank fee debits.
---

# Booking.com commission invoices

Use within the authorized Financial Insights Bookkeeper scope. This is visible-browser collection guidance, not an executable financial-records adapter or permission to pay invoices.

## Collect the correct property and periods

1. Open the existing Booking.com Extranet session. Use saved browser autofill for ordinary sign-in; hand authentication challenges to the human when required. Never store credentials or session-bearing URLs in the skill or extracted records.
2. Confirm the property name, accommodation ID and service address against the selected organization context or existing source documents. Mailing and service addresses can differ. Stop dependent collection if the property cannot be verified.
3. Open **Finance → Invoices and documents**, choose the requested year and inspect the invoice number, issue date, service period, payment date, status and currency. Commission periods use reservation **check-out dates**, not arrival dates.
4. Collect invoices needed for both quarter cash payments and quarter service coverage: a July invoice can cover June; an October invoice can cover September. Preserve all three dates/bases rather than treating folder placement as accounting recognition.
5. Open the row's **PDF**, verify the printed invoice number, date, service period, commission amount, due date and masked debit account, then use the PDF viewer's **Download** control. Save directly into the mapped business quarter's existing `out` provider folder using a basename such as `expense-invoice-YYYY-MM-DD-INVOICE-booking-com`. Do not download an existing validated invoice again or use **Download all** when only a bounded period is needed.

## Extract and match

Keep one validated same-basename CSV beside each PDF. Preserve source-relative path, SHA-256, page provenance, original vendor, normalized vendor `booking-com`, accommodation identity, invoice number/date, service start/end, due date, currency, commission and total due. Keep the printed **Room Sales** amount in its own field: it is the commission calculation base, not the expense amount or proof of business revenue. Leave tax fields unprinted by the invoice unknown rather than inventing zero tax.

Record portal status/payment date separately with observation date and a stable locator such as property ID plus invoice number; omit authentication tokens. Independently inspect the bank statement for account, vendor, amount, currency, date and any shared reference. An equal amount and compatible timing support a candidate match; absent an invoice reference, keep the linkage review-pending as appropriate. Portal payment dates can precede bank posting dates; preserve the discrepancy, do not silently replace either date or claim that portal “Paid” proves posted settlement. A following-quarter invoice requires following-quarter bank evidence for its settlement.

Link invoice and debit as evidence for one expense, never two. Booking.com commission is distinct from platform payout, guest room sales, cleaning charges and booking-hub subscriptions. Validate the canonical PDF/extract pair before authorized redundant-copy cleanup; preserve unique or conflicting evidence.

Update the existing `_common/qN/summary.md` with collected periods, source links, statement locators and unresolved differences. Follow the [record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md); do not create a separate combined ledger, status folder or cache. Successful collection does not establish accountant readiness or quarter closure.
