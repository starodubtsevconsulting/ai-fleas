# test.command

## Execution roles

- `command-runner` — execute the exact registered test command mechanically and return factual evidence.
- `designer / reviewer` — select the test gate, expected behavior, and acceptance; do not execute it directly.
- `coder` — return a validation request through Designer/Reviewer; do not invoke Maven or dispatch Command Runner.

## Tags

#command #ai-command #test #testing #tdd #unit-test #qa

Generic test-running command. Use this file to pick the right testing variation based on the repo. Variations live
alongside this file (e.g., `test.command-nx.md`).

## Usage

- `./commands/test/test.command.sh` (prints the generic guidance)
- `AI_FLOW_TEST_TIMEOUT_SEC=10 ./commands/test/test.command.sh --project <name>` (default timeout is 10s)

## Variations

- Nx-based repos: see `test.command-nx.md` and `../monorepo/monorepo.command.md` for monorepo layout + build/serve/test/e2e references.
- Smoke/E2E checks: see `smoke-tests/smoke-tests.command.md`.
- App-level scripts: check `{project_location}/apps/{app_name}-e2e/scripts/*.sh` for integration/e2e helpers.
- Java Maven JUnit fallback runner: `java-maven-junit.command.sh` for repos where Maven Surefire cannot discover JUnit
5 tests due local classpath/version mismatch.
- Java Maven low-token runner: `java-maven-cheap.command.sh` for Maven repos when you need CI-like execution with minimal AI log cost.

## E2E UI Facade approach

- For UI-heavy E2E, prefer using component-provided `TestFacade` helpers over raw DOM/assertion hacks in tests.
- Keep facade code near the component and expose clear methods for:
  - render state
  - visibility state
  - message/type/state snapshots
  - optional style-aware checks (display/visibility/opacity)
- Use stable selectors (`data-testid`) and a stable E2E entry point to access the facade.

## Java Test Style

- For Java/Spring Boot unit and integration tests:
  - Add `@DisplayName("Should ...")` on test methods.
  - Use `// GIVEN`, `// WHEN`, `// THEN` comments inside each test.
  - For unit tests, ensure coverage is at least 80% and verify coverage reports after the run.

## Java Test Execution (Maven repos)

- All Maven execution routes through the exact Command Runner. Coder may edit test sources and inspect returned evidence,
  but must not invoke Maven directly.
- Low-token/default AI-friendly path for Maven:
  - `./commands/test/java-maven-cheap.command.sh --module-dir <module-dir> -- mvn -q -Dtest=<ClassName> test`
  - This redirects full Maven output to a log file and prints only:
    - exit code
    - log path
    - short tail on failure
    - matching Surefire/Failsafe report snippets when available
  - Prefer this when the goal is to verify pass/fail cheaply without streaming full Maven logs into the AI session.
- If Maven/Surefire reports JUnit discovery issues (example: `OutputDirectoryProvider not available`), use the companion runner:
  - `./commands/test/java-maven-junit.command.sh --module-dir <module-dir> --class <fully.qualified.TestClass>`
- Example:
  - `./commands/test/java-maven-junit.command.sh --module-dir example-module --class com.example.project.ExampleTest`
  - `./commands/test/java-maven-cheap.command.sh --module-dir example-module --report-glob '*ExampleTest*' -- mvn -q
-Dtest=ExampleTest test`
- Notes:
  - This runner uses direct JVM + JUnit Console execution and enables ByteBuddy agent loading for Mockito inline mock maker.
  - It is intended as a fallback when local Surefire/JUnit platform versions are misaligned.
  - The low-token runner is not a JUnit fallback. It is a log-reduction wrapper around normal Maven/Surefire/Failsafe execution.

## Roles selection

- dev (if writing unit tests)
- qa (if writing end-to-end tests, aka smoke-tests)

## Input

- TBD

## Output

- TBD

## Time Limit

- `/test` enforces a hard timeout of 10 seconds by default for any actual test execution.
- Override only when explicitly needed: set `AI_FLOW_TEST_TIMEOUT_SEC=<seconds>`.
