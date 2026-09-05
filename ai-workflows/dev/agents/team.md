# Development workflow team policy

This is the authoritative portable Dev roster, Role-to-Agent mapping, capability policy, communication topology, and
lifecycle policy. It composes the common [Agent contract](../../agents.md), the [Dev workflow](../dev.workflow.md), the
[logical-agent manifest](../agents.yml), and [shared routing](shared-execution-routing.md). A selected platform adapter
realizes these logical agents without changing their authority.

The human-owned `admin` initializer is outside the governed roster. It receives direct lifecycle requests and normally
delegates governed-roster execution to `manager` as defined by the common Admin contract.

## Governed roster

| Logical agent | Portable role | Human access | Lifecycle |
| --- | --- | --- | --- |
| `designer-reviewer` | [Designer/Reviewer](../../_common/roles/designer-reviewer.md) | primary | persistent control |
| `judge` | [Judge](../../_common/roles/judge.md) | governance only | persistent control |
| `manager` | [Manager](../../_common/roles/manager.md) | prohibited | persistent control |
| `coder` | [Coder](../../_common/roles/coder.md) | prohibited | disposable worker |
| `command-runner` | [Command Runner](../../_common/roles/command-runner.md) | prohibited | disposable worker |
| `ui-acceptance-tester` | [UI Acceptance Tester](../../_common/roles/ui-acceptance-tester.md) | prohibited | disposable worker |

Exactly these six logical agents form the governed roster. A platform binding may add presentation and runtime
configuration, but it may not add a role or communication edge. Optional platform helpers are outside this roster and
cannot inherit Team authority.

## Capability ownership

`OWN` performs and decides. `DISPATCH` may request the owner. `READ` is evidence-only. `REVIEW` is independent review.
`AUDIT` is governance observation only. `NO` grants nothing.

| Capability | Designer/Reviewer | Judge | Manager | Coder | Command Runner | UI Tester |
| --- | --- | --- | --- | --- | --- | --- |
| Requirements, architecture, scope, and work packets | OWN | NO | NO | READ | NO | NO |
| Independent technical review and assignment acceptance | OWN | NO | NO | READ | NO | READ |
| Ticket search, creation, update, staffing, and evidence-gated closure | DISPATCH | NO | OWN | NO | NO | NO |
| Agent-instance staffing and lifecycle | DISPATCH | AUDIT | OWN | NO | NO | NO |
| Product source, configuration, and test-source changes | NO | NO | NO | OWN | NO | NO |
| Deterministic command, Git, build, test, delivery, and deployment execution | DISPATCH | governance-validation-only | NO | DISPATCH | OWN | NO |
| Visible end-user acceptance | REVIEW | NO | NO | NO | NO | OWN |
| Human-seeded protected governance maintenance and publication | NO | OWN | NO | NO | NO | NO |
| Initial protected rule meaning or semantic policy choice | NO | NO | NO | NO | NO | NO |

Tool availability, model ability, platform features, or dependency declarations never grant a capability absent here.

## Communication topology

| Route | Designer/Reviewer | Judge | Manager | Coder | Command Runner | UI Tester |
| --- | --- | --- | --- | --- | --- | --- |
| Direct human dialogue | PRIMARY | GOVERNANCE_ONLY | NO | NO | NO | NO |
| Receive internal packet | YES | NO | YES | YES | YES | YES |
| Send bounded work packet | YES | NO | tracker-adapter-only | command-runner-only | return-only | UI-support-only |
| Request/receive ticket from Manager | YES | NO | serve-exact-requester | YES | YES | YES |
| Relay human authorization | attest-only | NO | NO | NO | verify-only | NO |
| Use human as packet courier | NO | NO | NO | NO | NO | NO |
| Contact Judge from an agent | NO | NO | NO | NO | NO | NO |

Every route requires exact initialized instance IDs and matching profile, workflow, workflow-space, and runtime-scope
coordinates. Missing rows are prohibited. Judge has no peer route in either direction.

## Lifecycle and capacity

Manager is the governed roster owner. Replacement preserves exact lineage, transfers authorized context, binds the
successor everywhere, verifies readiness, and deactivates the predecessor last. Coder may scale from zero to three active
independent instances; Command Runner maintains one ready instance and may scale to four; every other governed role has a
maximum of one. Concurrent instances require non-overlapping assignments and exact return routes.

Human words such as remove, delete, or archive request platform-neutral deactivation. The selected adapter chooses the
safest preservation mechanism. Runtime IDs and lifecycle state are stored in runtime state, never in this policy.
