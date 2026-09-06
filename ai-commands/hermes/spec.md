# Hermes — Specification

**Status: ACTIVE**

## Input

A profile-management intent plus an explicitly selected AI profile, workflow, project, and any action-specific options.

## Output

Verified Hermes profile state or a precise, non-secret failure.

## Invariants

- Public files contain no organization, client, machine, endpoint, credential, or private-platform defaults.
- Provider and model selection comes only from the active profile.
- Workflow and command contracts are resolved exactly and injected as references, not duplicated into this command.
- Setup validates dependencies before mutation.
- Reconciliation preserves profile data by default.
- Destructive replacement or deletion requires explicit human authorization and an exact safe profile identifier.
- Host-specific implementation lives in the selected platform adapter or private companion repository.

## Completion criteria

The host adapter verifies the resulting profile identity, provider, model, workspace, workflow contract, allowed command
contracts, and context-management configuration without exposing secrets.
