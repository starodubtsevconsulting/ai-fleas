# Governor financial-question flow

## Purpose

Route a financial dimension of a human decision through the real Financial Insights team while keeping the Personal
Governor responsible for cross-workflow strategy.

## Flow

1. Governor states a bounded financial question, decision context, authorized project/period, and explicit scenario
   assumptions. It does not send unrelated Governor memory.
2. The configured Bookkeeper identifies required evidence within the authorized scope. Analysis and record processing are capabilities of this worker, not additional registered roles.
3. Bookkeeper uses the portable financial-records/statements/taxes capabilities and returns provenance,
   coverage, unresolved items, and structured evidence.
4. Bookkeeper uses financial-analysis to calculate the requested summary/trend/anomaly/scenario and creates an
   evidence packet following the [evidence contract](../evidence-contract.md).
5. If the conclusion is material to a buy/sell/spend/retain decision or the requester asks for independent review,
   send the exact evidence packet/revision to a real separate authorized reviewer. The current roster does not declare a separate Financial Reviewer; if no authorized reviewer is available, keep the independent-review gate pending.
6. The actual authorized reviewer returns evidence-linked findings. Bookkeeper dispositions substantive findings and produces a new
   revision when needed; changed material invalidates the affected review.
7. Return the exact packet plus review state to Governor.
8. Governor combines the financial dimension with human goals, opportunity cost, capacity, and other authorized
   workflow evidence. The human retains any decision not explicitly delegated.

A utility subagent or Admin emulation cannot self-certify independent review. The distinct-actor [delegation acceptance scenario](../acceptance/governor-delegation.md) remains unsatisfied without its required real actors.

## Fail closed

If required records, period/currency policy, agent independence, or provenance cannot be established, return the
missing evidence/gate rather than manufacture a financial answer.
