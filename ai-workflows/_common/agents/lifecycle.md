# Common agent lifecycle

## Active agent state

In every workflow contract, **active Agent** means one exact initialized agent instance that the selected adapter reports
as active and routable. A deactivated instance is not a roster member, worker candidate, communication target,
initialization target, or clone source.

Archival is terminal for agent lifecycle identity. An archived task is retired, never an initialization target,
reactivation candidate, reuse candidate, clone source, or recovery option. Never restore, unarchive, resume, retry,
rebind, or message an archived agent, and never offer restoration to the human. A request to initialize, reconcile,
repair, or replace does not change this rule. Archive means discard and forget for operational purposes; the host
may retain history physically, but that history supplies no current agent authority.

Initialization selects only live, unarchived instances. Do not browse archived chats or read their transcripts to
find candidates. A retained receipt for an absent live task may require a minimal exact-ID host status check to
exclude stale authority; if that exact task is archived, classify it as retired and proceed without surfacing it
as a candidate or blocker. Archived receipts do not occupy active-role cardinality. Missing or ambiguous host
evidence still requires verification; it is not permission to guess an identity.

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

The common [`INIT`, `CLONE`, and `END`/`STOP` commands](self-commands.md) target one agent. In particular, an agent's
`INIT` reloads and verifies only that exact current instance. It is distinct from the workflow-owned complete-roster
`initialize` operation below.

The workflow-owned full-roster initialization entrypoint verifies or bootstraps Admin and performs all agent-instance
mutation through the selected platform adapter. Full-roster initialization creates the complete declared governed roster.
A separately supported Admin-only bootstrap, after direct human approval, creates or reuses only the declared Admin.
It verifies that instance's exact identity, scope, and `ADMIN_READY`; it neither initializes other roles nor establishes
full-roster readiness. Governor-originated bootstrap stops at verified readiness and direct human access to Admin;
it does not grant ongoing permission to message a human-only initialized Admin.

For the selected `codex-app` route, an authorized controller follows the reusable
[Admin-only procedure](../../../platforms/gpt-agents/agents/admin-only-initialization.md)
and its [bootstrap infrastructure overview](../../../platforms/gpt-agents/plugins/ai-fleas-gpt/modules/agent-bootstrap/README.md).
The preflight command is read-only; effectful initialization requires the trusted
controller APIs and host capabilities. Other platforms require their own supported
Admin-only route. Missing capability never authorizes full-roster fallback.

The authorized lifecycle controller may deliver only the exact self-scoped `INIT` under that approval. Its host-side
pending permit must bind the exact task and scope, carry a fresh nonce and expiry, and be consumed once. Verify these
conditions before delivery and before readiness. This exception grants no ordinary workflow instructions, follow-up
messages, or other self-commands; reject other task-to-Admin instructions. Explicit evidence-return and blocker routes
within existing human-authorized orchestration remain subject to their declared contract. Admin readiness still
requires its complete identity, source, scope, and bounded INIT-audit verification, not a requested token alone.

When a human requests full reinitialization including Admin, the active Admin creates one successor Admin in the same
runtime scope, verifies its exact returned instance ID, contract, source, runtime configuration, and `ADMIN_READY`
acknowledgement, and deactivates the predecessor only after the successor is ready. A failed successor leaves the
predecessor active.

Reinitialization then reconciles roster-owned scheduled triggers, deactivates the complete old governed roster, verifies
an inactive barrier, creates one fresh complete roster, binds platform-returned instance IDs, and verifies every readiness
token.

Ordinary `initialize` is idempotent for exact live, unarchived instances. Reuse a verified ready live instance;
initialize a fresh task for a missing role. If the entire previous roster was archived, the live roster is empty:
initialize a fresh declared roster, never restore the old one. Archived history is not a duplicate or a reason to
ask about restoration. Explicit replacement of a live instance or full reinitialization remains successor-first.

Do not archive and then unarchive an agent as a temporary initialization, writer-release, title, attachment,
or handoff mechanism. Use a supported non-archiving release route. If that route is unavailable, preserve the
unarchived candidate and report the actual missing capability rather than violating terminal archival.

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
