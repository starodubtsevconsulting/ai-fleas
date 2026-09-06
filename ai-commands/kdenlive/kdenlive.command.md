# kdenlive.command

## Purpose

Use `kdenlive` to prepare, edit, render, or verify a video project through the documented Kdenlive workflow.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Multimedia project, requested edit/render action, and profile-owned settings. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Kdenlive project/render artifact and execution evidence. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `kdenlive/kdenlive.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |
| `kdenlive/kdenlive.command.mjs` | Node executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `kdenlive/kdenlive.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #multimedia #video #kdenlive #validation #scaffold

## Intent

Create and validate a portable Kdenlive project from a standard multimedia project folder. This command owns Kdenlive's
MLT/XML structure and its template; workflows own their media and decide when to invoke it.

## Usage

```bash
./kdenlive.command.sh scaffold --project-path /absolute/path/to/video
./kdenlive.command.sh validate --project-path /absolute/path/to/video
```

`scaffold` writes `project.kdenlive` from the command-owned empty-project template. It registers
`audio/narration-v1.wav` and `scene/001.png` through `scene/003.png` as actual `main_bin` entries so Kdenlive does not
consider them unreferenced clips.

`validate` checks that the Kdenlive bin refers to each required media file and that those files exist. It emits JSON on
success and exits non-zero with actionable errors otherwise.

Use `--force` only when intentionally replacing an existing Kdenlive project.

## Contract

Input project folder:

```text
audio/narration-v1.wav
scene/001.png
scene/002.png
scene/003.png
```

Output:

```text
project.kdenlive
```

Paths in the Kdenlive file are relative to the project folder, making a complete project portable as one directory.

## Runtime discovery

Workflows declare this command as `kdenlive` in their `workflow.yml` under
`required_commands`. At runtime they receive the catalog location through
`AI_WORKFLOW_COMMANDS_ROOT`, which comes from the selected profile's
`ai_commands_root`. This command never requires a workflow-specific absolute
path.

## Test

```bash
./test/test.sh
```
