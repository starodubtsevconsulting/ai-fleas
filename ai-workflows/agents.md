# Workflow agents

This is the composition root for every workflow that activates managed AI agents. The common contract is split into
focused, independently loadable rules so workflows and roles can resolve only the context relevant to the current task.

All linked documents below are authoritative parts of the common agent contract. A consumer that needs the complete common
contract must resolve this index and every applicable linked rule; conversational context does not replace them.

## Common contract

| Concern | Authority |
| --- | --- |
| Agent scope and workflow logical-project boundaries | [`_common/agents/scope.md`](_common/agents/scope.md) |
| Exact runtime identity and role-instance resolution | [`_common/agents/identity.md`](_common/agents/identity.md) |
| Capability boundaries and role declarations | [`_common/agents/capabilities.md`](_common/agents/capabilities.md) |
| Peer routing, packets, active scope, and evidence follow-up | [`_common/agents/communication.md`](_common/agents/communication.md) |
| Reliable peer delivery and acknowledgement | [`_common/agents/delivery.md`](_common/agents/delivery.md) |
| Active state, readiness, Admin/Judge foundations, and initialization | [`_common/agents/lifecycle.md`](_common/agents/lifecycle.md) |

Existing focused policies remain independently authoritative where applicable:

- [agent continuity](_common/agents/continuity.md)
- [knowledge transfer](_common/agents/knowledge-transfer.md)
- [agent scheduling](_common/agents/scheduling.md)

## Composition rule

Each workflow adds only its workflow-specific roles, routes, capability grants, stricter rules, and readiness behavior.
Workflow contracts may narrow the common contract but must not silently weaken it.

Runtime objects, model selection, reasoning configuration, transport, storage, and concrete lifecycle mechanics belong to
the selected platform adapter unless a portable workflow rule explicitly says otherwise.

A workflow without managed agents does not load this contract. It must load this composition root before introducing any
managed agent role or lifecycle behavior.
