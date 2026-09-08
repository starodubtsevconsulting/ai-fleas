# Agent knowledge transfer

Knowledge transfer is the bounded handoff of operational context from one agent instance to another.

A transfer should contain only what the receiving agent needs to continue safely: current status, completed work, active work, pending decisions or actions, and relevant references or identifiers.

When continuity replaces an agent, the predecessor should produce a transfer before replacement whenever it is still available. The successor receives that transfer as part of initialization before becoming authoritative.

If the predecessor is unavailable, use the latest trusted persisted transfer or status if one exists. Missing knowledge must not be invented.

Knowledge transfer must preserve workflow, identity, authorization, and context boundaries. It may also be used for ordinary authorized handoffs between agents, not only continuity replacement.
