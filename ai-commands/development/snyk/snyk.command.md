# snyk.command

## Purpose

Use `snyk` to run configured dependency or code security checks and report actionable vulnerability evidence.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- If `AI_FLOW_OUTPUT_DIR` is set (project entrypoint), reports go to `${AI_FLOW_OUTPUT_DIR}/snyk/reports` (default:
`<project>/.ai/snyk/reports`).
- Otherwise, reports go to `ai-commands/snyk/reports` in the ai-config repo.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `snyk/snyk.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `snyk/snyk.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Run a Snyk scan from this command catalog against another project.
This command is the runner and performs the scan itself.
Logs are captured to a file and only shown on failure (or when requested).

## Config

- profile-owned configuration passed as `AI_COMMAND_CONFIG_PATH` or `SNYK_COMMAND_CONF`

## Usage

- `${AI_COMMANDS_ROOT}/snyk/snyk.command.sh [--project-dir <path>] [--output-dir <path>] [<repo_dir>]`
- `repo_dir` can be absolute or relative; defaults to `AI_FLOW_PROJECT_DIR` when set.

## Defaults

- Set `DEFAULT_REPO_DIR` in the profile-owned configuration to avoid passing the repo path each time.
- The `repo_dir` is the project selected at session start via the workflow; it’s part of the working context and is
exported as `AI_FLOW_PROJECT_DIR`.
- Before treating Snyk as required, check the selected project entry in the selected profile project definition (`AI_PROFILE_PROJECT_FILE`).
Project registry policy overrides the base review/Definition of Done rule:
  - `snyk_required: false` means skip Snyk for that project.
  - missing `snyk_required` means Snyk is required unless `snyk_project_url: NONE`.
  - `snyk_project_url` values other than `NONE` should be recorded in run notes or PR summaries.
- `SNYK_TOKEN` must be set in the environment or selected profile configuration before running.
- If `SNYK_TARGET_FILE` is not set, the command auto-detects a single `pom.xml`. If multiple are found, set `SNYK_TARGET_FILE`.

## Notes

- When choosing a fix (especially pom.xml dependency bumps), first check other config-services repos for similar fixes
and align versions to stay in sync unless the issue is truly project-specific.
- Auto-install: if Snyk CLI is missing, the command will attempt to install it using `SNYK_INSTALL_CMD` (preferred) or
`npm install -g snyk` when npm is available.
- If `SNYK_TOKEN` is missing, the command opens the Snyk API key page (default: https://app.snyk.io/account).
- Do not add one-off project names to this command. Express project-specific Snyk policy in the selected profile project definition (`AI_PROFILE_PROJECT_FILE`).
- On success, prints only `PASS`.
- On failure, prints only `FAIL` plus the log path (and JSON path if enabled).
- Set `SHOW_LOG=1` to print the full log on failure.
- Snyk returns a non-zero exit code when vulnerabilities are found. Set `SNYK_ALLOW_FAILURE=1` to treat that as non-fatal.
- Use `SNYK_MAVEN_ARGS` to pass Maven args that include spaces (e.g., settings.xml path).
- Use `SNYK_OUTPUT_FORMAT=json` (or `SNYK_JSON=1`) to capture JSON output in the reports directory.
- For multi-module Maven repos, set `SNYK_TARGET_FILE` to the intended `pom.xml` path.
