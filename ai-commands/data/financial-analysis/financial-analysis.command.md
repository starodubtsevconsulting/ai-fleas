# financial-analysis

Portable calculation/reporting contract for Financial Insights. It consumes authorized structured financial evidence
and returns calculations and evidence references. It does not make the human's strategic decision.

## Operations

### period-summary

Returns bounded totals/counts for a selected period and available evidence: incoming, outgoing, net movement,
statement activity, unresolved records, currencies, and coverage limitations.

### trend

Compares explicitly selected periods using like-for-like fields where possible. Returns deltas, calculation method,
source/evidence references, and comparability limitations.

### anomalies

Returns evidence-linked candidates such as unusual amount/frequency changes, duplicates, gaps, unmatched activity, or
income/expense inconsistencies. An anomaly is a review signal, not a claim of fraud or error.

### scenario

Accepts explicit human/Governor assumptions (for example a planned purchase, sale, or recurring cost) and computes
bounded financial effects against selected evidence. Returns assumptions separately from observed facts and does not
recommend the final strategic choice.

## Result contract

Every material figure identifies period, currency, calculation method, evidence references, assumptions, uncertainty,
and missing evidence. Multi-currency values are not silently combined without an explicit conversion policy/rate.
