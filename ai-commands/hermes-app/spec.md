# Hermes App — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, project, and any action-specific options.

## Output

Verified Hermes profile state or a precise, non-secret failure.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- Hermes honors the logical agent properties defined by the selected workflow's [`agents.yml`](../../ai-workflows/dev/agents.yml), including `aiProvider`.
- Hermes does not own or redefine `aiProvider`; it only realizes the resolved value for the corresponding Hermes profile.
- The profile-owned provider catalog maps provider aliases to endpoint, protocol, authentication and available model details.
- Unknown provider aliases or provider configurations Hermes cannot realize fail closed before the affected role is mutated.
- Provider endpoint and authentication details remain profile-owned and are never embedded in reusable role definitions or Hermes mappings.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Setup validates dependencies before mutation.
- `initialize` realizes exactly the named logical roles in the selected Hermes workflow binding and an idempotent profile-workflow group containing those profiles.
- Initialized role profiles remain active in their group but are hidden from Hermes's flat top-level bot roster so profile-workflow groups are the primary navigation surface.
- Role-profile IDs contain profile, workflow, and role suffix only; project/repository IDs remain runtime configuration.
- `reconcile` uses the same resolved identity and preserves conversations and memory by default.
- Destructive replacement or deletion requires explicit human authorization and an exact safe profile identifier.

## Provider realization

For each logical agent, Hermes resolves the agent's `aiProvider` through the active profile configuration and applies the resulting provider configuration when creating or reconciling that Hermes profile.

The Hermes workflow mapping remains limited to platform realization details such as logical role → Hermes profile suffix. It does not duplicate portable logical-agent properties.

## Completion criteria

Hermes initialization verifies that each created/reconciled profile uses the resolved AI provider requested by its logical agent without exposing provider credentials.
