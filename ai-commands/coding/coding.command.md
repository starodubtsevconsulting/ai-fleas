## Coding command

## Tags

#coding #frontend #backend #ddd #tdd #code-style #oop #cqrs #validation #architecture

### Tag-chain sub-mapping (required)

- When the matched command is `coding`, also identify and report the coding focus as a sub-map.
- Use sequential tags as a mapping chain: `#tagA #tagB` means `tagA -> tagB`.
- Required examples:
  - `#coding #frontend` => `coding -> frontend`
  - `#coding #backend` => `coding -> backend`
  - `#coding #ddd` => `coding -> ddd`
- If user writes `#coding #frontent` (typo), normalize to `#coding #frontend`.
- Working response format must include the precise map before execution, for example:
  - `Matched command: coding -> frontend`
- If no second tag/focus is explicit, infer the best scope from the request and still report:
  - `Matched command: coding -> <inferred-focus>`

All coding is bout the domain.

Before making code changes for any project in this monorepo, read and follow:

- `../../../../docs/ddd-style.md`
- For user-visible behavior/UI changes, follow `../sdd/sdd.command.md` first (spec first, code second)
- For code that implements a behavior spec, keep a `/** Spec: ... */` doc comment above the primary class linking to
the owning `*.spec.md` file.
- Do not start coding until the active session plan in `<session-root>/<work-profile>/<session-id>/session-plan.md` is
updated to reflect the work you are about to do.
- Always show the updated active session plan before starting any work.
- Plan updates must use checklist items in the form `- [ ]` / `- [x]` so the Plan panel renders them.
- Put renderable checklist progress under `## Progress` (free-form notes alone will not update the Plan panel).
- Each plan checklist item must include at least one role tag like `#coding`, `#design`, `#test`, or `#docs`.
- When starting coding, create a branch based on the task description. If the task format is `[task-id] : [title]`, use
`task-id` as the branch name. If unclear, ask before coding.

### Speed-first workflow (save time)

- Prefer `serve`/watch mode for frontend and backend during development; do not run full `build` unless explicitly
requested or truly required.
- In umbrella workflow, use `MODE=dev ./apps/umbrella/run.sh` so services hot-reload while coding.
- Use logs as the primary feedback loop instead of rebuild cycles.
- To inspect only fresh output (delta), truncate logs before repro/check:
  - `: > apps/umbrella/run-backend.log`
  - `: > apps/umbrella/run-frontend.log`
- Then stream logs while reproducing:
  - `tail -f apps/umbrella/run-backend.log apps/umbrella/run-frontend.log`
- If startup/build output from dev servers is needed, keep `STREAM_LOGS=1` on `run.sh` (default).

### Angular template performance guard (required)

- Do **not** bind template loops to getters that allocate new arrays/objects on each change-detection pass (for example
`*ngFor="let x of someGetter"` when getter returns a new array).
- For `*ngFor`, use stable references (component fields/signals/computed values) and update them only when source data changes.
- When rendering lists, add `trackBy` for stable identity whenever possible.
- Treat template-allocation getters as a blocking review issue because they can cause severe UI lockups and CPU spikes.

### CSS-only fast path (required)

- If the requested change is style-only and the touched files are only UI style/markup files (`*.css`, `*.scss`,
`*.sass`, `*.less`, `*.html`), do **not** run full app builds by default.
- For style-only work:
  - prefer targeted component tests only when they are directly relevant and fast
  - otherwise validate by static review + local visual/manual check guidance
  - run full `nx ...:build` only when the user explicitly asks for build verification

Any change in the code base should take into account the domain.

Any coding is to follow DDD principles, to keep the core, shred domain,
to know where is domain is in the project.

Every project must include a `domain.md` that explains the ubiquitous language
and the plain DDD view of what the project is about. Use
`docs/apps/locusesse/domain.md` as a reference example.

Example template:

```
# Domain Specification (Your Project Name)

## Bounded contexts
- Context A: short description
- Context B: short description

## Ubiquitous language
- **Aggregate**: meaning
- **Entity**: meaning
- **Value Object**: meaning
- **Event**: meaning

## Invariants
- Rule 1
- Rule 2

## Behaviors
- **Command/Action**: expected behavior and events raised

## Domain events
- **EventName**: payload summary and when it fires
```

Anything that is domain specific is always to be int the domain/ folder

Example:

### interface layer

/app/interfaces/ - REST, GraphQL, etc. (http/filters, http/interceptors, etc.)

## application layer

/app/application/

### domain

/app/domain/
/app/domain/plocies/
/app/domain/ports/
/app/domain/ports/**/DraftActivityStatsPort etc
/app/domain/servies/ - domain service

### infrastructure

/app/infrastructure/
/app/infrastructure/repositories - infra level where repos are
example: `export class AuthorRepositoryDynamoDBAdapter implements AuthorRepositoryPort {`

Use this command as a short checklist when making code changes.

### Spec traceability rule

- Bi-directional links are required:
  - spec -> code: owning `*.spec.md` lists implementation files in `Code Paths`/mapping
  - code -> spec: primary implementation classes/files include `Spec: .../*.spec.md` comments
