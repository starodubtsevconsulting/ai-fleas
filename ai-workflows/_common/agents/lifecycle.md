# Common agent lifecycle

## Active agent state

In every workflow contract, **active Agent** means one exact initialized agent instance that the selected adapter reports
as active and routable. A deactivated instance is not a roster member, worker candidate, communication target,
initialization target, or clone source.

It remains inactive unless the human separately and explicitly authorizes reactivating that exact instance ID. General
retry, repair, initialization, replacement, cloning, or staffing language never supplies that authorization. Visibility
and preservation mechanics are platform concerns.

## Readiness and contract inheritance

Every workflow agent composes the common agent contract with workflow-specific contracts. The workflow supplies its
additional team roles, capability grants, communication topology, readiness tokens, and any stricter packet schema. The
platform binding supplies runtime configuration.

A changed common or workflow-specific contract requires the workflow's declared reload or reinitialization path before an
existing agent may rely on it. Partial initialization or conversational replacement of contract rules is prohibited.

## Required Admin and Judge roles

Every agent-enabled workflow declares exactly one persistent human-facing `Admin` infrastructure agent and exactly one
persistent human-facing `Judge` oversight role. Canonical identities remain `admin` and `judge`; presentation labels are
owned by the selected platform binding.

Admin owns only workflow information and exact agent lifecycle administration. It remains outside the governed team and
every governed Team capability policy, is never an operational relay or product worker, and is preserved during
governed-roster reinitialization.

Judge belongs to the governed roster, owns that workflow's protected rules and compliance oversight, and remains subject
to the workflow's human-approval, communication-firewall, validation, and publication gates. A workflow may narrow these
roles but must not transfer their common ownership to another role.

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

Human words such as archive, remove, or delete request deactivation; the selected adapter defines the safest supported
preservation mechanic. Partial generations, implicit profile selection, label-only identity, hidden substitutes, and
cross-project reuse are `BLOCKED`.

## Workflow extension boundary

Each workflow declares its additional roles and exact team size in its own `agents/team.md`; only Judge appears in that
governed-team table from the required pair. The workflow selects common Admin and Judge roles through `agents.yml` and
supplies its initializer, initialization contract, capability data, communication topology, focused tests, and any portable
scheduled-trigger requirements.

Models, reasoning, concrete presentation, and transport remain platform-binding concerns. A workflow without managed
agents does not load the common agent contract, but it must load it before introducing any agent role or lifecycle
behavior.
