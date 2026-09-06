# code-style.command

## Purpose

Use `code-style` to assess or improve source code against the selected repository’s formatting, design, and maintainability rules.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- project root

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- formatted code per project conventions

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `code-style/code-style.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `code-style/code-style.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #code-style #formatting #lint

- before pushing, run the project-specific code-style command
- choose the style tool based on the project's primary language and existing conventions
- confirm the project's established style from existing code before running tools
- ensure the code style matches the project's language norms (e.g., Java 21 idioms when applicable)
- treat code style as project-specific and contextual beyond tool output (Spotless/Sonar are inputs, not the full definition)
- keep this checklist generic by default; extend it when the project's style expectations are explicit
- examples:
  - Java (Maven): `mvn -q spotless:apply` (use project-specific formatter if different)
  - Node: `npm run lint` or `npm run format` if present
  - Python: `ruff format` or `black` if used in repo

## DDD implementation style

For every change that represents or affects business behavior, DDD is required
on both backend and UI:

- Start from the bounded context and its established ubiquitous language. Use
  the same domain term in code, UI copy/state, contracts, events, and tests; do
  not introduce synonyms or a parallel model for an existing concept.
- Model objects with business identity and lifecycle as entities, with the
  consistency boundary and transaction expressed by an aggregate. Model
  immutable descriptive concepts as value objects. Keep invariants in the
  aggregate, entity, value object, or named domain policy—not in controllers,
  handlers, persistence adapters, or UI components.
- Define repository interfaces as domain-owned ports named
  `<Aggregate>Repository`. A repository persists and reconstitutes aggregate
  roots; it is not a generic CRUD or table-access abstraction. Name an
  infrastructure implementation by both aggregate and technology, for example
  `<Aggregate>RepositoryDynamoDbAdapter`, and keep storage concerns out of the
  domain.
- Name domain events as past-tense facts in the ubiquitous language, such as
  `SessionStarted` or `AllowanceCaptured`. Emit them only after a valid domain
  state transition. Event payloads use domain identifiers and values and must
  not contain UI, HTTP, database, or framework vocabulary.
- Application commands and queries coordinate use cases. Backend controllers,
  transports, and persistence adapters translate at the edges and must not own
  business decisions or leak their concerns into the domain.
- In the UI, name features, state, view models, user intents, and tests with the
  same ubiquitous language. Route user intent to application commands and
  render explicit views; do not expose domain entities directly or duplicate
  backend invariants in components. Reuse shared contract/value validation when
  the same rule genuinely applies on both sides.
- Put domain code in its bounded-context domain layer and keep dependencies
  pointing inward. Extend the existing aggregate, entity, value-object,
  repository, command/query, and event model before creating a new abstraction.
- Tests describe domain behavior in ubiquitous language and prove invariants,
  state transitions, emitted events, and repository-port behavior. Avoid tests
  coupled only to framework or implementation details.
- A formatting-only or purely technical leaf change does not require invented
  entities, repositories, or events. This exception never permits domain
  behavior to bypass the domain model.

## Roles selection

- dev
