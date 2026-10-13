# Worked use case: chalet supplies and repairs

Fictional instructional example; all dates, amounts, parties, observations, and paths are invented, not executed evidence.

**Request:** “How much did we spend on chalet materials, toilet paper, repairs, and similar purchases in Q2 2027?”

**Plan:** find the chalet's receipts, including phone photos; identify paid operating purchases dated April 1–June 30; reconcile duplicate evidence; distinguish gross spending from pretax cost and other chalet costs. Read the normative [spending-question flow](../flows/spending-question.flow.md) first.

1. **Discover original evidence.** Read the selected profile's mapping and inventory the chalet's outgoing receipts, repair invoices, phone-image folders, and relevant statement periods. Include JPEG/HEIC/PNG images and image-only PDFs even when no JSON or extracted text exists. Check adjacent-quarter folders for misfiled receipts. A folder name or phone capture timestamp does not replace the purchase date printed on a receipt.
2. **Inspect each receipt.** Read valid sidecars, then inspect the original image/page for missing or conflicting facts. Rotate or crop a derived view when necessary, keeping the original intact; include all receipt segments and pages. Record merchant, receipt date/reference, item descriptions, quantities, discounts, subtotal, taxes, final total/currency, tender, and payment evidence. A card terminal's “approved” total may prove a payment but does not reveal the basket's contents. A paid invoice or matched statement can corroborate payment; an unpaid quotation is not spending. If an image is unreadable, retain an unresolved candidate rather than omit it or invent its amount.
3. **Classify from contents and purpose.** Include supported chalet consumables, repair materials, and paid repair services. Keep mortgage payments, utilities, municipal/provincial/federal taxes, and platform fees in separate categories outside this question's purchase subtotal. Record equipment separately so a refrigerator purchase does not silently become toilet-paper spending; this classification is not a conclusion about tax deductibility. For a mixed personal/chalet basket, retain the full receipt and allocate only supported chalet items, their discounts, and their applicable taxes. State the allocation method; unresolved item purpose or tax allocation remains pending.

| Source | Evidence and gross amount | Decision |
| --- | --- | --- |
| `2027/chalet/Q2/out/supplies/receipt-a.jpg` | Apr 8, cleaning supplies and toilet paper; after discounts CAD 43.49 plus taxes CAD 6.51; card approved CAD 50.00 | Include CAD 50.00 |
| `out/repairs/repair-b.pdf` p1 | May 14, small repair; CAD 86.97 plus taxes CAD 13.03; invoice marked paid, matched to bank debit CAD 100.00 | Include CAD 100.00 |
| Statement row matching repair B | May 14, CAD 100.00 debit | Corroborates B; not a second purchase |
| Duplicate photo of receipt A | Same merchant, receipt reference, date, items, total | Count once |
| `out/supplies/mixed-basket.jpg` | June purchase, chalet and personal items; lower receipt segment missing | Pending allocation and total; no invented amount |
| `out/equipment/appliance.pdf` | Paid appliance invoice | Separate equipment category; outside this supplies/repairs subtotal |
| Receipt filed under Q2 | Printed purchase date July 2 | Exclude from Q2 on the selected purchase basis |

4. **Reconcile and check coverage.** Match receipts, terminal slips, paid invoices, statement rows, and repeated photo exports using references, date, merchant, amount/currency, and item content. Similar totals alone do not prove a duplicate. Do not count later card-balance payments again. Inspect statement-only possible purchases, but do not classify a mixed retailer's entire charge as chalet supplies without supporting contents or attributed purpose. Retain separately settled refunds as signed transactions. Finish the relevant file batches and list missing photos, unreadable receipts, and statement-period gaps explicitly.
5. **Calculate and answer.** The supported gross purchase subtotal is **CAD 150.00** (`50.00 + 100.00`), comprising **CAD 130.46 pretax** and **CAD 19.54 receipt taxes**. These receipt tax amounts are not a determination of recoverable tax. The mixed basket is unresolved, so this is not a complete quarter expense total.

**Answer:** “The supplied receipts support **CAD 150.00 including taxes** for chalet supplies and repairs in Q2 2027. One mixed-basket receipt needs a complete image and allocation, so the quarter total remains incomplete. Equipment and other operating costs are separate.” Attach the normalized receipt ledger, source citations, exclusions, and coverage status.

**Recover and cache:** missing text extraction is a reason to inspect the image, not evidence of zero spending. If the original cannot be read, report the supported subtotal and exact missing evidence. Cache real Q&A beside the data under the [FAQ cache contract](../flows/data-faq-cache.md); retain the reusable method here and actual operation timings in private run evidence.
