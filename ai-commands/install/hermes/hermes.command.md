# hermes

## Purpose

Use `hermes` inside the `install` command group to manage physical Hermes software without encoding its installation
form in the command identity. It can inspect, smoke-test, install, check for updates, upgrade, or uninstall a selected
component on macOS Apple Silicon. The current implementation supports the reviewed `bundle`; future adapters may add
standalone application, backend, or CLI forms without renaming the command. The separate `hermes-app` command manages Hermes profiles,
bots, conversations, and workflow groups.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes local software lifecycle execution and resolves profile-owned settings. |
| Action | Yes | User | `status`, `smoke-test`, `install`, `check-update`, `update`, `upgrade`, or `uninstall`. |
| Component | No | User or profile | Installation form selected with `--component`; defaults to `bundle`. Unsupported values fail closed. |
| Local platform | Yes | Runtime | Must be exactly `Darwin/arm64`. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Installation result | Caller | Verified Hermes version, offline smoke evidence, stable-update recommendation, or exact no-mutation failure. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/hermes/hermes.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke `<action> [--component bundle]` through the command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve
`AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/hermes/hermes.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Supported Prompts

| Human prompt | Expected result |
|---|---|
| `Is Hermes installed?` | Report the exact installed Hermes version without mutation. |
| `Smoke-test Hermes` | Run isolated offline `--version` and `--help` probes. |
| `Install Hermes` | Run the reviewed installer, verify the pinned result, and require a passing smoke test. |
| `Check for a Hermes update` | Compare installed, latest stable, and reviewed supported versions without mutation. |
| `Upgrade Hermes` | Apply the reviewed stable version only after explicit authorization, then smoke-test it. |
| `Uninstall Hermes` | Require explicit confirmation and preserve profiles and conversations; fail closed until an ownership-safe remover exists. |

## Linked Commands

| Command | Relationship | Use when |
|---|---|---|
| [`install`](../install.command.md) | Parent command group and alias router | A generic installation request such as `Install Hermes` needs routing to this command. |
| [`hermes-app`](../../hermes-app/hermes-app.command.md) | Dependent platform lifecycle command | The installed application will initialize or manage Hermes profiles, bots, conversations, or workflow groups. |

This command establishes the physical prerequisite only. A successful installation never initializes bots automatically.

## Behavior

- Supports local `Darwin/arm64` only.
- Keeps installation form orthogonal to command identity. Currently supported: `bundle`; possible future forms include
  reviewed application, backend, and CLI adapters.
- Treats `update` as the read-only alias of `check-update`; `upgrade` is the mutating action.
- Reuses the public reviewed Hermes installer and its rollback checks without depending on a private launcher.
- Requires isolated `--version` and offline `--help` probes after install or upgrade.
- Never deletes Hermes profiles, conversations, workflow groups, provider configuration, or credentials.

## Tags

#command #install #hermes-app #macos #apple-silicon #smoke-test
