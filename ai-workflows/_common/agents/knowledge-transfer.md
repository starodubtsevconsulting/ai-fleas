# Agent knowledge transfer

## Purpose

Knowledge transfer is the bounded handoff of operational context from one agent instance to another.

## Transfer content

A transfer should contain only what the receiving agent needs to continue safely: current status, completed work, active work, pending decisions or actions, and relevant references or identifiers.

## Coordination

A lifecycle owner may coordinate a transfer but must not absorb the transfer payload into its own working context. It should handle only the minimum metadata required to coordinate the handoff, such as transfer ID, source, target, status, and readiness.

The transfer payload should be persisted or passed directly through the selected platform mechanism to the receiving agent.

## Continuity replacement

When continuity replaces an agent, the predecessor should produce a transfer before replacement whenever it is still available. The successor receives that transfer as part of initialization before becoming authoritative.

If the predecessor is unavailable, use the latest trusted persisted transfer or status if one exists. Missing knowledge must not be invented.

## Boundaries

Knowledge transfer must preserve workflow, identity, authorization, and context boundaries. It may also be used for ordinary authorized handoffs between agents, not only continuity replacement.
