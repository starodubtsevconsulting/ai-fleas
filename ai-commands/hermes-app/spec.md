# Hermes App — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, project, and any action-specific options.

## Output

Verified Hermes profile state or a precise, non-secret failure.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- `aiProvider` is a portable logical-agent property defined by the workflow agent contract, alongside properties such as lifecycle, human-facing mode, communication mode, and elastic-pool behavior.
- AI provider and model are independent agent properties.
- Hermes consumes `aiProvider`; Hermes does not own or redefine it.
- `profile-default` means resolve the concrete provider alias from the active profile/workflow configuration. A logical agent may instead specify another provider alias when the active profile defines it.
- The profile-owned provider catalog maps stable AI provider aliases to endpoint, protocol, authentication and available model details.
- Unknown provider aliases or provider configurations Hermes cannot realize fail closed before the affected role is mutated.
- Provider endpoint and authentication details remain profile-owned and are never embedded in reusable role definitions.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Setup validates dependencies before mutation.
- `initialize` realizes exactly the named logical roles in the selected Hermes workflow binding and an idempotent profile-workflow group containing those profiles.
- Initialized role profiles remain active in their group but are hidden from Hermes's flat top-level bot roster so profile-workflow groups are the primary navigation surface.
- Role-profile IDs contain profile, workflow, and role suffix only; project/repository IDs remain runtime configuration.
- `reconcile` uses the same resolved identity and preserves conversations and memory by default.
- Destructive replacement or deletion requires explicit human authorization and an exact safe profile identifier.

## Portable agent contract

The logical workflow owns the property:

```yaml
agents:
  - agentId: manager
    lifecycle: persistent-control
    aiProvider: profile-default

  - agentId: coder
    lifecycle: disposable-worker
    aiProvider: profile-default
```

This is analogous to an interface/default-property contract: the logical agent declares the property and its default, while a concrete platform implementation decides how to realize it.

Hermes maps those logical agents to Hermes profiles. Another platform may map the same property differently. A platform that cannot support a requested provider must report that limitation rather than silently changing the logical configuration.

The Hermes-specific role mapping therefore contains only realization details such as role and profile suffix; it does not own `aiProvider` values.

## Completion criteria

Hermes initialization resolves each logical agent's effective `aiProvider` through the active profile provider catalog and applies the resulting provider configuration to that Hermes profile while preserving model selection as an independent property.
