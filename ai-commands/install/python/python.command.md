# python.command

## Purpose

Use `python` to install or verify the configured Python runtime required by the selected project.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Requested Python version/action and profile-authorized machine context. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Installed/selected Python environment evidence or explicit failure. |

#command #install #python #pip #dependency

Install Python package dependencies needed by ai-config commands.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/python/python.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/python/python.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Behavior

- Detects whether a requested Python import is already available.
- Installs missing packages with `python3 -m pip install --user <package>` by default.
- Supports `--package <name>` and `--import <module>` for command-specific dependencies.
- Exits successfully without changes when the import is already available.
- Network access is required when a package must be installed.

## Usage

```bash
${AI_COMMANDS_ROOT}/install/python/python.sh --package Pygments --import pygments
```

## Notes

- This helper is intended for lightweight Python dependencies used by ai-config command scripts.
- Prefer command-local detection before calling this installer so startup remains fast when dependencies are already present.
