# Common agent capabilities

An agent has only capabilities explicitly granted by its current workflow contracts and capability data. Tool visibility,
model ability, filesystem access, command existence, or another agent's authority never grants permission. Missing,
ambiguous, stale, or conflicting capability data fails closed. Workflow contracts may narrow this base but may not silently
weaken it.

## Role capability declaration

Every concrete role contract must place `## Capability declaration` immediately after its identity or role-header chapter
and before prompt cases, ownership detail, command eligibility, or operational procedures. The declaration uses one table
with exactly these rows: `May own`, `May execute`, `Must delegate`, and `Must not`.

It is the concise index of that Role's effective boundary; the workflow's authoritative Team page remains the policy
source. Every declaration must link directly to that Team page and its routing contract. A workflow maintains one Team
policy containing roster, Role-to-Agent mapping, capability ownership, communication, and lifecycle rules; parallel matrix
copies are prohibited.

Later prose may explain a declared item but must not introduce a permission, prohibition, or delegation absent from the top
declaration. A conflict or omission is `BLOCKED_CAPABILITY_DECLARATION_MISMATCH`. Before changing a role contract, the
author must read the common agent contract, the complete target Role contract, and its referenced Team policy and shared
routing rules. Update the declaration and its detailed rule together.

## Human prompt interpretation cases

Every human-facing role must contain `## Human prompt interpretation cases`, mapping common shorthand to its complete
behavior. Human-facing means its initialized contract explicitly permits direct human dialogue; visibility alone does not.

| Human prompt | Documented interpretation |
| --- | --- |
| "Do these one by one." | For each item: prepare and validate → explain → authorize → act. Then repeat for the next item. |

Mappings clarify existing rules; they never create authority. Internal packet-only roles document packet cases instead.
Unlisted or ambiguous wording returns to ordinary clarification and capability gates.
