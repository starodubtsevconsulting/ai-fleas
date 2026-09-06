# terminal.command

## Purpose

Use `terminal` to install, configure, or verify the documented terminal environment for the selected workspace.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Requested terminal setup/action and profile-authorized machine context. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Configured terminal evidence or explicit failure. |

#command #install #terminal #tmux

Install terminal prerequisites used by the AI Workflow Suite, currently focused on `tmux`.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/terminal/terminal.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/terminal/terminal.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Behavior

- Detect whether `tmux` is already installed; if yes, exit successfully without changes.
- Detect the local platform/package manager:
  - macOS: `brew`
  - Ubuntu/Debian: `apt-get`
  - Fedora/RHEL: `dnf` or `yum`
  - Arch: `pacman`
- Prompt before installing when running interactively.
- Exit non-zero with a clear message when no supported installer is available.

## Usage

```bash
${AI_COMMANDS_ROOT}/install/terminal/terminal.sh
${AI_COMMANDS_ROOT}/install/terminal/terminal.sh --ensure-tmux
```

## Notes

- `start.sh` and terminal tmux launchers may call this command automatically when `tmux` is missing.
- Installation may require `sudo` on Linux.
