# Hermes App — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, project, and any action-specific options.

## Output

Verified Hermes profile state or a precise, non-secret failure.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- The workflow owns the team/role roster in its [`agents.yml`](../../ai-workflows/dev/agents.yml). Hermes does not define a second roster.
- Hermes honors the workflow role properties it supports, including `aiProvider`, when realizing those roles as Hermes profiles.
- The profile-owned provider catalog maps provider aliases to endpoint, protocol, authentication and available model details.
- Unknown provider aliases or provider configurations Hermes cannot realize fail closed before the affected role is mutated.
- Provider endpoint and authentication details remain profile-owned and are never embedded in reusable role definitions.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Setup validates dependencies before mutation.
- `initialize` realizes exactly the roles declared by the selected workflow and creates an idempotent profile-workflow group containing the resulting Hermes profiles.
- `reinitialize` deletes the exact resolved group and role profiles, verifies their removal, observes a bounded desktop synchronization barrier, clears only that group's deletion tombstone, and creates a fresh complete generation; it requires `--confirm-reinitialize`.
- Initialized role profiles remain active in their group but are hidden from Hermes's flat top-level bot roster so profile-workflow groups are the primary navigation surface.
- Role-profile IDs contain profile, workflow, and role suffix only; project/repository IDs remain runtime configuration.
- `reconcile` uses the same resolved identity and preserves conversations and memory by default.
- Destructive replacement or deletion requires explicit human authorization, executable confirmation, and an exact resolved workflow identity.

## Provider realization

For each workflow role, Hermes resolves `aiProvider` through the active profile configuration and applies the resulting provider configuration when creating or reconciling that Hermes profile.

Hermes-specific code owns only the mechanics of realizing a workflow role as a Hermes profile/group member. The role set and portable role properties remain workflow-owned.

## Completion criteria

Hermes initialization verifies that every role declared by the workflow is realized exactly once and that each resulting profile uses the resolved AI provider requested by that role without exposing provider credentials.
