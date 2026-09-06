# comment.command

## Purpose

Use `comment` to create or update a bounded explanatory comment on the selected artifact or external work item.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- Optional `--file <path>` to append to.

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Prints the template to stdout, and appends to the file when requested.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `comment/comment.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `comment/comment.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `dev`

Use when you need a reusable "story" comment template for test scripts or notes.
This is a doc-adjacent command focused on in-code/script comments rather than new markdown docs.
For full documentation flow, see `ai-commands/doc/doc.command.md`.

Additional guidance (from smoke-tests):

- Do not use deprecated project `smoke-tests/hurl-api-caller.sh` (in project's folder we run test againts). Use the
ai-config fallback instead:
  - `HURL_CALLER=<ai-config-root>/ai-commands/smoke-tests/smoke-tests.command-hurl-api-caller.sh`
- When adding test scripts, include a short “story” header comment so anyone can understand intent quickly. Template:
  - `# Story: This script simulates <who/role> requesting <what>, overrides <which data>, and expects <result> across <entry points>.`
  - `# Example override: qaExpOverrides=expA=AA,expB=BB`
  - `# Expected shape (v1/v2): <compact JSON sketch or key fields>`
  - `# Data source: <S3 URL / fixture file / dataset reference>`
  - Story means: a sequential, plain-English narrative that explains why the test exists, what is being
changed/overridden, and what “success” looks like, without implementation details.

## Usage

- `${AI_COMMANDS_ROOT}/comment/comment.command.sh`
- `${AI_COMMANDS_ROOT}/comment/comment.command.sh --file <path>` (append template to a file)

## Notes

- The template is a short, sequential, plain-English narrative.
- Always include a data source reference when possible (S3 URL, fixture file, dataset).
