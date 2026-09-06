# Hermes App — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, project, and any action-specific options.

## Output

Verified Hermes profile state or a precise, non-secret failure.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- Provider and model selection comes only from the active profile.
- A workflow selects stable provider-target and model aliases; the profile-owned catalog maps them to a machine endpoint,
  concrete provider model ID, capabilities, authentication reference, and optional Hermes context settings.
- `workflow.local_ai.provider` and `workflow.local_ai.model` are the default inference binding for every Hermes role in
  that workflow.
- `workflow.local_ai.agents.<role>.provider` and `workflow.local_ai.agents.<role>.model` may override those defaults for
  one role. Either property may be omitted and inherited independently from the workflow default.
- Every role's effective provider/model pair is resolved independently during initialization. Unknown providers, models,
  roles, unsupported protocols, or incompatible provider/model combinations fail closed before that role is mutated.
- Provider endpoint, authentication and model details remain defined once in the profile-owned provider catalog; role
  overrides contain only stable provider/model aliases and never duplicate endpoints or credentials.
- Multiple computers, remote inference services, and multiple models may coexist in one catalog. Replacing a model box
  must require only a catalog update and profile/workflow/role selection change, never a public command-code change.
- A workflow with no per-role overrides remains valid: every role inherits the existing workflow provider/model selection.
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

## Profile configuration shape

The existing provider catalog remains authoritative. No second provider catalog is introduced.

```yaml
workflows:
  - path: dev.workflow.md
    harness: hermes
    local_ai:
      providers_config: commands-config/hermes-app/config.yml
      provider: local-coding-service
      model: qwen-coder
      agents:
        coder:
          # inherits local-coding-service
          model: qwen-coder
        designer-reviewer:
          provider: openai
          model: gpt-5.6
```

Conceptual resolution for each role:

```text
workflow.local_ai provider/model
              +
optional local_ai.agents.<role> override
              ↓
effective provider/model for that Hermes role profile
```

The role override is profile configuration because provider IDs and available models are specific to the selected working
context. The reusable Hermes platform mapping continues to define which logical roles are realized and their profile
suffixes; it does not contain private provider IDs.

## Completion criteria

The command verifies the resulting profile identity, effective per-role provider and model, workspace, workflow contract,
allowed command contracts, and context-management configuration without exposing secrets.

A mixed Hermes team can initialize with different role profiles using different providers/models, while a profile that
specifies only the workflow-level provider/model continues to initialize every role with that default.
