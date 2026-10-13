# Personal Governor consumption of financial evidence

## Responsibility

Financial Insights is an independent domain workflow. Its Bookkeeper owns records, evidence processing, reconciliation, calculations and quarter status. Governor is an optional external consumer: it may combine supported financial outcomes with human goals, capacity, opportunity cost and other authorized context for planning. Governor is not a bookkeeping role, supervisor, lifecycle requirement, review gate or source of financial data authority.

The owning workflow accepts the [requester-neutral financial question](../../../financial-insights/flows/financial-question.flow.md) and returns its [evidence contract](../../../financial-insights/evidence-contract.md). Direct human work with Bookkeeper requires no Governor involvement. Governor-owned planning and memory do not move into bookkeeping; bookkeeping source records remain authoritative in their own authorized stores.

## Request and communication

Follow the [Governor communication boundary](../../roles/personal-governor.md#human-approval-and-communication-boundary) and [common communication rules](../../agents/communication.md); this integration grants no new route or effect.

1. Resolve the authorized workflow and its canonical role/communication rules. Verify recipient eligibility before proposing a send. An initialized Admin remains human-only, even if the human approves relaying a message; prepare text for direct human delivery instead.
2. Prepare only the exact financial question, authorized project/period/currency/basis, necessary decision context and explicit assumptions. Do not send unrelated Governor memory or unrestricted raw documents.
3. For an eligible real agent, present the recipient, bounded action and stop condition and obtain direct human approval for that exact send. A new or materially changed follow-up requires its own approval. Read-only evidence inspection is governed by existing scope, not an implied dispatch entitlement.
4. Use only the permitted transport. Do not manage queues, interrupt work, choose execution modes, supervise roster stages or change roles. Missing initialization follows existing Admin-only lifecycle rules; a financial question is not an unconditional initialization or dispatch instruction.
5. Consume the returned packet with its provenance, coverage, assumptions and actual review state. Preserve pending findings and uncertainty in planning. Do not modify records, certify financial review, check closure or treat delivery as approval.

## Completion

Governor may explain the supported financial dimension and integrate it into human planning. If a route is prohibited or evidence is incomplete, report the concrete boundary and next human action. Human decisions and approvals remain external to the evidence packet. See [boundary scenarios](financial-evidence.acceptance.md); these define expected behavior, not observed acceptance.
