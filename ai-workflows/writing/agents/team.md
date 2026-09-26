# Writing managed-agent team

This workflow composes the [common agent contract](../../agents.md), the [Writing workflow](../writing.workflow.md),
the [capability ownership matrix](role-capability-ownership.csv), and the hidden
[Workflow Router](../../_common/runtime/workflow-router.md). Capability ownership is mechanical policy; it is not a
communication graph.

## Roster and ownership

| Endpoint | Human access | Ownership | Lifecycle |
| --- | --- | --- | --- |
| Admin | administration | Roster administration, Router inspection, and authorized recovery | persistent |
| Writer | primary | Article intake, draft, edit, archive, selected unpublished destination drafts, critique dispositions | persistent |
| Reviewer | primary | Independent critique and human-visible review report | persistent |
| Release Coordinator | primary | Per-destination review-gate/account-history checks, release actions, and profile-authorized scheduling | persistent |

Admin sits outside ordinary workflow execution and owns any required local governance validation under the common Admin
contract. Writer, Reviewer, and Release Coordinator are independently addressable role endpoints. The Router assigns
stages to their exact active task IDs, observes their completed turns, and applies only workflow-declared transitions.
No endpoint sends workflow messages to another endpoint, and the human is never used as a courier.

Release Coordinator uses Medium's native future scheduling only when the selected profile explicitly enables it and
the exact article and destination have passed independent review. The profile's
`requires_human_article_acceptance` policy determines whether direct human acceptance or a valid session-scoped
release mandate is an additional gate.

Each endpoint is limited to the selected profile's registered project subset, exact logical project, active commands,
and capability column. Provider account, article archive path, editorial preferences, and release cadence come from the
selected profile and effective article brief, not from this portable policy.
