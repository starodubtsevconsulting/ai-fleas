# Command categories

## Core principle

Group commands by **capability type**, never by workflow ownership.

```text
workflow = who/why uses the command
category = what kind of capability the command is
type     = how the command behaves architecturally
```

A workflow may use commands from any category. A command does not move categories because a different workflow starts using it.

## Structure

```text
ai-commands/
  <category>/
    <command>/
```

Rules:

- Every public command belongs to exactly one category.
- Public commands do not live directly under `ai-commands/`.
- Categories are a flat list. Do not create subcategories unless the catalog policy is explicitly changed.
- Categories describe what kind of capability a command provides, not which workflow uses it.
- Do not group commands by workflow, business process, team, or profile.
- A workflow may use commands from any category.
- Command IDs remain globally unique across all categories.
- Adapters and provider implementations remain independent peer commands and normally belong to the same capability category.
- `_runtime/` and other catalog-internal tooling are not public command categories.

## Initial categories

| Category | Purpose | Examples |
| --- | --- | --- |
| `install` | Installation, setup, and provisioning | Docker, Git, Hermes, GrapheneOS |
| `data` | Acquire, normalize, persist, or process structured data/evidence | health data, activity data, permanent memory, statements |
| `connect` | Access external systems and services | source control, Jira, calendar, email, browser, logs |
| `development` | Build, change, test, review, or validate software | coding, bug fix, tests, review, SDD |
| `content` | Create or transform human-facing content/media | writing, docs, TTS, video, Kdenlive |
| `system` | Operate AI/runtime/machine/session capabilities | agents, machine profile, monitoring, session |
| `utility` | Generic reusable helpers that do not fit another capability family | planning, discussion, demo |

Prefer an existing category over creating a new one. Add a new category only when several commands share a stable capability type that does not fit the existing list.

## Category commands

A category may optionally also expose a public command with the same ID as the category. This is a **category command**.

A category command owns a real capability whose scope is the category itself, such as routing to member commands, category-wide status/check behavior, or shared lifecycle behavior. It is not created merely because the category exists.

When a category command exists, its files live directly in the category folder; do not add a redundant `<category>/<category>/` directory.

Example:

```text
ai-commands/
  install/                       # category
    install.command.md           # optional category command: id=install
    install.command.yml
    install.sh
    chatgpt/                     # member command
    claude/                      # member command
    codex/                       # member command
    docker/                      # member command
    git/                         # member command
    grapheneos/                  # member command
    hermes/                      # member command
```

The `install` category command provides the generic installation lifecycle/router capability across installer commands. The child folders remain independent public commands for installing or managing particular dependencies/software.

Most categories do not need a category command. Add one only when there is a meaningful category-wide capability.

## Command metadata

Each public command uses `<name>.command.yml` as its canonical machine-readable metadata file. Do not introduce a separate `meta.yml` for the same information.

Required metadata:

```yaml
id: ticket-tracker
version: 1.0.0
category: connect
type: adapter
```

Fields:

- `id` — globally unique public command ID. It does not include the category path.
- `version` — command contract/implementation version.
- `category` — one value from the flat category catalog above.
- `type` — the command's primary architectural role.

### Command types

Use one primary type per command:

| Type | Meaning | Typical examples |
| --- | --- | --- |
| `contract` | Reasoning/guidance contract with no required deterministic executable | policy or reasoning commands |
| `executable` | Deterministic script/tool capability | validation, transformation, setup |
| `adapter` | Provider-neutral capability that resolves a configured provider command | `ticket-tracker`, `source-control`, `health-data`, `activity-data` |
| `provider` | Provider-specific implementation selected by an adapter | `jira`, `git`, `health-data-garmin`, `activity-data-android` |
| `flow` | Command-level composition of multiple commands into one bounded outcome | composed operational commands |
| `visual` | Command whose primary interaction surface is a dedicated UI | command-owned Electron/web surfaces |

`category` and `type` are independent dimensions:

```text
category = capability family / where the command belongs
type     = architectural behavior / how the command operates
```

Examples:

```yaml
id: health-data
version: 0.0.1-SNAPSHOT
category: data
type: adapter
```

```yaml
id: health-data-garmin
version: 0.0.1-SNAPSHOT
category: data
type: provider
```

A command can have secondary implementation characteristics, but `type` remains singular for now. Choose the command's primary architectural role rather than turning `type` into an array.

## Identity and lookup

Category is a physical/catalog organization concern. It is not part of the public command ID.

For example:

```text
ai-commands/connect/source-control/
ai-commands/connect/git/
```

The command IDs remain:

```text
source-control
git
```

Workflows and profiles should reference command IDs rather than encoding physical catalog paths wherever possible. Runtime discovery resolves the category path from the globally unique command ID.

## Internal migration compatibility

A compatibility path may exist temporarily under `ai-commands/` only to keep older executable references working during the category migration.

Compatibility paths:

- are internal implementation details, not public commands;
- do not contain a public command contract or command metadata;
- must delegate immediately to the categorized canonical command or canonical runtime helper;
- are explicitly excluded from public command discovery;
- must not be referenced by new workflows, profiles, or command contracts.

The canonical location remains `<category>/<command>`. Compatibility paths exist only to preserve older direct executable references until those callers are migrated.
