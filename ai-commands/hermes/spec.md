# Hermes — Specification

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
- Multiple computers and multiple models may coexist in one catalog. Replacing a model box must require only a catalog
  update and workflow selection change, never a public command-code change.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Setup validates dependencies before mutation.
- Reconciliation preserves profile data by default.
- Destructive replacement or deletion requires explicit human authorization and an exact safe profile identifier.
- Hermes profile resolution and reconciliation live in this public command. A platform adapter may launch the command or
  present its result, but must not own or duplicate its configuration semantics.

## Completion criteria

The command verifies the resulting profile identity, provider, model, workspace, workflow contract, allowed command
contracts, and context-management configuration without exposing secrets.
