# Writing managed-agent team

This workflow composes the [common agent contract](../../agents.md), the [Writing workflow](../writing.workflow.md),
the [capability ownership matrix](role-capability-ownership.csv), and the hidden
[Workflow Router](../../_common/runtime/workflow-router.md). Capability ownership is mechanical policy; it is not a
communication graph.

## Startup stability rule

Writing startup is intentionally simple: Admin, Writer, Reviewer, and Release Coordinator are independently created
and directly usable by the human. Do not add a Manager, lifecycle permit, readiness gate, cross-agent startup
dependency, or project-ID reconciliation requirement to create or display these roles. The hidden Router remains the
required runtime for a started workflow run and its declared stage handoffs.

Any proposed change to this simple startup model, the visible roster, or the roles' independent human access requires
an explicit human design decision before implementation. Do not refactor this model speculatively.

## Roster and ownership

| Endpoint | Human access | Ownership | Lifecycle |
| --- | --- | --- | --- |
| Admin | administration | Roster administration, Router inspection, and authorized recovery | persistent |
| Writer | primary | Article intake, draft, edit, archive, selected unpublished destination drafts, critique dispositions | persistent |
| Reviewer | primary | Independent critique and human-visible review report | persistent |
| Release Coordinator | primary | Per-destination review-gate/account-history checks, release actions, and profile-authorized scheduling | persistent |

Admin sits outside ordinary workflow execution and owns any required local governance validation under the common Admin
contract. Writer, Reviewer, and Release Coordinator are independently addressable role endpoints. The human may start
and use any of them directly; no startup-time handoff service is required. For a started managed run, the Router
assigns stages to their exact active task IDs, observes their completed turns, and applies only workflow-declared
transitions. No endpoint sends workflow messages to another endpoint, and the human is never used as a courier.

## Roster lifecycle

Writing deliberately declares **no Manager**. Admin directly owns lifecycle operations for Writer, Reviewer, and
Release Coordinator. A request to initialize or repair this roster must not bootstrap, consult, or wait for a Manager.
For a human request to initialize the visible roster, first verify the exact profile, Writing workflow, selected
profile-authorized saved project, role declarations/contracts, and effective model/reasoning settings. Inspect the host
task catalog and create only missing live roles in that saved project, passing exact scope and role contracts in each
first message. An omitted task `projectId` is inconclusive: use other host evidence before deciding whether a role
already exists. A missing optional runtime binding, readiness receipt, or complete attached-folder listing does not
block creation of a role whose configured project and scope are otherwise verified. Do not request a screenshot for
scope that the host and configuration can establish. Verify the created tasks and report visible-roster status
separately from managed Router readiness.

When the human asks Admin to run Writing work, Admin uses emulated mode and explicitly names the selected roles even
when the roster exists. It records the work as Admin work. An already active managed run remains Router-dispatched.
Direct Writing endpoints do not require INIT audits or roster receipts. Optional bounded helpers may support a role,
but the role remains directly usable by the human without lifecycle activation.

For an authorized Admin emulation, Admin assigns each role it actually emulates to a separate role-scoped
subagent under the [Admin role contract](../../_common/roles/admin.md). Admin reads that role's effective model and
reasoning binding before dispatch and verifies its output. An unavailable or effect-ineligible transport blocks that
role step rather than authorizing direct execution. This work remains Admin-performed; a Reviewer subagent of
the drafting Admin does not satisfy independent critique. A separate fresh-context Reviewer task or human reader
supplies that gate.

Release Coordinator uses Medium's native future scheduling only when the selected profile explicitly enables it and
the exact article and destination have passed independent review. The profile's
`requires_human_article_acceptance` policy determines whether direct human acceptance or a valid session-scoped
release mandate is an additional gate. When profile listen-through is enabled, the author's confirmed listening to
the exact narration is a separate gate even when article acceptance is not required.

Each endpoint is limited to the selected profile's registered project subset, exact logical project, active commands,
and capability column. Provider account, article archive path, editorial preferences, and release cadence come from the
selected profile and effective article brief, not from this portable policy.
