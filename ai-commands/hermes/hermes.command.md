# Hermes

## Purpose

Use `hermes` to route an authorized prompt through the profile-selected local Hermes provider and return its result.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Active profile, Hermes platform binding, bot scope, and requested lifecycle action. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Host-neutral Hermes request/receipt or explicit unsupported-platform result. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `hermes/hermes.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `hermes/hermes.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #hermes #local-ai #profile-management

Define the portable contract for managing Hermes Agent profiles through a host-provided adapter.

## Intent mapping

Use this command for requests to create, inspect, validate, reconfigure, or explicitly delete a Hermes profile. The
active AI profile supplies the workflow, project, provider, model, workspace, and agent-instruction bindings.

## Required behavior

- Resolve every provider, model, workflow, project, and command binding through the selected AI profile.
- Validate the model endpoint and advertised model before creating or changing a profile.
- Generate agent instructions that identify the selected workflow and commands without embedding private configuration.
- Preserve conversations and memory during reconciliation unless the human explicitly requests replacement from scratch.
- Require explicit confirmation and an exact profile identifier before deletion.
- Refuse credentials, private endpoints, machine paths, or organization-specific defaults in this public contract.

## Host adapter

Hermes installation, CLI invocation, desktop integration, provider authentication, context-window tuning, and profile
storage are host-owned mechanics. A platform adapter may implement those mechanics while preserving this contract. This
public command intentionally ships no provider-specific executable.

## Safety

- Never delete a default or unnamed profile.
- Never infer a private companion platform from nearby directories.
- Never print credentials or persist them in generated instructions.
- Never broaden the selected workflow's command set.

See [spec.md](spec.md) for acceptance requirements.
