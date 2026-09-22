# Development Workflow Team Policy

The team follows the common [Agent contract](../../agents.md), [Dev workflow](../dev.workflow.md), and reusable role definitions.

## Mechanical policy

The workflow-local [role-capability-ownership.csv](role-capability-ownership.csv) matrix is the mechanical authority for
which role owns each capability. It does not define communication routes.

[`agents.yml`](../agents.yml) remains the single source for agent identity and runtime-facing role metadata and binds each
initialized agent to one capability column. The common [access-matrix mechanism](../../_common/policy/access-matrix.md)
defines composition and fail-closed behavior. The [Router runtime](../../_common/runtime/workflow-router.md) executes the
workflow's stage-to-role assignments.

This document explains the team in readable form. It must not create a capability absent from the matrix or a runtime
transition absent from the workflow.

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

Agents do not request work from or return work to one another. Each Agent receives its assigned stage from the Router and
returns a declared event to that same workflow runtime. The workflow determines the next role; ownership remains with the
capability owner, and runtime dispatch does not transfer it.

Judge is isolated from the workflow agents and communicates only with the human.

## Utility helpers

Dev selects Admin's bounded utility helpers through `initializer.utilitySubagents` in [agents.yml](../agents.yml).
The [utility contract](../../_common/agents/utility-subagents.md) owns their input, effect, model, waiting, and evidence
boundaries. Helpers are not workflow Agents or matrix columns and do not acquire peer routes or role ownership.

## Lifecycle

Manager owns workflow-agent lifecycle and applies the common [agent continuity](../../_common/agents/continuity.md) policy when an agent needs to continue across runtime instances.

Agent scheduling follows the common [agent scheduling](../../_common/agents/scheduling.md) policy. The Dev Manager runs its configured continuity reconciliation instruction on schedule; other agent schedules are declared independently in `agents.yml`.

Coder can have up to 3 active instances and Command Runner up to 4. All other workflow roles can have only one active instance.

Multiple instances must have independent, non-overlapping assignments.

Delete, remove, and archive mean platform-appropriate deactivation unless explicitly stated otherwise.
