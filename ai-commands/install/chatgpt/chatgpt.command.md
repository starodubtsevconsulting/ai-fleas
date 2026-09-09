# chatgpt

## Purpose

Use `chatgpt` inside the `install` command group to manage physical ChatGPT software without encoding its installation
form in the command identity. It can inspect, smoke-test, install, check for updates, upgrade, or uninstall a selected
component on macOS Apple Silicon. The current implementation supports `app`; future reviewed adapters may add other
components without renaming the command. The separate `gpt-agents` command manages
logical agents, Codex tasks, saved-project bindings, and sidebar groups.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes local software lifecycle execution. |
| Action | Yes | User | `status`, `smoke-test`, `install`, `check-update`, `update`, `upgrade`, or `uninstall`. |
| Component | No | User or profile | Installation form selected with `--component`; defaults to `app`. Unsupported values fail closed. |
| Local platform | Yes | Runtime | Must be exactly `Darwin/arm64`. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Installation result | Caller | Verified application identity/version, smoke evidence, recommendation, or exact no-mutation unavailable/unsupported result. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/chatgpt/chatgpt.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke `<action> [--component app]` through the command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve
`AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/chatgpt/chatgpt.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Supported Prompts

| Human prompt | Expected result |
|---|---|
| `Is GPT installed?` | Report the exact installed application path, version, and build without mutation. |
| `Smoke-test GPT App` | Verify its bundle, executable, and signature without launching a user session. |
| `Install GPT` | Use the trusted desktop installer or return `GPT_APP_INSTALL_UNAVAILABLE` without substituting Codex CLI. |
| `Check for a GPT update` | Use the trusted host update channel or return an exact unavailable result. |
| `Upgrade GPT` | Upgrade only after explicit authorization and require a passing smoke test. |
| `Uninstall GPT App` | Require explicit confirmation and remove only adapter-owned application artifacts when supported. |

## Linked Commands

| Command | Relationship | Use when |
|---|---|---|
| [`install`](../install.command.md) | Parent command group and alias router | A generic installation request such as `Install ChatGPT` or `Install GPT` needs routing to this command. |
| [`gpt-agents`](../../gpt-agents/gpt-agents.command.md) | Dependent platform lifecycle command | The installed application will initialize or manage AI Fleas logical agents, Codex tasks, or sidebar groups. |

This command establishes the physical prerequisite only. A successful installation never initializes agents automatically.

## Behavior

- Supports local `Darwin/arm64` only.
- Keeps installation form orthogonal to command identity. Currently supported: `app`; possible future forms include a
  reviewed backend or bundle adapter.
- Treats `update` as the read-only alias of `check-update`; `upgrade` is the mutating action.
- Keeps `install/codex` distinct because it installs Codex CLI rather than the desktop application.
- Fails closed when the host lacks a reviewed installation, update, upgrade, or uninstall operation.
- Never removes Codex tasks, chats, projects, sidebar sections, repositories, credentials, or other user data.

## Tags

#command #install #gpt-agents #chatgpt #macos #apple-silicon
