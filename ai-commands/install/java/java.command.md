# java.command

## Purpose

Use `java` to install or verify the configured Java runtime required by the selected project.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Requested Java version/action and profile-authorized machine context. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Installed/selected Java runtime evidence or explicit failure. |

#command #install #java #jdk

Install AWS Corretto JDKs into the local `~/java/<major>-aws` layout used by the developer workstation.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/java/java.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/java/java.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Behavior

- Installs the requested Corretto major version from AWS tarballs.
- Supports `x86_64`, `aarch64`, and `arm64` hosts.
- Keeps installs under `~/java` by default; override with `JAVA_HOME_BASE`.
- Does not switch `~/java/current` unless `--switch` is provided.
- Reuses `~/confs/java/switch.sh` as `~/java/switch.sh` and `~/bin/java-switch` when available.

## Usage

```bash
${AI_COMMANDS_ROOT}/install/java/java.sh --major 11 --switch
${AI_COMMANDS_ROOT}/install/java/java.sh --major 21
${AI_COMMANDS_ROOT}/install/java/java.sh --major 11 --force --switch
```

## Notes

- This helper is for project-specific JDK needs that differ from the default `~/confs/java/setup.sh` matrix.
- Network access is required to download Corretto from `corretto.aws`.
