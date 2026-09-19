# browser.command

## Purpose

Use `browser` to perform bounded browser navigation and interaction when a task requires a visible web surface.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

|- url(s) to open, see [browser.command.sh](browser.command.sh) and [Usage](#usage)
|- --project-dir: set project directory (maps to `AI_FLOW_PROJECT_DIR`)
|- --output-dir: set output directory (maps to `AI_FLOW_OUTPUT_DIR`)
|- --file: read URLs from a file (one per line; blank lines and `#` comments ignored)
|- --detach: launch browser in background (default)
|- --no-detach/--foreground: run browser in foreground (for debugging)
|- --embedded: open URLs in desktop preview pane (for GPT/Hermes apps)
|- --desktop: open URLs in system browser (default mode)
|- --profile: select AI profile (profile-aware, resolves `browser.default_mode` config)
|- --workflow: select workflow (profile-aware, validates command permission)

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- node

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `browser/browser.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `browser/browser.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #browser

Use when you need to open one or more URLs in a local browser.

## Usage

|- `${AI_COMMANDS_ROOT}/browser/browser.command.sh <url1> <url2> ...`
|- `${AI_COMMANDS_ROOT}/browser/browser.command.sh --file <path>` (one URL per line; blank lines and lines starting with `#` are ignored)
|- `${AI_COMMANDS_ROOT}/browser/browser.command.sh --embedded <url>` (open in desktop preview pane)
|- `${AI_COMMANDS_ROOT}/browser/browser.command.sh --desktop <url>` (open in system browser)
|- `${AI_COMMANDS_ROOT}/browser/browser.command.sh --no-detach <url>` (run in foreground for debugging)

## Config

- `browser.default_mode`: `"desktop"` (system browser) or `"embedded"` (desktop preview)
- `browser.use_embedded_by_default`: `true` (force embedded mode by default)
- profile-owned configuration passed as `AI_COMMAND_CONFIG_PATH` or `BROWSER_COMMAND_CONF`

## Notes

- The script prints each URL and attempts to open it with `xdg-open` or `open`.
- If no opener is available, it will print the URLs to open manually.
- This command is safe to use with many links at once.
- When `--embedded` is selected (or `browser.default_mode=embedded` in profile), URLs are printed as instructions for the desktop preview pane instead of launching a system browser.

## Roles selection

- dev
- qa (if user for manual testing)
