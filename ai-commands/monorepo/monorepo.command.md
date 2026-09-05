# monorepo.command

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
  - Example: `npx nx run locusesse-frontend:build`
- Serve an app:
  - `npx nx run <project>:serve`
  - Example: `npx nx run locusesse-frontend:serve`
- Run Playwright e2e:
  - `npx nx e2e <app>-e2e`
  - Filter by test title:
    - `npx nx e2e <app>-e2e -- --grep "Archive + Restore"`
  - Skip Nx cache:
    - `npx nx e2e <app>-e2e --skip-nx-cache -- --grep "Archive + Restore"`
  - Do not use `--testFile` for Playwright; pass Playwright args after `--`.

## Roles selection

- dev

## Input

- `{project_location}` (path to the monorepo)

## Output

- None
