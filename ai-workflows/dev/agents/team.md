# Development Workflow Team Policy

The team follows the common [Agent contract](../../agents.md), [Dev workflow](../dev.workflow.md), and reusable role definitions.

## Mechanical policy

The workflow-local matrices are the mechanical authority for instantiated-role metadata, capability ownership, and communication routes:

- [role-capability-matrix.csv](role-capability-matrix.csv) — role metadata and runtime-facing properties;
- [role-capability-ownership.csv](role-capability-ownership.csv) — one explicit owner or prohibition for each declared capability;
- [role-communication-matrix.csv](role-communication-matrix.csv) — explicit directional communication routes.

[`agents.yml`](../agents.yml) binds every initialized agent to one matrix column. The common [access-matrix mechanism](../../_common/policy/access-matrix.md) defines composition and fail-closed behavior.

This document explains the team in readable form. It must not create a capability or communication route absent from the matrices.

## Team

| Agent                | Human access    | Lifecycle  |
| -------------------- | --------------- | ---------- |
| Admin                | administration  | persistent |
| Designer / Reviewer  | primary         | persistent |
| Judge                | governance only | persistent |
| Manager              | no              | persistent |
| Coder                | no              | disposable |
| Command Runner       | no              | disposable |
| UI Acceptance Tester | no              | disposable |

These are the workflow roles. Platform configuration may change how they are instantiated, but not their responsibilities or communication boundaries.

System is not a Dev team role or peer. The team can initialize and operate without a System instance and receives no
System instance ID or direct route. An independently initialized System may contact exact team instances through the
platform's trusted lifecycle channel, but team agents do not initiate direct System communication.

## Responsibility summary

| Agent                | Owns                                                                              |
| -------------------- | --------------------------------------------------------------------------------- |
| Admin                | Human-requested workflow administration                                           |
| Designer / Reviewer  | Requirements, architecture, design, review, acceptance, and workflow coordination |
| Judge                | Human-seeded governance-rule maintenance and publication                          |
| Manager              | Tickets, staffing, agent lifecycle, and continuity                                |
| Coder                | Product, configuration, and test-source implementation                            |
| Command Runner       | Commands, Git, builds, tests, delivery, and deployment mechanics                  |
| UI Acceptance Tester | Independent visible UI acceptance                                                 |

The capability-ownership matrix is authoritative when this summary and a matrix cell disagree.

An agent can request work from another agent only through a route authorized by the communication matrix and shared routing contract. Ownership remains with the capability owner; delegation does not transfer it.

Judge is isolated from the workflow agents and communicates only with the human.

## Lifecycle

Manager owns workflow-agent lifecycle and applies the common [agent continuity](../../_common/agents/continuity.md) policy when an agent needs to continue across runtime instances.

Agent scheduling follows the common [agent scheduling](../../_common/agents/scheduling.md) policy. The Dev Manager runs its configured continuity reconciliation instruction on schedule; other agent schedules are declared independently in `agents.yml`.

Coder can have up to 3 active instances and Command Runner up to 4. All other workflow roles can have only one active instance.

Multiple instances must have independent, non-overlapping assignments.

Delete, remove, and archive mean platform-appropriate deactivation unless explicitly stated otherwise.
