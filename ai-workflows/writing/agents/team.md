# Writing managed-agent team

This workflow composes the [common agent contract](../../agents.md), the [Writing workflow](../writing.workflow.md),
the [capability matrix](role-capability-ownership.csv), and the [communication matrix](role-communication-matrix.csv).
The matrices are the mechanical authority; this page explains their ownership and lifecycle without adding grants.

## Roster and ownership

| Agent | Human access | Ownership | Lifecycle |
| --- | --- | --- | --- |
| Admin | administration | Human-requested Writing workflow administration | persistent |
| Judge | oversight | Protected rule governance and compliance | persistent |
| Writer | primary | Article intake, draft, edit, archive, unpublished destination draft, critique disposition | persistent |
| Reviewer | primary | Independent critique and human-visible review report | persistent |
| Release Coordinator | primary | Review-gate check, account-history check, release slot and profile-authorized Medium scheduling | persistent |

Admin is the workflow administration identity; Judge, Writer, Reviewer, and Release Coordinator are the four governed
agents. The GPT adapter's mechanical controller creates the complete declared roster when initialization is authorized.
No role is scheduled or pooled. Release Coordinator may use Medium's native future scheduling only when the selected
profile explicitly enables it and the human has accepted the exact final article revision.

## Editorial sequence

The [editorial routing contract](editorial-routing.md) permits Writer to hand an exact finished revision directly to
Reviewer for independent critique, then permits Reviewer to return findings to that Writer. Both remain directly
human-addressable. The Reviewer must be independent of the exact revision it critiques, regardless of role label.
Writer dispositions the findings; the human accepts the final revision and selects Release Coordinator for timing.
Release Coordinator selects an eligible day and may schedule it on an enabled Medium destination without a second
approval. The human performs any immediate publication or submission. No other ordinary peer route is authorized.

Each agent is limited to the selected profile's registered project subset, exact logical project, active commands, and
its matrix column. Provider account, article archive path, editorial preferences, and release cadence come from the
selected profile and effective article brief, not from this portable team policy.
