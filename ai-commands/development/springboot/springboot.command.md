# springboot.command

## Purpose

Use `springboot` to start, verify, and interact with the selected Spring Boot application in its configured environment.

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

- Logs go to `${AI_FLOW_OUTPUT_DIR}/springboot/*.log` when `AI_FLOW_OUTPUT_DIR` is set.
- Otherwise logs go to `<repo>/.ai/springboot/*.log`.
- PID is written to the sidecar `${LOG_FILE}.pid`.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `springboot/springboot-run.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `springboot/springboot.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

NOTE: this command is more informational than operational,
there is a limit what ai-agent like codex
could do in its sandbox env,
it can NOT actually run spring boot.
So this command is meant to be used for informational purposes only,
like "how to run spring boot" or "how to run tests" or "how to build" etc.

While it can not run spring boot, it can stop a running SpringBoot app,
and it can analyze the logs. So we may still keep this command
and see if it proves to be useful.

Run the Spring Boot app from the target repo by preferring the project-owned
`script/run-local-aws.sh` startup script when it exists, then falling back to
`mvn spring-boot:run` discovery for repos that do not expose that script.

By convention, Spring Boot projects should expose `script/run-local-aws.sh` for
local runs against real dev AWS infrastructure. That script owns project-specific
startup behavior such as stopping existing listeners, setting local profiles,
choosing the module, and writing project logs.

## Usage

- `${AI_COMMANDS_ROOT}/springboot/springboot-run.command.sh [--project-dir <path>] [--output-dir <path>] [--project-run-script
<path>] [--force-maven|--no-project-run-script] [--app <name-or-path>] [--pom <path>] [--profile <profile>] [--region
<aws-region>] [--main-class <fqcn>] [--mvn-args "<args>"] [--jvm-args "<args>"] [--foreground|--no-bg] [--sandbox-safe]
[-- <mvn-args...>]`

## Defaults

- Profile: `local-aws`
- Region: `us-east-2`
- Project run script: `script/run-local-aws.sh`
- If `pom.xml` is unique in the repo, it is auto-selected.
- If multiple `pom.xml` files exist, pass `--app` or `--pom` or set `DEFAULT_POM` in config.
- If the main class is not found in `pom.xml`, the command tries to infer it from `@SpringBootApplication`.

## App selection

- `--app` can be:
  - a module directory (searched for a single `pom.xml`),
  - a `pom.xml` path,
  - or a name that matches a path segment containing the app.

## Config

- profile-owned overrides resolved through `AI_COMMAND_CONFIG_PATH`

## Behavior

- Stops the most recent command-managed background instance before starting a new one.
- Runs in the background so your terminal stays usable.
- Detects project run script, default `script/run-local-aws.sh`, and uses it automatically when present.
- Falls back to Maven `spring-boot:run` when the project run script is absent or `--force-maven` / `--no-project-run-script` is supplied.
- Use `--foreground` or `--no-bg` to run in the current terminal and still append to the log file.
- Use `--sandbox-safe` to disable Netty native transport for restricted environments.
- Uses `MAVEN_CMD` and `MAVEN_ARGS` (same as `test.command`).
- Runs from the module directory so relative Maven settings (e.g., `.mvn/maven.config`) resolve correctly.
- Prints the detected `pom.xml` and main class (when found).
- Runs with:
  - `SPRING_PROFILES_ACTIVE=<profile>`
  - `AWS_REGION=<region>`
  - `AWS_DEFAULT_REGION=<region>`
  - `-Dspring-boot.run.profiles=<profile>`
  - `-Dspring-boot.run.mainClass=<fqcn>` (when found)

## Example

- `${AI_COMMANDS_ROOT}/springboot/springboot-run.command.sh --project-dir /path/to/repo`
- `${AI_COMMANDS_ROOT}/springboot/springboot-run.command.sh --project-dir /path/to/repo --force-maven --app localization-mgmt-service-api`
