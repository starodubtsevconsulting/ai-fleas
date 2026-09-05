# ide.command

## Roles

- `devops`

Use these commands to set up IDE settings for Java projects.

## Usage

- VS Code: `./commands/ide/ide-vscode.command.sh <repo_dir>`
- IntelliJ IDEA: `./commands/ide/ide-intellij-idea.command.sh <repo_dir>`
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
- Provide `MAIN_CLASS` to match your service’s `*Application` class (example in the `.example.conf`).
- Use `VALIDATE_ONLY=1 PROMPT=1` to validate and optionally fix mismatches interactively.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
