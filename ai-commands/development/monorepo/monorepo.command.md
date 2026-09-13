# monorepo.command

## Purpose

Use `monorepo` to inspect and operate a multi-project repository through its declared package and dependency boundaries.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- `{project_location}` (path to the monorepo)

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- None

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `monorepo/monorepo.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `monorepo/monorepo.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #monorepo

Use when working in monorepos. This command documents the expected repo structure and the most common commands for
test, build, serve, and e2e. For now, examples assume Nx, but the layout applies even if frameworks differ.

Assume Angular for frontend and NestJS for backend unless the repo states otherwise; the layout below is the expected
default even if frameworks differ.
Nx provides a single facade for build, test, serve, and e2e across a monorepo, so teams can mix frameworks and
languages while keeping consistent commands (all driven from Node).

## Monorepo structure (example: sample-project)

```
repo/
  apps/
    <app-name>/
      <app-name>-backend/
      <app-name>-frontend/
    <app-name>-e2e/
  libs/
    angular/
      src/
      assets/
    apps/
      <app-name>-shared/
      <app-name>/
    infra/
      aws/
      scripts/
    js-shared/
      src/
    nest-shared/
      src/
  docs/
  tools/  # optional
  scripts/  # optional
```

## Nx commands (example only)

- List projects:
  - `npx nx show projects`
- Test a project:
  - `npx nx test <project> --runInBand --bail --verbose`
- Test a specific file:
  - `npx nx test <project> --testFile=path/to/file.spec.ts --runInBand --bail --verbose`
- Test a specific test name:
  - `npx nx test <project> --testFile=path/to/file.spec.ts --testNamePattern="test name" --runInBand --bail --verbose`
- Run affected tests:
  - `npx nx affected -t test --base=origin/main --head=HEAD --runInBand --bail --verbose`
- Build an app:
  - `npx nx run <project>:build`
  - Example: `npx nx run example-frontend:build`
- Serve an app:
  - `npx nx run <project>:serve`
  - Example: `npx nx run example-frontend:serve`
- Run Playwright e2e:
  - `npx nx e2e <app>-e2e`
  - Filter by test title:
    - `npx nx e2e <app>-e2e -- --grep "Archive + Restore"`
  - Skip Nx cache:
    - `npx nx e2e <app>-e2e --skip-nx-cache -- --grep "Archive + Restore"`
  - Do not use `--testFile` for Playwright; pass Playwright args after `--`.

## Roles selection

- dev
