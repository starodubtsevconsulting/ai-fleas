# Governor financial-question flow

## Purpose

Route a financial dimension of a human decision through the real Financial Insights team while keeping the Personal
Governor responsible for cross-workflow strategy.

## Flow

1. Governor states a bounded financial question, decision context, authorized project/period, and explicit scenario
   assumptions. It does not send unrelated Governor memory.
2. Financial Analyst identifies required evidence and requests record/completeness evidence from Records / Bookkeeping.
3. Records / Bookkeeping uses the portable financial-records/statements/taxes capabilities and returns provenance,
   coverage, unresolved items, and structured evidence.
4. Financial Analyst uses financial-analysis to calculate the requested summary/trend/anomaly/scenario and creates an
   evidence packet following ../evidence-contract.md.
5. If the conclusion is material to a buy/sell/spend/retain decision or the requester asks for independent review,
   send the exact evidence packet/revision to a separate Financial Reviewer.
6. Financial Reviewer returns evidence-linked findings. Analyst dispositions substantive findings and produces a new
   revision when needed; changed material invalidates the affected review.
7. Return the exact packet plus review state to Governor.
8. Governor combines the financial dimension with human goals, opportunity cost, capacity, and other authorized
   workflow evidence. The human retains any decision not explicitly delegated.

## Fail closed

If required records, period/currency policy, agent independence, or provenance cannot be established, return the
missing evidence/gate rather than manufacture a financial answer.
