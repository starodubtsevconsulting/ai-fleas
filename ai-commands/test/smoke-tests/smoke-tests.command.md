# smoke-tests.command

## Tags

#command #ai-command #test #smoke-tests #testing #e2e #qa

Use for smoke/e2e checks validating main user flows (API + browser). Assumes `{app_name}-e2e` project exists.

## Expected style (mandatory)

- E2E must be `facade-first`, not DOM-first.
- App code owns component e2e contracts/facades; tests are callers of those contracts.
- Specs should read like user flows, not selector scripts.

## Run order

1. Read `{project_location}/apps/{app_name}-e2e/README.md`
2. Read `{project_location}/apps/{app_name}-e2e/playwright.config.ts`
3. Run smallest scope first:

- `npx nx e2e {app_name}-e2e --skip-nx-cache -- --grep "<suite-name>"`

4. Expand scope only after targeted tests pass

## Rules

- Review existing tests and README before creating anything
- Follow patterns in `{project_location}/apps/{app_name}-e2e/src/`
- If app has shared e2e contracts (example: `libs/ai/ai-common/src/interfaces/e2e`), use them as selector/method source of truth
- For each `.spec.ts`, add a same-name `.spec.sh`:
  - default: `-human` (headed, slow, visible)
  - support flags: `--human`, `--no-human`, `--headless`
  - log output to a same-directory `[test-name].log` (git ignored)
  - ensure the repo ignores these logs (recommended pattern: `apps/<app>-e2e/src/*.log` plus a broader `*.log` if appropriate)
- When creating resources in E2E/integration flows (titles, slugs, emails, etc.), prefix or include `Test` (example:
`Test ~ ...`) so any TTL/cleanup policies and manual cleanup can reliably identify test data if it persists
- Reuse helpers (auth, setup, forms)
- Use API checks for speed when needed (such as login (if not the login what we test now)); use UI as preferred way
(still e2e test are visual tests, headless or not)
- Keep tests deterministic (stable selectors, data-testid)
- Fail fast (`max-failures=1`)
- Validate `webServer.command` paths:
  - Nx runs from `apps/{app_name}-e2e`
  - use local paths (`bash start-for-e2e.sh`)

## Facade approach (mandatory)

- Put shared component e2e contracts in app/common code (example for AI: `libs/ai/ai-common/src/interfaces/e2e/*`).
- Each UI component should expose e2e facade accessors:
  - `getE2eFacade()`
  - `selfCheckE2eFacade()`
- Component templates should bind `data-testid` from facade contract IDs, not hardcoded literals.
- E2E helper classes should import shared contracts and use facade selectors/methods.
- `*.spec.ts` should use page/component helpers only (avoid direct selectors in specs unless there is no helper yet).
- Add/keep a smoke assertion for facade integrity/self-check when available.

## Code reuse

- Use existing helpers/facades (treat them as user `actions/`)
- Avoid duplicating logic already implemented

- Continuously extract reusable frontend interactions into `actions/`:
  - Each action represents what a user does (click, fill, navigate, submit)
  - Actions wrap Playwright steps into reusable units

- Structure:
  - `actions/draft.action.ts`
  - `actions/fill-form-1.action.ts`
  - `actions/login.action.ts`

(we could have named them commands, which would align with how backend code is structured, but we avoid that to keep
concepts separate—this is explicitly about UI interactions, even if they end up calling commands/APIs underneath;
sometimes it’s 1:1, but not always)

## Roles

- qa

## Input

- `{project_location}/apps/{app_name}-e2e/src/*`
- `{project_location}/apps/{app_name}-e2e/src/helpers/*`

## Output

- `{project_location}/apps/{app_name}-e2e/src/*`

## Definition of done

- New or changed spec has matching `.spec.sh`.
- `.spec.sh` supports `--human` mode and writes a `.log`.
- Tests pass via helper/facade layer (not ad-hoc selectors in specs).
- Shared facade/contracts updated when DOM contract changes.
- README in `{app}-e2e` documents how to run target suites.

## Nx

- `npx nx e2e <app>-e2e -- --grep "Test Title"`
- or `npx playwright test <file> --config=apps/<app>-e2e/playwright.config.ts`
- `--skip-nx-cache` before `--`

## Local stack (manual)

- Frontend:
  - `npx nx serve {app_name}-frontend --port 4200 --host 0.0.0.0`
- Backend:
  - `npx nx serve {app_name}-backend --port 3000 --outputStyle=stream`
- If inspector blocks port (`EADDRINUSE`):
  - restart backend with `--inspect=false`
- If servers already running:
  - reuse them (`reuseExistingServer`)
- Do not restart healthy frontend (`http://localhost:4200`)
- Targeted run:
  - `npx nx e2e {app_name}-e2e --skip-nx-cache -- --headed --grep "<test>"`

## Troubleshooting

- Missing `start-for-e2e.sh`:
  - fix `webServer.command` path (relative to `apps/<app>-e2e`)
- Permission issues with reports:
  - rerun with proper permissions
- Backend running but failing:
  - check for inspector using app port
  - restart with `--inspect=false`
