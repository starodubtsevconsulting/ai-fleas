# Command categories

Public commands are organized by capability type, not by workflow ownership.

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
