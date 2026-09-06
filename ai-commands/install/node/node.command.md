# node.command

## Purpose

Use `node` to install or verify the configured Node.js runtime required by the selected project.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Requested Node.js version/action and profile-authorized machine context. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Installed/selected Node.js runtime evidence or explicit failure. |

#command #install #node #npm #dependency

Install Node/npm package dependencies needed by ai-config commands.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/node/node.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/node/node.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Behavior

- Detects whether a requested Node package can be resolved from a target directory.
- Installs missing packages with `npm install --prefix <dir> <package>` by default.
- Supports command-local installs so command dependencies do not require repo-root package metadata.
- Exits successfully without changes when the package is already available.
- Network access is required when a package must be installed.

## Usage

```bash
${AI_COMMANDS_ROOT}/install/node/node.sh --package mermaid --prefix ai-commands/show-context
```

## Notes

- Use this for npm-backed renderers or CLIs that ai-config commands need locally.
- Prefer command-local detection before calling this installer so startup remains fast when dependencies are already present.
