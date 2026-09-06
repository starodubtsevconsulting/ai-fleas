# ide.command

## Purpose

Use `ide` to open or operate the selected project in a supported development environment.

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
| `ide/ide-intellij-idea.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |
| `ide/ide-vscode.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `ide/ide.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Use these commands to set up IDE settings for Java projects.

## Usage

- VS Code: `${AI_COMMANDS_ROOT}/ide/ide-vscode.command.sh <repo_dir>`
- IntelliJ IDEA: `${AI_COMMANDS_ROOT}/ide/ide-intellij-idea.command.sh <repo_dir>`
- Optional: set `MODULE_DIR` if the repo has multiple Maven modules.
- Optional (IntelliJ): set `MAIN_CLASS`, `PROFILE`, `RUN_AWS_REGION`, `DEVTOOLS_RESTART_ENABLED`,
`DEVTOOLS_RESTART_JVM_DISABLE`, `PROMPT=1`.

## Behavior

- Detects the Maven module by locating `pom.xml` (or uses `MODULE_DIR` when provided).
- Creates `.vscode/` if missing.
- Updates (merges) settings so existing keys are preserved.
- Writes the following Java settings using the detected module path:
  - `java.compile.nullAnalysis.mode`
  - `java.import.maven.enabled`
  - `java.project.outputPath`
  - `java.project.resourceFilters`
  - `java.project.sourcePaths`
- IntelliJ IDEA command creates or updates a run configuration under `.idea/runConfigurations/`:
  - Main class: `MAIN_CLASS` (set this per app)
  - Run config name/file matches the main class simple name (e.g., `LocalizationMgmtApplication.xml`), not a fixed service name
  - Spring profile: `PROFILE` (default: `local-aws`) via `SPRING_BOOT_PROFILES` and `ACTIVE_PROFILES`
  - Env var: `AWS_REGION` (from `RUN_AWS_REGION`, default: `us-east-2`)
  - Env var: `SPRING_PROFILES_ACTIVE` (from `PROFILE`)
  - Env var: `SPRING_DEVTOOLS_RESTART_ENABLED` (from `DEVTOOLS_RESTART_ENABLED`, default: `false`)
  - VM param: `-Dspring.devtools.restart.enabled=<value>` (from `DEVTOOLS_RESTART_JVM_DISABLE`, default: `true`)
  - Uses the module that contains the `pom.xml` (artifactId)

## Notes

- Supported IDEs: [vscode, intellij-idea]
- This mirrors the working settings from `config-service/.vscode/settings.json`.
- Works for any single-module Java project with the same generated-sources layout.
- IntelliJ IDEA run config is generated for Java/Spring apps using the module that owns the `pom.xml`.
- Provide `MAIN_CLASS` to match your service’s `*Application` class (example in the `.command.example.config`).
- Use `VALIDATE_ONLY=1 PROMPT=1` to validate and optionally fix mismatches interactively.