- For every primary class that implements a spec-defined behavior, add and preserve a class doc comment linking to the spec file.
- The code comment is part of the implementation contract and should be maintained together with code and spec updates.
- Example:
  - `/** Spec: docs/specs/ai/AiAgents.spec.md */`
- Do not leave the spec path only in chat context or only in the spec `Code Paths` section; keep the backlink in code as well.

### Naming convention (repositories)

For typescript (if java follow `java` convention (camelCase, but same idea;use convention of each language):

- **Implementation names must include storage type** (e.g., `*-s3.adapter.ts`, `*-dynamodb.adapter.ts`, `*-postgres.adapter.ts`).
- **Class names should mirror storage** (e.g., `DraftContentRepositoryS3Adapter`).

### Architecture expectations

- CQRS: commands/queries are separate types and handlers.
- DDD: domain entities encapsulate business rules; repositories abstract storage.
- Backend-originated events must use domain/resource naming, not UI naming.
  - Prefer concrete channels such as `agent:update`, `session:update`, `plan:update`, `terminal:started`, `show:open`.
  - Do not introduce backend transport names such as `ui:update`, `ui:show`, or vague names like `domain:event`.
- Naming and DTO rules:
  - command type/class names end with `Command`
  - query type/class names end with `Query`
  - command responses end with `CommandResponse`
  - query responses end with `QueryResponse`
  - UI-returned entity-shaped DTOs end with `View` (for example `EntityNameView`)

### Frontend UI Events -> Commands -> Domain Events (required pattern)

- Frontend components should emit typed UI intent events (for example `TaskStateChangeIntentUiEvent`) instead of
mutating domain state directly.
- Reusable UI libraries/components should expose external output events (UI events) so wrapper apps can subscribe and
compose new behavior without forking component internals.
  - Example: calendar emits `dateSelected`/`periodChanged` UI events; wrapper can react by loading weather, pricing,
availability overlays, etc.
- Explicit separation:
  - external UI events are produced by frontend components for UI composition/integration
  - domain events are produced by backend/domain/application layers and stay resource/domain-oriented
- Container/smart components should translate UI intent events into application commands.
- Backend/app layer handles commands and emits domain/resource events.
- Keep event naming separated by layer:
  - UI layer intent names: `*UiEvent` / `*Intent`
  - Domain/backend events: resource-oriented names (for example `task:update`, `session:update`, `plan:update`)
- Do not leak UI transport naming into backend/domain events (avoid `ui:*` for domain events).
- Keep this pattern aligned with `libs/tasks/tasks-frontend` event flow (UI intent event types in presentation layer,
command execution in container/service layer, domain/resource event naming in backend).

### Frontend theme-awareness (required)

- Every frontend/UI component must be theme-aware by default (at minimum light + dark compatibility).
- Do not hardcode component palette colors (`#...`, fixed `rgb/rgba`) for core surfaces/text/borders/states when theme tokens exist.
- Prefer theme tokens/CSS variables (`--bg`, `--surface`, `--text`, `--text-secondary`, `--border`, `--link`,
`--error`, highlight variables) with safe fallbacks.
- Ensure interactive states are theme-aware too: hover, active, selected, focused, disabled, error, loading.
- New shared UI libraries/components are not complete until theme-awareness is verified in both light and dark themes.

### Naming rule (no `*utils*`)

- Do not name files/classes/modules with `util` / `utils`.
- `utils` is too generic and hides responsibility (anti-OO / anti-DDD style).
- Use responsibility-based names instead, for example:
  - `*.validator.ts`
  - `*.mapper.ts`
  - `*.policy.ts`
  - `*.formatter.ts`
  - `*.factory.ts`
  - `*.adapter.ts`

### Validation rule (client + server apps)

- For client-server apps, validation for a user action/command should be defined in the **shared command layer** when possible.
- If a UI button triggers a command (for example `Start Session` -> `AiStartTerminalSessionCommand`), the button
enable/disable state should use that command validation.
- Backend should use the same shared command validation before execution.
- This removes duplicate frontend/backend validation logic and ends the “where should validation live?” argument:
**both can use it because the command validation is shared**.
- Frontend still owns presentation:
  - tooltips
  - hints
  - focus guidance
    But validation rules (required/optional fields) should come from the shared command validator.

### E2E UI testability

- For UI component work, also follow: `../test/smoke-tests/smoke-tests.command.md`
- Every time UI component code changes, update the component E2E facade/contract in the same change.
- Use shared facade contracts that are consumed by both:
  - app/component code (source of truth for `data-testid` and checks)
  - e2e helpers/tests (callers of the same facade contract)
- This shared-facade approach is required so selector/API drift fails fast.
- Facade should expose stable checks/methods and grow over time:
  - rendered/visible/hidden
  - message/text/type/state
  - component-specific actions/checks
- Do not add ad-hoc selectors directly in specs when facade/helper exists.

TODO: will add more

## Roles selection

- dev

## Input

- `<session-root>/<work-profile>/<session-id>/session-plan.md` and the current context, current codebase

## Output

- generated code
