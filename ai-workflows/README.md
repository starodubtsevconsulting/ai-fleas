# AI workflow structure

This directory contains reusable workflows. A workflow is identified by its folder and is independent of any one profile,
client, logical project, runtime application, agent count, or project-source layout.

Profiles decide which workflows are available and bind each workflow to its allowed project configuration. At runtime, an
explicitly selected profile and workflow derive a logical project ID such as `<profile-id>-<workflow-id>`. A runtime adapter
projects that logical project into its own workspace or project abstraction and supplies one or more accessible source
folders.

The effective agent contract is composed as common role + workflow agent declaration + workflow policy matrices +
workflow routing + initialized profile/project binding. Profiles keep their own provider choices, project sources,
policy references, commands, credentials, and parameter values. A profile may fill a workflow-declared parameter or
narrow its available project context, but it does not rewrite the reusable role or silently add a workflow capability.

## Workflow folder template

```text
ai-workflows/
├── agents.md
├── _common/
│   ├── roles/
│   │   └── <role-id>.md
│   ├── policy/
│   │   ├── access-matrix.md
│   │   └── <matrix-kind>.template.csv
│   └── mcp/
│       └── workflow-common.mjs
└── <workflow-id>/
    ├── agents.yml
    ├── <workflow-id>.workflow.md
    ├── workflow.yml
    ├── spec.md
    ├── agents/
    │   ├── team.md
    │   ├── workflow-agent-initializer.md
    │   ├── init.md
    │   ├── init-live-test.md
    │   ├── shared-execution-routing.md
    │   ├── <agent-id>.md
    │   ├── <another-agent-id>.md
    │   └── <agent-support-data-or-tests>
    ├── guides/
    ├── acceptance/
    ├── fixtures/
    ├── mcp/
    ├── <workflow-id>-backend/
    └── <workflow-id>-frontend/
```

The leading-underscore `_common/` namespace contains reusable workflow infrastructure and is never a workflow ID or a
runtime project. A role under `_common/roles/` becomes an agent only when a workflow's `agents.yml` instantiates it inside
one exact workflow project such as `<profile-id>-<workflow-id>`. It must never create a profile-only or projectless task.

Only `<workflow-id>.workflow.md` is universally required. Other entries exist when the workflow needs the corresponding
capability. Runtime implementation, UI, MCP, fixtures, acceptance tests, and agents are optional and independently
composable. When a workflow supports a managed agent team, however, it must extend
[`agents.md`](agents.md), and its lifecycle initializer and lifecycle contracts are required parts of that
workflow.

## Core files

### Helper prompt table

Near the top of `<workflow-id>.workflow.md`, a workflow may provide a compact helper table with `User prompt`,
`Scope resolution`, and `Expected result` columns. Include common lifecycle and workflow-entry phrases without making the
table an exhaustive natural-language grammar. Prompts may omit profile details only when the requesting task or runtime
adapter already supplies one verified logical-project binding.

### `<workflow-id>.workflow.md`

The human-readable workflow entrypoint. It explains when the workflow applies and routes requests to the smallest relevant
workflow contract, guide, agent initialization contract, or delivery path. It must remain reusable across profiles and
project sources.

### `workflow.yml`

Declarative runtime metadata when the launcher or another runtime needs a machine-readable workflow manifest.
Runtime-specific implementation details belong here or behind the corresponding adapter, not in the portable workflow
identity.

### `spec.md`

The workflow's product or runtime specification when it has an implemented application surface. It is not a substitute for
the concise routing contract in `<workflow-id>.workflow.md`.

## `agents/` folder

The optional workflow-local `agents/` folder defines how one or more agents participate in the workflow. An agent-enabled
workflow inherits [`agents.md`](agents.md), instantiates common definitions from `_common/roles/` through `agents.yml`, and declares its
roles, models, and workflow-specific routes. This repository structure does not prescribe a fixed team size.

### `agents.yml`

The authoritative workflow agent-instantiation manifest. Each declaration selects one common role and supplies its title,
aliases, ticket prerequisite, model, reasoning, lifecycle, human-facing mode, communication mode, matrix column,
and readiness token. Its `dependencies` section maps capability providers and return
coordinators between declared agents. Every
dependency is capability-bound: a missing provider blocks only the named capability, never instantiation of the reusable
consumer role. Neither declarations nor dependencies grant authority; workflow ownership and communication matrices
provide those permissions.

Every workflow that supports managed agents must define at least one persistent, user-facing workflow administration
agent. The conventional identity is `workflow-agent-initializer`; a workflow may choose a clearer display name. This
initializer is infrastructure for the workflow, not a member of the managed team in `team.md`, and must be available before
team initialization is requested.

All workflow agents extend the single common [`agents.md`](agents.md) contract. It owns generic identity,
capability-boundary, peer-authorization, packet, delivery, Admin, Judge, and initialization invariants. The selected
workflow owns its remaining team membership, capability grants, communication topology, dependency map, models, and
explicit overrides. Initialization composes and fingerprints the common contract and selected role with the workflow;
copying role contracts into a workflow is prohibited. Concrete peer availability and permission always resolve through
the workflow manifest and matrices.

### `team.md`

The team document is the readable projection of `agents.yml`. It explains how the declared agents initialize as one unit
without becoming a second roster authority. It does not grant capabilities, define contact routes, or specify packet
mechanics. The workflow-local matrices remain the mechanical permission authority; routing owns transport and evidence.

