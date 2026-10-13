# Worked use case: Amazon shopping spend

Fictional instructional example; all dates, amounts, paths, and observations are invented, not executed evidence.

**Request:** “How much did I spend on Amazon buying things in Q2 2027?”

**Plan:** use April 1–June 30 posted payments in CAD; find retail purchases and refunds across the authorized business/account scope. Separate Amazon shopping from AWS and subscriptions. Read the normative [spending-question flow](../flows/spending-question.flow.md) first.

1. **Discover account and document coverage.** Resolve the authorized reports mapping, then inventory each relevant business's receipts, invoices, phone photos, and card/chequing statements. Search retailer aliases and marketplace descriptors, but also scan statement transactions independently so missing receipts do not hide charges. Check adjacent-quarter folders for misfiled documents and statements spanning quarter boundaries. Record which accounts and transaction dates are covered.
2. **Extract payment and purchase facts separately.** Read valid JSON sidecars and inspect original pages/images when facts are absent or conflict. Retain transaction and posted dates, debit/credit direction, amount/currency, card reference, merchant descriptor, order/invoice IDs, shipment references, item descriptions, and business allocation. An Amazon-branded descriptor alone does not establish retail goods, business purpose, or tax deductibility. AWS, Prime, digital subscriptions, and unknown descriptors remain separate categories unless the request explicitly includes them.
3. **Reconcile without collapsing distinct purchases.** Link invoices and receipts to settled charges using references, dates, amount, and currency. One order may have several shipments, invoices, and card charges; several items may settle together. Preserve those relationships rather than assuming one order equals one payment. Deduplicate copied statements and repeated invoice/photo exports. A chequing payment of the card balance is settlement of the card debt, not another purchase. Retain unmatched charges and refunds with their actual status; a missing invoice does not erase a confirmed charge, and an invoice alone does not prove settlement.

| Source | Observed evidence | Decision |
| --- | --- | --- |
| `2027/consulting/Q2/statements/card-april.pdf` p1 | Apr 10 Amazon retail debit CAD 100.00; matched invoice and order | Include CAD 100.00 gross paid |
| `2027/chalet/Q2/statements/card-may.pdf` p2 | May 12 Amazon retail debit CAD 50.00; invoice absent, item purpose unknown | Include CAD 50.00 in retailer cash spend; business/item allocation pending |
| `2027/consulting/Q2/statements/card-june.pdf` p1 | June 8 Amazon refund CAD 20.00, linked to April order | Deduct CAD 20.00 |
| Duplicate invoice/photo and copied statement | Same source references as April purchase | Evidence copies; no additional spending |
| Chequing statement | Card-balance payment | Exclude from purchase total |
| Card statement | AWS cloud charge | Separate cloud service; exclude from retail-shopping answer |
| Invoice in Q2 folder | Purchase/payment dated March 29 | Exclude on Q2 posted-payment basis |
| Invoice in Q3 folder | Q2 shipment; charge not yet located | Pending payment reconciliation; no invented settled amount |

4. **Calculate on one stated basis.** Gross settled retail purchases are **CAD 150.00** (`100.00 + 50.00`); settled refunds are **CAD 20.00**; net retailer spending is **CAD 130.00**. Preserve paid totals including any charged taxes; extract pretax and tax components only where supported. A refund for a prior-quarter purchase still belongs to this quarter's cash movement when posted in Q2, with the original purchase period recorded separately. Keep unresolved charges outside the confirmed retail subtotal when merchant category itself cannot be established.
5. **Answer with coverage and allocation limits.** “The supplied statements show **CAD 130.00 net Amazon retail spending** in Q2 2027: CAD 150.00 purchases less CAD 20.00 refunds. CAD 50.00 lacks an invoice, so its contents and business allocation remain pending. AWS and subscriptions are separate. Statements stop June 22, so June 23–30 remains uncovered; this is a supported subtotal rather than a complete quarter total.”

**Recover and cache:** seek missing receipts or late statements without dropping already confirmed payments. Do not infer zero from a failed extraction or absent invoice. Build the normalized payment ledger on demand from adjacent records. When authorized, retain source links, exclusions, unresolved records and the scoped answer in the one quarter summary under the [verified-answer contract](../flows/data-faq-cache.md); keep actual run timings in permitted runtime evidence, without a duplicate durable ledger; keep only the reusable method here. Stop with a supported subtotal and named gaps when the missing evidence is unavailable.
