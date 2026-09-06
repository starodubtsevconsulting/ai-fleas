# Hermes App — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, project, and any action-specific options.

## Output

Verified Hermes profile state or a precise, non-secret failure.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- AI provider and model are independent agent properties.
- The profile-owned provider catalog maps stable AI provider aliases to endpoint, protocol, authentication and available model details.
- Every Hermes role binding explicitly declares its `ai_provider` alias. Initialization resolves that alias through the active profile-owned provider catalog for that role.
- Model selection remains governed by the existing model configuration and is not implicitly changed when `ai_provider` is introduced.
- Different Hermes agents may therefore use different AI providers while retaining independent model selection.
- Unknown AI provider aliases, unsupported protocols, or provider/model combinations that cannot be realized fail closed before that role is mutated.
- Provider endpoint, authentication and model details remain defined once in the profile-owned provider catalog; agent bindings contain only stable provider aliases and never duplicate endpoints or credentials.
- Multiple computers, remote inference services, and multiple models may coexist in one catalog. Replacing a model box or changing a remote provider must not require public command-code changes.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Setup validates dependencies before mutation.
- `initialize` realizes exactly the named roles in the selected Hermes workflow binding and an idempotent
  profile-workflow group containing those profiles; it does not infer the GPT adapter's runtime roster.
- Initialized role profiles remain active in their group but are hidden from Hermes's flat top-level bot roster so the
  profile-workflow groups are the primary navigation surface.
- Role-profile IDs contain profile, workflow, and role suffix only; project/repository IDs remain runtime configuration.
- `reconcile` uses the same resolved identity and preserves conversations and memory by default.
- Reconciliation preserves profile data by default.
- Destructive replacement or deletion requires explicit human authorization and an exact safe profile identifier.
- Hermes profile resolution and reconciliation live in this public command. A platform adapter may launch the command or
  present its result, but must not own or duplicate its configuration semantics.

## Hermes role mapping

The reusable Hermes mapping makes the AI provider explicit for every role:

```yaml
bindings:
  - role: manager
    profile_suffix: manager
    ai_provider: local-coding-service

  - role: coder
    profile_suffix: coder
    ai_provider: local-coding-service
```

`ai_provider` is a stable alias resolved against the active profile's existing provider catalog. It is not an endpoint and must not contain credentials.

The value may be different for every role, for example:

```yaml
bindings:
  - role: designer-reviewer
    profile_suffix: designer-reviewer
    ai_provider: openai

  - role: coder
    profile_suffix: coder
    ai_provider: local-coding-service
```

The model remains a separate property. Selecting `ai_provider: openai` does not itself select or change the agent's model.

## Completion criteria

The command verifies the resulting profile identity, effective per-role AI provider, model, workspace, workflow contract,
allowed command contracts, and context-management configuration without exposing secrets.

A Hermes team can initialize different role profiles against different AI providers while preserving the existing independent model configuration.
