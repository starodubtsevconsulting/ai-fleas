# Hermes App — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, complete ordered project set, and any action-specific options.

## Output

One aggregate verified lifecycle result or a precise, non-secret failure. Per-profile progress messages are not aggregate
success. Workflow readiness requires both `all_agents_ready=true` and its durable workflow receipt. System readiness
requires a verified profile, scheduler, running gateway, and durable System receipt.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- The selected workflow owns the team/role roster in `ai-workflows/<workflow>/agents.yml`. Hermes does not define a second roster.
- Hermes honors the workflow Agent properties it supports, including `aiProvider` and `flow`, when realizing those Agents as Hermes profiles.
- The profile-owned provider catalog maps provider aliases to endpoint, protocol, authentication and available model details.
- An optional profile-owned workflow Agent binding maps a workflow Agent or its declared `aiProvider` binding name to one provider alias and model alias.
- Unknown providers, models, flows, contracts, workspaces, or runtime dependencies fail closed during complete-roster preflight before any workflow profile is mutated.
- Provider endpoint and authentication details remain profile-owned and are never embedded in reusable role definitions.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Profile setup validates its static contracts, runtime dependencies, endpoint response, and advertised model before mutation.
- `initialize` realizes exactly the roles declared by the selected workflow and creates an idempotent profile-workflow group containing the resulting Hermes profiles.
- Workflow initialization preflights the complete resolved roster before mutation, writes no ready receipt after a partial failure, and emits `HERMES_WORKFLOW_READY` with the exact Agent count, ordered profile IDs, and `all_agents_ready=true` only after every Agent and the receipt writer succeed.
- `initialize-system` realizes exactly one globally pinned profile with no workflow-group membership and exactly one profile-scoped scheduler. By default, its ordered watch set contains every Hermes workflow declared by the selected work profile. Explicit `--watch-group` arguments may select a narrower subset of that derived set but cannot cross the work-profile boundary. It writes or replaces the System receipt only after the profile, scheduler, gateway, and ticker are verified ready.
- A System profile's runtime ID and visible title are the same lowercase, profile-qualified ID (for example, `sc-system`); a generic or capitalized `System` title must not obscure profile ownership or diverge from the naming convention.
- System and workflow initialization preserve one profile-owned Hermes binding registry. System resolves groups and profiles only from exact receipts; a missing group receipt remains pending.
- `reinitialize` requires `--confirm-reinitialize` and preflights the complete replacement generation before deleting anything. Only after successful preflight may it delete the exact resolved group and role profiles, verify their removal, observe a bounded desktop synchronization barrier, clear only that group's deletion tombstone, and create the fresh generation.
- Initialized role profiles remain active in their group but are hidden from Hermes's flat top-level bot roster so profile-workflow groups are the primary navigation surface.
- Role-profile IDs contain profile, workflow, and role suffix only; project/repository IDs remain runtime configuration.
- Every role profile receives the complete ordered workflow project set. The first entry is the primary/default working
  directory and later entries remain authorized associated projects; a project selector never collapses that scope.
- Generated `SOUL.md` content is a platform delivery artifact derived from profile, workflow, role, command, and project
  contracts. It must not redefine or omit those portable contracts.
- `reconcile` uses the same resolved identity and preserves conversations and memory by default.
- Destructive replacement or deletion requires explicit human authorization, executable confirmation, and an exact resolved workflow identity.
- Workflow profile servers are started and supervised by Hermes Desktop, not by the AI Fleas initializer. The persistent System gateway is the only background service whose installation is requested by this command.

## Lifecycle result contract

The command emits stable, machine-readable result prefixes with human-readable context:

| Result | Meaning |
|---|---|
| `HERMES_CONFIGURATION_ERROR` | A requested provider or model alias is absent from profile configuration; the message gives the reason, source file, configured alternatives, corrective action, and safety outcome. |
| `HERMES_WORKFLOW_PREFLIGHT` | Complete-roster validation started; no mutation is implied. |
| `HERMES_MODEL_TARGET_READY` | One profile target passed endpoint and advertised-model validation. |
| `HERMES_WORKFLOW_READY` | Every declared Agent succeeded and the workflow receipt was written. |
| `HERMES_WORKFLOW_PREFLIGHT_FAILED` | Validation failed before workflow mutation; reports the complete failed-profile set after checking the full roster. |
| `HERMES_WORKFLOW_PARTIAL_FAILURE` | Mutation failed after the listed profiles completed; no ready receipt was written. |
| `HERMES_WORKFLOW_RECEIPT_FAILED` | All profiles were configured, but readiness was not recorded. |
| `SYSTEM_READY` | System profile, scheduler, gateway, ticker, and receipt are verified ready. |

Failures identify the logical group and affected profile when applicable. Configuration failures name the exact provider
catalog, missing provider or model alias, and available aliases. Target failures distinguish DNS, connection, timeout,
HTTP, invalid model-list, and missing advertised-model conditions without exposing credentials. Workflow preflight checks
the complete roster and reports every failed profile before returning; it never stops with only the first Agent's result.

## Package structure

- Root `*.sh` files are stable, human-facing launchers.
- `src/` contains implementation modules for resolution, validation, orchestration, group configuration, session migration,
  installer supervision, and receipt writing.
- `tests/` contains executable verification and failure-injection tests.
- Contracts, manifests, examples, and documentation remain at the command root.

## Provider realization

For each workflow Agent, Hermes resolves its profile-owned binding when configured, otherwise its declared provider or
the workflow default. Provider and model aliases must resolve exactly once through the active profile provider catalog.
The resulting provider, concrete model, context, and compression settings apply only to that Hermes profile.

When an Agent declares `flow`, Hermes resolves the file within the workflow catalog and includes that exact flow with
the reusable Role contract in the Agent's generated `SOUL.md`. Unknown bindings, models, flows, or escaping paths fail
before profile mutation.

Hermes-specific code owns only the mechanics of realizing a workflow role as a Hermes profile/group member. The role set and portable role properties remain workflow-owned.

## Completion criteria

Hermes workflow initialization is complete only when every Agent declared by the selected workflow is realized exactly
once, uses its resolved provider and model, receives its assigned Role and flow, belongs to the exact group, and appears
in the ordered ready receipt without exposing provider credentials. The command must emit one matching aggregate
`HERMES_WORKFLOW_READY` result. A collection of per-profile success messages is not completion.

Hermes System initialization is complete only when the exact global profile is configured and pinned, the exact
profile-scoped scheduler exists and is enabled, its gateway/ticker is running, and the final System receipt represents
that verified state. Failure before that point must not leave a newly written ready receipt.
