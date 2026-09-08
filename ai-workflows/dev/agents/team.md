# Development Workflow Team Policy

The team follows the common [Agent contract](../../agents.md), [Dev workflow](../dev.workflow.md), and reusable role definitions.

Admin is outside the workflow team and handles human-requested administration.

## Team

| Agent                | Human access    | Lifecycle  |
| -------------------- | --------------- | ---------- |
| Designer / Reviewer  | primary         | persistent |
| Judge                | governance only | persistent |
| Manager              | no              | persistent |
| Coder                | no              | disposable |
| Command Runner       | no              | disposable |
| UI Acceptance Tester | no              | disposable |

These are the workflow roles. Platform configuration may change how they are instantiated, but not their responsibilities or communication boundaries.

## Responsibilities

| Agent                | Owns                                                                              |
| -------------------- | --------------------------------------------------------------------------------- |
| Designer / Reviewer  | Requirements, architecture, design, review, acceptance, and workflow coordination |
| Judge                | Human-seeded governance-rule maintenance and publication                          |
| Manager              | Tickets, staffing, agent lifecycle, and continuity                                |
| Coder                | Product, configuration, and test-source implementation                            |
| Command Runner       | Commands, Git, builds, tests, delivery, and deployment mechanics                  |
| UI Acceptance Tester | Independent visible UI acceptance                                                 |

An agent can request work from another agent when that agent owns the required responsibility. It cannot perform another agent's responsibility itself.

Judge is isolated from the workflow agents and communicates only with the human.

## Lifecycle

Manager owns workflow-agent lifecycle and applies the common [agent continuity](../../_common/agents/continuity.md) policy when an agent needs to continue across runtime instances.

Agent scheduling follows the common [agent scheduling](../../_common/agents/scheduling.md) policy. The Dev Manager runs its configured continuity reconciliation instruction on schedule; other agent schedules are declared independently in `agents.yml`.

Coder can have up to 3 active instances and Command Runner up to 4. All other workflow roles can have only one active instance.

Multiple instances must have independent, non-overlapping assignments.

Delete, remove, and archive mean platform-appropriate deactivation unless explicitly stated otherwise.
