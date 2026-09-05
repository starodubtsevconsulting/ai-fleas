# test.command-nx

Use when you need to run tests or explain how to run tests in any Nx-based repo. Prefer repo-provided scripts when they
exist, but Nx is the default for all projects (TS, Nest, Angular, etc.). The `.command.sh` is an executable wrapper
that runs Nx for you.

## AI constraints

- Do not run full test suites from the AI agent. When something fails, pick the smallest failing test/file to run.
- Any AI-triggered test run must finish within 10 seconds. If it can’t be guaranteed, refuse to run it and ask the user to run it locally.
- `/test` enforces this via timeout; default is 10 seconds and can be overridden with `AI_FLOW_TEST_TIMEOUT_SEC`.
- Do not start full app test targets (`nx test <app>`) from AI when they are known to exceed 10 seconds; skip
immediately and ask the user to run locally.
- Track failures in the active session plan: when a test fails, append a checkbox entry for the specific failing test
name so we don’t rerun the same thing. Follow the plan command rule:
`<session-root>/<work-profile>/<session-id>/session-plan.md` is the source of truth for what remains to be done.
- AWS integration tests may rely on `{project_location}/aws-secrets.txt` for credentials in local dev environments
(explore existing tests to see how).

## Usage

- `./commands/test/test.command.sh --list`
- `./commands/test/test.command.sh --project <name>`
- `./commands/test/test.command.sh --project <name> --file path/to/file.spec.ts`
- `./commands/test/test.command.sh --project <name> --file path/to/file.spec.ts --name "test name"`
- `./commands/test/test.command.sh --affected --base origin/main --head HEAD`
- Optional: `--project-dir <path>` to run Nx in a different repo.

## Platform notes

- macOS/Linux: run the commands as shown.
- Windows: use PowerShell for `npx`/`npm` commands; use Git Bash or WSL for `.sh` scripts.
- If tests fail to start due to file permission errors, rerun from a local (non-network) filesystem.

## Nx monorepo (generic)

- List projects:
  - `npx nx show projects`
- Run tests for a project:
  - `npx nx test <project> --runInBand --bail --verbose`
- Run a specific test file:
  - `npx nx test <project> --testFile=path/to/file.spec.ts --runInBand --bail --verbose`
- Run a specific test by name:
  - `npx nx test <project> --testFile=path/to/file.spec.ts --testNamePattern="test name" --runInBand --bail --verbose`
- Run all affected tests (when using git):
  - `npx nx affected -t test --base=origin/main --head=HEAD --runInBand --bail --verbose`
