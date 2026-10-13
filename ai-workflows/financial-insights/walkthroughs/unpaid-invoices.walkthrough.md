# Worked solution: outstanding customer invoices

Fictional instructional example; no files described here were executed or measured.

**Request:** “Which consulting customer invoices are still unpaid as of June 30, 2027?”

**Short plan:** inventory issued customer invoices through the as-of date; read deposits and remittance evidence through that date; match by identity/reference and currency; calculate supported remaining balances; separate unmatched invoices from proven nonpayment.

1. **Map date and direction.** Customer invoices belong to mapped `in` sections. List `2027/consulting/Q1/in` and `Q2/in`, plus the authorized opening outstanding-invoice schedule and corresponding statement sections. Why: a Q1 invoice can remain outstanding in Q2. Without an opening schedule or older coverage, report that limitation instead of claiming every outstanding invoice was found.
2. **Read invoice facts, not status labels alone.** In bounded batches read number, customer, issue/due date, currency, gross amount, credits, and source links from valid JSON. Extract missing fields into private evidence and inspect originals for conflicts. The fictional opening schedule has no outstanding balance; the following final invoices are issued by June 30. A July invoice is excluded by the as-of date.
3. **Read deposits and remittances independently.** Scan all transaction rows for the scoped accounts through June 30, not only amounts matching an invoice. A deposit reference explicitly names I-301; a remittance names I-302 and says partial payment. A CAD 500.00 grouped deposit names no invoices. A USD 100.00 deposit has the same amount as I-304 but an unknown payer. Why: matching amount alone cannot allocate cash.
4. **Normalize and reconcile.** Link each match to the original statement row and remittance page. Keep currencies separate. Do not allocate the grouped deposit across invoices merely to make balances fit.

| Invoice/source | Invoice amount | Supported applied payment/source | Remaining calculation | Conclusion as of Jun 30 |
| --- | ---: | --- | ---: | --- |
| I-301; `2027/consulting/Q2/in/I-301.pdf` p1 | CAD 300.00 | CAD 300.00; `2027/consulting/Q2/statements/bank-may.pdf` p2 row 2, reference I-301 | 300.00 − 300.00 = CAD 0.00 | Paid |
| I-302; `2027/consulting/Q2/in/I-302.pdf` p1 | CAD 400.00 | CAD 150.00; `2027/consulting/Q2/statements/bank-june.pdf` p2 row 3 and `2027/consulting/Q2/in/I-302-remittance.pdf` p1 | 400.00 − 150.00 = CAD 250.00 | Remaining after identified allocations; other cash unresolved |
| I-303; `2027/consulting/Q2/in/I-303.pdf` p1 | CAD 200.00 | No identified payment | CAD 200.00 before unresolved allocation | Unreconciled; not proven unpaid |
| I-304; `2027/consulting/Q2/in/I-304.pdf` p1 | USD 100.00 | No identified payment | USD 100.00 before unresolved allocation | Unreconciled; ambiguous same-amount deposit |

5. **Preserve unallocated evidence.** `2027/consulting/Q2/statements/bank-june.pdf` p2 row 8 shows the CAD 500.00 grouped deposit. Page 3 row 2 shows the unidentified USD 100.00 deposit. Search bounded remittance evidence by date, reference, and payer aliases; the fictional search finds no allocation. Record both as unapplied cash. Invoice dates and due dates remain separate; “outstanding” does not automatically mean overdue.
6. **Calculate and answer with uncertainty.** I-302 has CAD 250.00 remaining after identified allocations. Unreconciled invoice face balances are CAD 200.00 and USD 100.00. CAD 250.00 + CAD 200.00 = CAD 450.00 before resolving unapplied cash, but that sum is not a proven unpaid total. The unidentified deposits might relate to any open invoice, including I-302. Never subtract CAD 500.00 arbitrarily or combine USD with CAD.

**Answer:** “As of June 30, I-302 has **CAD 250.00 remaining after identified allocations**; I-301 is paid. I-303 (CAD 200.00) and I-304 (USD 100.00) are unreconciled. There is unallocated CAD 500.00 and USD 100.00 deposit evidence that could relate to open invoices, including I-302, so these balances are not definitive unpaid amounts.” Attach sources, searched account/date coverage, and missing remittance evidence.

**Adapt:** use explicit remittance allocations for grouped payments, verify credits and refunds, and inspect later settlements only as separately dated subsequent evidence. If a statement period or account is missing, qualify payment-status conclusions. If the user meant vendor bills, select `out` and outgoing payments instead. A request to send reminders or modify records requires its own authorization; this evidence answer does not perform those actions.
