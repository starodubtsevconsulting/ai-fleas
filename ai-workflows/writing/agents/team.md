# Writing managed-agent team

This workflow composes the [common agent contract](../../agents.md), the [Writing workflow](../writing.workflow.md),
the [capability matrix](role-capability-ownership.csv), and the [communication matrix](role-communication-matrix.csv).
The matrices are the mechanical authority; this page explains their ownership and lifecycle without adding grants.

## Roster and ownership

| Agent | Human access | Ownership | Lifecycle |
| --- | --- | --- | --- |
| Admin | administration | Human-requested Writing workflow administration and end-to-end orchestration | persistent |
| Judge | oversight | Protected rule governance and compliance | persistent |
| Writer | primary | Article intake, draft, edit, archive, unpublished destination draft, critique disposition | persistent |
| Reviewer | primary | Independent critique and human-visible review report | persistent |
| Release Coordinator | primary | Review-gate check, account-history check, release slot and profile-authorized Medium scheduling | persistent |

Admin is the workflow administration identity; Judge, Writer, Reviewer, and Release Coordinator are the four governed
agents. The GPT adapter's mechanical controller creates the complete declared roster when initialization is authorized.
No role is scheduled or pooled. Release Coordinator may use Medium's native future scheduling only when the selected
profile explicitly enables it and the human has directly accepted the exact final article revision or supplied a
still-valid session-scoped release mandate that delegates final selection to this review loop.

## Editorial sequence

The [Admin orchestration contract](admin-orchestration.md) makes Admin the sole inter-agent coordinator. Writer returns
the exact finished revision and proposed review packet to Admin; Admin assigns Reviewer; Reviewer returns findings to
Admin; Admin returns changes to Writer or advances an accepted revision to Release Coordinator. The Reviewer remains
independent of the exact revision it critiques, regardless of role label. Release Coordinator returns scheduling
evidence or blockers to Admin. Agents remain directly human-addressable, but they never use the human as a message
courier and never contact another specialist directly. The human performs any immediate publication or submission.

Each agent is limited to the selected profile's registered project subset, exact logical project, active commands, and
its matrix column. Provider account, article archive path, editorial preferences, and release cadence come from the
selected profile and effective article brief, not from this portable team policy.