### Workflow role overrides

A workflow that needs to tune a common role declares the narrow override in `<workflow-id>.workflow.md`. It must not
create an `agents/<agent-id>.md` wrapper or copy the common role. Reusable roles belong under `_common/roles/`; they
receive workflow identity, permissions, communication routes, jurisdiction, and overrides through `agents.yml`, the
workflow file and matrices, profile/project context, and initialization.

### `workflow-agent-initializer.md`

The required persistent `🔑 Admin` lifecycle contract for a workflow with governed agents. It identifies the workflow
contracts Admin may read. The initializer may:

- resolve the explicit profile/logical project, or use exactly one verified runtime-bound logical project;
- read the workflow entrypoint, `agents/team.md`, `agents/init.md`, every declared agent contract, and the selected
  profile's project/source configuration needed to validate scope, plus the common
  [`agents.md`](agents.md) contract;
- answer user questions about what the workflow does, its resolved profile/logical project, accessible sources, applicable
  rules, declared agents, and current lifecycle/readiness state;
- initialize a missing declared team, reinitialize it by archiving and recreating it, archive it without replacement, and
  report lifecycle/readiness status;
- create each declared agent from its complete current payload, verify its exact title, project binding, order, and
  readiness acknowledgement; and
- reconcile only exact declared-team tasks inside the resolved logical project.

Its information role is read-only. It must remain outside `team.md`, must never archive or replace itself, and must not
create or edit Markdown/configuration files, perform the workflow's product work, edit governance or tracker state, message
managed agents after initialization, or create background schedulers. Its only mutation authority is exact managed-agent
lifecycle administration. Archive, delete, and remove requests for workflow agents are recoverable archive operations
unless a separate, explicit contract authorizes otherwise.

### `init.md`

The optional lifecycle contract for initializing, reinitializing, or archiving the declared team. It resolves an explicitly
named profile, derives the logical project ID, validates the runtime projection and project sources, composes current agent
contracts, and mutates only exact declared-team tasks in that logical project.

Initialization terminology:

- **Admin bootstrap** ensures exactly one workflow-declared persistent Admin exists and is ready before initialize or
  reinitialize delegates governed-team lifecycle work. A missing Admin is recreated as part of initialization; it remains
  outside the governed team.
- **Initialize** creates a complete team when no declared team is active.
- **Reinitialize** archives the complete active team and creates a fresh complete team.
- **Archive all agents** archives the complete active team and creates nothing.
- **Delete/remove all agents** are safe aliases for archive unless another runtime explicitly defines a separately
  authorized recoverable operation. Workflow initialization never requires irreversible deletion.

### `init-live-test.md`

The repeatable acceptance scenario for agent lifecycle behavior. It covers missing-profile refusal,
runtime-project/source validation, complete initialization, complete reinitialization, exact readiness evidence, and
archive-only behavior without assuming a particular list of agents.

### Persistent Admin contract

Each workflow with governed agents declares one persistent Admin initializer. The workflow-owned initialization entrypoint
ensures Admin exists and is ready as part of initialize or reinitialize, creating it when missing. Admin remains outside
the governed `agents/team.md`, provides read-only workflow information plus lifecycle administration, preserves itself
during reinitialization, and does not participate in product work.

### Shared contracts, data, and tests

Files such as `shared-execution-routing.md`, capability matrices, ownership data, validators, and focused tests are optional
support artifacts. Their names are conventional rather than mandatory. Each workflow should keep one authoritative source
for team-wide behavior and clearly link it from `team.md` and `init.md`.

## Project sources and profiles

The workflow does not create or own project sources. The selected profile declares workflow-scoped project references, and
each referenced project configuration describes repository, storage, tracker, or other integration metadata. The active
runtime supplies the actual accessible folder bindings.

A project source can be:

- a Git repository root;
- a subfolder inside a Git repository;
- a non-Git folder; or
- one of several folders drawn from one or multiple Git repositories.

The runtime-bound folders are authoritative for access. Profile project references validate and enrich those bindings.
Missing, unreadable, ambiguous, or mismatched sources must fail before agent mutation.

## Optional implementation folders

- `guides/` contains task-specific instructions loaded only when routed.
- `acceptance/` contains repeatable workflow acceptance scenarios.
- `fixtures/` contains stable non-production test inputs.
- `mcp/` contains a workflow-owned MCP adapter or composition.
- `<workflow-id>-backend/` and `<workflow-id>-frontend/` contain an optional implemented workflow application.
- `events/`, `test-results/`, reports, caches, and build outputs are runtime/generated data and are not part of the portable
  workflow template unless explicitly tracked as fixtures.

## Creating another workflow

1. Create `ai-workflows/<workflow-id>/<workflow-id>.workflow.md`.
2. Add only the optional folders needed by that workflow.
3. If agents are supported, extend `agents.md`, create `agents/team.md`, the required Admin and Judge contracts,
   plus any additional managed-agent contracts, `agents/workflow-agent-initializer.md`, and the required lifecycle/test
   contracts. Keep Admin outside
   `team.md`. Declare that every governed agent extends [`agents.md`](agents.md).
4. Add a helper prompt table for common workflow and agent-lifecycle phrases.
5. Register the workflow under the relevant profile and declare its project references there.
6. Keep profile/client data and concrete source paths out of the reusable workflow folder.
7. Validate the workflow structure and its focused tests before using it through a runtime adapter.
