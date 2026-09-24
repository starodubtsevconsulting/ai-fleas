# Common agent lifecycle

## Active agent state

In every workflow contract, **active Agent** means one exact initialized agent instance that the selected adapter reports
as active and routable. A deactivated instance is not a roster member, worker candidate, communication target,
initialization target, or clone source.

It remains inactive unless the human explicitly authorizes a lifecycle operation that includes it. An exact workflow
`initialize` or `reconcile` request naming the profile, workflow, and logical project authorizes reactivation of that
scope's exact receipt-backed archived roster members; the human does not need to repeat every immutable instance ID.
This authorization never extends to unrecorded, ambiguous, foreign-scope, superseded, or merely same-titled tasks.
Generic retry, repair, replacement, cloning, or staffing language still supplies no reactivation authority. Visibility
and preservation mechanics are platform concerns.

## Readiness and contract inheritance

Every workflow agent composes the common agent contract with workflow-specific contracts. The workflow supplies its
additional team roles, capability grants, communication topology, readiness tokens, and any stricter packet schema. The
platform binding supplies runtime configuration.

A changed common or workflow-specific contract requires the workflow's declared reload or reinitialization path before an
existing agent may rely on it. Partial initialization or conversational replacement of contract rules is prohibited.

## Required Admin and optional Judge roles

Every agent-enabled workflow declares exactly one persistent human-facing `Admin` infrastructure agent. A workflow may
also declare exactly one persistent human-facing `Judge` oversight role when it needs a dedicated governance endpoint.
Canonical identities remain `admin` and `judge`; presentation labels are owned by the selected platform binding.

In ordinary administration, Admin owns workflow information and exact agent lifecycle administration, is not an
operational relay or product worker, and is preserved during governed-roster reinitialization. Its human-requested
[Admin can](../roles/admin.md#admin-can) follows the selected repository’s Admin authority without
changing governed role ownership or peer communication policy.

When declared, Judge belongs to the governed roster, owns that workflow's protected rules and compliance oversight, and
remains subject to the workflow's human-approval, communication-firewall, validation, and publication gates. When Judge
is absent, Admin may perform the common Admin contract's local governance validation and faithful maintenance; policy
meaning remains human-owned. A workflow may narrow these roles but must not transfer their ownership to a worker role.

## Initialization lifecycle

The workflow-owned initialization entrypoint verifies or bootstraps Admin and performs all agent-instance mutation through
the selected platform adapter. Initialization creates the complete declared governed roster.

When a human requests full reinitialization including Admin, the active Admin creates one successor Admin in the same
runtime scope, verifies its exact returned instance ID, contract, source, runtime configuration, and `ADMIN_READY`
acknowledgement, and deactivates the predecessor only after the successor is ready. A failed successor leaves the
predecessor active.

Reinitialization then reconciles roster-owned scheduled triggers, deactivates the complete old governed roster, verifies
an inactive barrier, creates one fresh complete roster, binds platform-returned instance IDs, and verifies every readiness
token.

Ordinary `initialize` is idempotent recovery, not forced generation rotation. It first restores exact archived tasks from
trusted receipts when their scope and platform project binding still match, including when the complete roster is
archived. Fresh task creation is reserved for roles with no valid active or archived receipt-backed instance. An explicit
replacement or full reinitialization continues to use successor-first generation rotation.

Human words such as archive, remove, or delete request deactivation; the selected adapter defines the safest supported
preservation mechanic. Partial generations, implicit profile selection, label-only identity, hidden substitutes, and
cross-project reuse are `BLOCKED`.

## Workflow extension boundary

Each workflow declares its additional roles and exact team size in its own `agents/team.md`. The workflow selects common
Admin and, when needed, Judge roles through `agents.yml`, and supplies its initializer, initialization contract, capability
data, communication topology, focused tests, and any portable scheduled-trigger requirements.

Models, reasoning, concrete presentation, and transport remain platform-binding concerns. A workflow without managed
agents does not load the common agent contract, but it must load it before introducing any agent role or lifecycle
behavior.
