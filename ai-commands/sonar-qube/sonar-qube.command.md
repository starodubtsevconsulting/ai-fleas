# sonar-qube.command

## Purpose

Use `sonar-qube` to inspect configured SonarQube quality results and report relevant findings and gate status.

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

- Updated files/logs/reports described above
- Terminal output and exit status

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `sonar-qube/sonar-qube.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `sonar-qube/sonar-qube.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `dev`

Run a SonarQube scan from THIS `ai` repo against another project.
This command is the runner and performs the build + scan itself.
Logs are captured to a file and only shown on failure (or when requested).

## Config

- profile-owned configuration passed as `AI_COMMAND_CONFIG_PATH` or `SONAR_COMMAND_CONF`

## Usage

- `${AI_COMMANDS_ROOT}/sonar-qube/sonar-qube.command.sh [--profile <profile>] [--project-dir <path>] [--output-dir <path>] [<repo_dir>]`
- `repo_dir` can be absolute or relative; defaults to `AI_FLOW_PROJECT_DIR` when set.

## Defaults

- Set `DEFAULT_REPO_DIR` in the profile-owned configuration to avoid passing the repo path each time.
- The `repo_dir` is the project selected at session start via the workflow; it’s part of the working context and is
exported as `AI_FLOW_PROJECT_DIR`.
- If it is missing, resolve the exact project from the active profile and pass its configured repository path.
- Assume repo paths are flat/relative under the common projects root (e.g., `/home/user/projects/sample-project`).

## Notes

- On success, prints only `PASS`.
- On failure, prints only `FAIL` plus the log path.
- Set `SHOW_LOG=1` to print the full log on failure.
- `SONAR_TOKEN` must be set in the environment or selected profile configuration before running.
- `SONAR_PROJECT_KEY` is optional; when omitted the script reads `sonar.projectKey` from `sonar-project.properties` if present.
- The command auto-detects the Maven module by finding `pom.xml` (or set `MAVEN_MODULE_DIR`).
- If no `sonar-project.properties` exists, the project key defaults to `ghe:config-services:<repo_dir_basename>`.
- Maven and SonarScanner output are written under `reports/<profile>/<project>/<task>/` using either
`${AI_FLOW_OUTPUT_DIR}/sonar-qube/reports/` or `ai-commands/sonar-qube/reports/` as the root.
- Maven runs in quiet mode with unit/integration tests skipped by default; set `MAVEN_ARGS` to override.
- Set `RUN_TESTS=1` to run tests and generate coverage data when addressing `new_coverage`.
- Set `SKIP_MAVEN_CLEAN=1` to skip the `clean` goal when clean fails due to locked/readonly files.
- SonarScanner uses reduced logging by default.
- After a run, check only the end of the log to confirm the result; avoid scrolling full logs to save tokens.
- The command fetches issues, quality gate, and measures JSON into `${AI_FLOW_OUTPUT_DIR}/sonar-qube/reports/` (or
`ai-commands/sonar-qube/reports/`) for offline review.
- Coverage report path auto-falls back to `target/site/jacoco-ut/jacoco.xml` if the aggregate report is missing.
- Set `SONAR_PR_KEY` to fetch PR-scoped issues/measures (matches URLs like `...&pullRequest=1123`).
- After a successful scan, the command polls the SonarQube CE task and waits briefly before fetching JSON to ensure results are available.
- When issues are present in the JSON, address them in this order for the selected project, rerunning the scan after each group:
  1. New coverage
  2. New duplicated lines density
  3. New violations
- Stay on the current feature branch until all SonarQube issues are fixed and confirmed by a clean JSON report.
- Update `plan/plan.md` after each scan using the JSON results as the checklist (coverage, duplication, violations) so
progress is transparent.
- Prefer `MAVEN_ARGS="-DskipITs=true -DskipTests=false -Dskip.unit.tests=false -DskipUTs=false"` when collecting
coverage to avoid long integration tests unless needed.
- Flow: run scan → review JSON → fix issues you can without rerunning → ask user before a rescan → rescan only when you
believe the remaining items are addressed → repeat until JSON is clean.
- Important: if you run the scan without tests, `new_coverage` will be 0.0; use `MAVEN_ARGS` (or `RUN_TESTS=1`) for coverage runs.

## Profile Configuration

- use the profile-owned `.config` file referenced through `commands[].config`
- profile configs are user-specific and must be gitignored
- when `--profile` is provided, the command attempts to load `SONAR_TOKEN` from
  `<ai-profile-root>/<profile-id>/.creds/creds.json`; no reusable command hardcodes a profile directory

## SonarQube Checklist

- Scan log:
- Issues JSON:
- Quality JSON:
- Measures JSON:
- Current status:
  - new_coverage:
  - new_duplicated_lines_density:
  - new_violations:
