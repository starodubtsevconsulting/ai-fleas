# kdenlive.command

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
