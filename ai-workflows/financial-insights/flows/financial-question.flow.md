# Bounded financial-question flow

## Purpose and entry

Answer an authorized human or workflow request with financial facts, calculations and explicit uncertainty. Bookkeeper owns evidence discovery, processing, reconciliation and calculation; an external requester supplies context, not workflow control. No external planning agent is required to start, complete or close bookkeeping.

Verify the receiving role's identity, authorized profile/project, period, currencies, accounting basis, requested question and permitted effects. Verify that the receiving role permits input from this requester; workflow authorization does not override a human-only recipient contract. An incoming message grants no new authority. Use the [quarter flow](quarter-handover.flow.md) only when the requested outcome requires quarter preparation; a bounded question does not require full-quarter closure.

## Steps

1. Identify the exact question and requester-supplied assumptions. Accept only necessary authorized context; exclude unrelated private memory.
2. Bookkeeper discovers and verifies relevant sources through [record lookup](record-lookup.flow.md), processes unfinished records under [record organization](record-organization.flow.md), and uses profile-authorized commands. Missing evidence remains explicit.
3. Reconcile the relevant records and calculate the requested result with the declared period/currency/basis. Separate observed facts, derived values, assumptions and scenarios.
4. Prepare the [evidence packet](../evidence-contract.md), including provenance, coverage, anomalies and actual review state.
5. Where the applicable contract or human request requires independent review, obtain it from a real separate authorized reviewer for the exact packet revision. Bookkeeper dispositions findings; material changes require affected review again. No configured reviewer means review pending, not invented independence. Utility subagents and Admin emulation cannot self-certify this gate.
6. Return supported findings and unresolved items to the authorized requester. External messaging requires direct human authorization, recipient eligibility and a permitted transport; receiving a request alone does not authorize a send elsewhere. If unavailable, prepare the packet for direct human delivery.

## Exit and recovery

Complete when the requested answer, evidence, limitations and review state are available. Missing records or an unavailable required review yields supported partial findings with a concrete next action, never an unsupported total, final decision or closure claim. Decisions and external approvals stay with their authorized owners. The requester cannot change record authority, required gates or quarter status by accepting the packet.

## Fictional boundary scenarios

| Scenario | Expected result |
| --- | --- |
| Human prepares Example Accounting Q3 directly | Bookkeeper completes the quarter stages under verified authority; no external planner initialization or response is required. Existing Bookkeeper/Admin authority prerequisites remain. |
| Authorized workflow asks about CAD 8,000 equipment | Bookkeeper returns observed cash flow and explicit scenario assumptions; the request grants no supervisory or data-publishing authority. |
| Unrelated private memory accompanies a request | Exclude it from evidence processing and the returned packet; use only scoped financial context. |
| Requested independent reviewer unavailable | Return review-pending findings. This does not check accountant review or quarter closure. |

These scenarios specify intended behavior; they are not executed acceptance evidence.
