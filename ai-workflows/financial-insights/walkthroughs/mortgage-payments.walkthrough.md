# Worked use case: chalet mortgage payments

Fictional instructional example; all dates, amounts, paths, observations, and answers are invented, not executed evidence.

**Request:** “How much did I pay toward the chalet mortgage in Q2 2027?”

**Plan:** total posted mortgage cash payments April 1–June 30 in the authorized chalet account scope. Keep principal, interest, lender fees, and other collected components separate when documented. Read the [spending-question flow](../flows/spending-question.flow.md).

1. **Discover accounts and mortgage identity.** Use the [account inventory](account-inventory.walkthrough.md), lender documents, and previous statements to identify the mortgage and payment accounts. Scan every covered statement transaction, not only a known lender keyword. Check boundary-spanning statements and adjacent-quarter folders. A generic loan debit is a candidate until the chalet mortgage relationship is supported.
2. **Extract and reconcile.** Record posted date, debit/credit direction, amount/currency, lender/reference, account, source page, and reversal links. Inspect source columns when text order obscures direction. Deduplicate copied statements. An internal transfer to the payment account is not another mortgage payment; a scheduled debit or payment instruction does not prove settlement.

| Fictional source evidence | Decision |
| --- | --- |
| April bank statement p1: mortgage debit CAD 900.00 | Include |
| May bank statement p2: mortgage debit CAD 900.00 | Include |
| June bank statement p1: mortgage debit CAD 900.00, then linked reversal credit CAD 900.00 | Net this pair to zero; preserve failed attempt |
| June bank statement p2: replacement mortgage debit CAD 920.00 | Include; component allocation pending |
| Transfer into payment account CAD 920.00 | Exclude as internal funding |
| July scheduled payment CAD 900.00 | Exclude from Q2 posted cash |

3. **Calculate cash, then components only if supported.** Posted debits are CAD 3,620.00; the reversal is CAD 900.00; **net mortgage cash paid is CAD 2,720.00** (`900 + 900 + 900 − 900 + 920`). Do not call this whole amount interest expense or infer principal from a mortgage rate. Reconcile lender allocations to the same dated payments before reporting a component split; annual interest totals alone do not establish Q2 interest.
4. **Answer and preserve gaps.** “The supplied full-quarter statements show **CAD 2,720.00 net chalet mortgage payments in Q2 2027**. The principal/interest/fee split is unavailable pending the lender's payment breakdown.” If statement intervals are incomplete, label the amount a supported subtotal instead. Investigate a reversed payment's replacement without assuming the obligation disappeared.

**Recover and cache:** seek the lender statement for allocation and unmatched payments; retain confirmed cash independently of that missing split. Save normalized debits, reversals, references, source pages, coverage, and unresolved components privately. Cache the answer beside financial data using the [data FAQ contract](../flows/data-faq-cache.md).
