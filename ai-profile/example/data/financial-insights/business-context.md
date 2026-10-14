# Fictional Financial Insights business context

This is an illustrative profile-owned map for finding and interpreting evidence, not a posting rule, an account inventory verified against statements, or operational authority. Every name, account label, relationship and confirmation below is invented. The existing benchmark fixtures do not establish these illustrative facts; their evaluator facts remain separate.

## Basis and effective dates

The map's illustrative effective date is **2026-01-01**. `H1` means an invented human confirmation dated 2026-01-01: “These three activities belong to Example Organization, and the accounts listed below are its accounts.” `H2` means an invented human confirmation dated 2026-01-02: “Example Booking Hub mirrors the two lodging providers; it is not another payer.” Neither is a real confirmation. Entries marked **expectation** are deliberately unverified examples of clues an agent could check.

In a real private profile, replace these labels with dated, attributable human confirmations and links to authorized source evidence. Distinguish the date a relationship began from the date it was verified. An activity label is not proof of a separate legal entity, account ownership, tax registration or deductibility.

## Business activities and income origins

| Activity | Expected income origin and evidence | Expected settlement route | Basis |
| --- | --- | --- | --- |
| Example Consulting | Example Client A; customer invoice and client remittance | Client → Example FX Wallet USD → Example Operating Bank CAD | Activity: invented H1; client and route: expectation |
| Example Lodging | Example Stay Platform and Example Reservation Platform; reservations, payout and fee records | Provider → Example Property Bank CAD | Activity: invented H1; providers and route: expectation |
| Example Media | Example Media Client; customer invoice and remittance | Client → Example Operating Bank CAD | Activity: invented H1; client and route: expectation; verify before use |

Match the origin to invoice/provider evidence and then to receiving-side statements. Receipt, revenue, tax collected, deposit, refund and settlement are different concepts. A payout may combine several bookings or deduct fees; do not equate a bank credit with revenue without the breakdown.

## Accounts and cards

These fictional labels are lookup clues, not real account numbers. A real map uses masked identifiers, verified institution/currency/owner and effective dates.

| Label | Expected role | Verification needed |
| --- | --- | --- |
| Example Operating Bank CAD (`BANK-OPERATING`) | Consulting/media receipts, wallet destination and operating payments | Current statement header, owner, currency and receiving matches |
| Example Property Bank CAD (`BANK-PROPERTY`) | Lodging settlements and property payments | Current header and provider payout destination |
| Example FX Wallet USD (`WALLET-USD`) | Consulting receipts, FX and onward transfers | Wallet identity, currency, fees and both transfer legs |
| Example Business Card (`CARD-MASTER`) | Vendor purchases | Account statement and transaction evidence; account ownership is only invented H1 |
| Example Employee Card (`CARD-ADDITIONAL`) | Additional card under `CARD-MASTER` | Parent account and cardholder; a physical card is not automatically a second account |

## Service partners and other relationships

| Partner | Expected function | How to use the clue |
| --- | --- | --- |
| Example Invoice Service | Produces customer invoices | Retrieve source invoices; the service is not the customer or payer merely because it hosts them |
| Example Booking Hub | Mirrors the two lodging providers and charges a subscription | Mirroring: invented H2; subscription: expectation. Map rows to the underlying provider; never add mirrored booking totals as another income stream |
| Example Utility Supplier | Property electricity supplier | Verify service address and contract before collecting bills |
| Example Cover Provider | Property insurance supplier | Verify insured property, policy period and premium evidence |
| Example Cloud Supplier | Consulting/media infrastructure supplier | Verify invoice, business use and settlement; supplier identity does not establish a tax treatment |

Employee registration, canonical names, aliases, personal payment destinations and their confirmation history belong in the selected organization's private `employees.md`, resolved through its profile mapping. That file is not supplied by this public example. Reference it rather than duplicating personnel details here. A transfer label or recurring amount alone does not establish salary.

## Relationships without double counting

- `Example Client A → WALLET-USD → BANK-OPERATING` has one customer receipt followed by internal movement. Match dates, currencies, FX, fees and references on both sides; a wallet transfer is not another receipt.
- `BANK-OPERATING → CARD-MASTER` settles a card balance. Link it to card activity rather than recording the purchases again as a new expense.
- Provider reservation, hub row, invoice, payout and bank settlement can describe one economic event. Link their evidence instead of adding every representation.
- A customer total can include collected tax; a tax remittance can settle an existing liability. Preserve the components and applicable tax evidence rather than treating each total as new income or expense.
- Statement-supported salary projections remain source-linked and non-additive. Do not add their totals again to the underlying statement transactions.

## Updating and using the map

Read this context to choose where to search first. Current source evidence takes precedence over an expectation. A conflict with a human confirmation requires investigation, not silent replacement of either record. Verify institution, account identity, currency, business/property and period for the task at hand.

Add a changed account, payer or route only with its evidence or attributable human confirmation, effective date and verification date; keep an unresolved candidate explicit until verified. Preserve the prior relationship's end date when known. Context updates do not authorize account creation, transaction posting, publication or access outside the selected scope.

Keep current-quarter missing evidence, unmatched transfers and contradictions in the single `reports/YYYY/_common/qN/summary.md`. Keep source PDF/image files and validated same-basename CSV/JSON beside each other in the mapped business folders. Compose combined extracts on demand. Follow the [record organization flow](../../../../ai-workflows/financial-insights/flows/record-organization.flow.md) for intake, reserved underscore folders, permitted projections and readiness.
