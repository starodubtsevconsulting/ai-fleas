# AI Commands

AI Commands are reusable capabilities for AI-assisted work.

## Catalog structure

Commands are grouped by **capability category**, never by workflow ownership.

```text
workflow = who/why uses a command
category = what kind of capability the command is
type     = how the command behaves architecturally
```

```text
ai-commands/
  <category>/
    <command>/
```

Current categories:

- `install`
- `data`
- `connect`
- `development`
- `content`
- `system`
- `utility`

See [`categories.md`](categories.md) for the normative rules.

`install` is limited to initial installation and minimum bootstrap. Routine operation and profile/workflow tuning belong
to the capability category used after installation; for example, installation may prepare a provider while `connect`,
`data`, or `system` owns its normal-use companion command.

## Command identity

Category is not part of the public command ID.

```text
ai-commands/connect/source-control/  -> source-control
ai-commands/connect/git/             -> git
```

Workflows and profiles should reference logical command IDs. Runtime discovery resolves the physical category path.

## Command metadata

Each public command uses `<name>.command.yml` as canonical metadata.

```yaml
id: health-data-garmin
version: 0.0.1-SNAPSHOT
category: data
type: provider
ai:
  powered: false
```

Primary command types are `contract`, `executable`, `adapter`, `provider`, `flow`, and `visual`.

## Adapter and provider

Adapters expose provider-neutral capabilities. Providers own provider-specific mechanics.

| Adapter | Provider |
| --- | --- |
| [`source-control`](connect/source-control/source-control.command.md) | [`git`](connect/git/git.command.md) |
| [`ticket-tracker`](connect/ticket-tracker/ticket-tracker.command.md) | [`jira`](connect/jira/jira.command.md) |
| [`ticket-tracker`](connect/ticket-tracker/ticket-tracker.command.md) | [`trello`](connect/trello/trello.command.md) (connected app or explicit secret-backed API transport) |
| [`logs`](connect/logs/logs.command.md) | [`datadog`](connect/datadog/datadog.command.md) |
| [`health-data`](data/health-data/spec.md) | [`health-data-garmin`](data/health-data-garmin/spec.md) |
| [`activity-data`](data/activity-data/spec.md) | [`activity-data-android`](data/activity-data-android/spec.md) |

Adapters and providers are peer commands. A provider is not a subcommand of its adapter.

## Category commands

A category may optionally expose a real category-wide command.

`install` is the current example:

```text
ai-commands/install/
  install.command.md
  install.command.yml
  install.sh
  docker/
  git/
  hermes/
  ...
```

Do not create `install/install/`.

## Normal command bundle

```text
<category>/
└── <name>/
    ├── <name>.command.yml
    ├── <name>.command.md
    ├── <name>.command.example.config
    ├── spec.md
    ├── <name>.command.sh
    ├── <name>.command.mjs
    ├── <name>.command.test.sh
    └── <optional implementation files>
```

Only add files the command actually needs.

## Execution

Governed command execution carries a profile/workflow authorization envelope. Commands use profile-owned configuration
only when their contract declares it as an operational input. Installer commands are profile-independent: the envelope
may authorize and audit the invocation, but profile values cannot affect installation behavior.

Catalog examples are documentation, not operational configuration.

## Principles

- Contract first.
- Deterministic where practical.
- Context bound.
- Fail closed.
- UI optional.
- Keep reusable command behavior separate from private profile/project configuration.

## Related

- [`categories.md`](categories.md) — categories, metadata, command types, category commands
- [`commands.md`](commands.md) — detailed command conventions and runtime integration
- [`PUBLISHING.md`](PUBLISHING.md) — publishing rules
- [AI Workflows](../ai-workflows/README.md) — workflows that coordinate commands
