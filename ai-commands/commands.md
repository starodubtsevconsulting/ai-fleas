## Commands Folder — Specification

### Resolving the command catalog

The selected AI Profile is authoritative for the command catalog. Profile activation resolves its
`ai_commands_root` setting and exports the absolute path as `AI_COMMANDS_ROOT`. Runtime instructions and cross-command
calls must therefore use `${AI_COMMANDS_ROOT}/<command-name>/...`; they must not assume that the catalog is named
`commands`, lives beside the active project, or belongs to a particular host platform.

Scripts distributed inside this repository may remain directly runnable before profile activation. Such scripts must
derive a fallback from their own location, using the equivalent of
`COMMANDS_ROOT="${AI_COMMANDS_ROOT:-<this repository's ai-commands directory>}"`. An explicitly supplied
`AI_COMMANDS_ROOT` always wins. Paths under a profile's own `commands/` directory are profile-relative configuration,
not command-catalog paths.

Reusable command directories must not contain populated operational configuration. Secret-bearing and
organization-specific command overrides belong in the selected profile's ignored local configuration. Hosts pass the
resolved file path to executables as `AI_COMMAND_CONFIG_PATH`; a command-specific variable may be supported when its
contract documents it. Public examples belong under `ai-profile/example/` and must contain placeholders only.

Every command execution is profile-aware. Before invoking an executable, the launcher or host adapter must activate one
exact profile and workflow, verify that the workflow allows the command, resolve `AI_COMMANDS_ROOT`, and export the
command's profile-owned override as `AI_COMMAND_CONFIG_PATH` when configured. Direct command-local discovery of
operational config is prohibited. Shell callers may use `${AI_COMMANDS_ROOT}/_runtime/profile/run-command.sh`; other platforms
must enforce the same sequence.

`ai-commands/_runtime/` is reserved internal infrastructure, not a command
bundle. It has no command contract, workflow command ID, or execution route.

### Structure

Each public command lives under `ai-commands/<command-name>/`. The following
names are canonical and are validated by `validate-structure.mjs`:

- `<command-name>.command.md` — **required**
  Defines purpose, inputs/outputs, entry point, and behavior. It is also the
  profile-aware agent entry point when the command has no executable or UI.

- `<command-name>.command.example.config` — **required and committed**
  Safe documentation of supported command value overrides. Use fictional,
  non-secret example values. If there are no supported overrides, say so in
  the file. Copy it into the selected profile for operational use, reference
  that copy through `commands[].config`, and let the activated host expose it
  as `AI_COMMAND_CONFIG_PATH`. The command must never load the catalog example
  at runtime. `.config` is the only supported command-template suffix; `.conf`,
  `.yml`, and `.yaml` variants are invalid.

- Profile-owned configuration — optional
  Operational values and credential references live under the selected AI Profile, not in this catalog.

- `<command-name>.command.sh` — optional
  Main executable script.

- `<command-name>.command.mjs` — optional
  Node.js executable entry point when shell is not the appropriate adapter.

- `spec.md` — optional
  Normative detailed behavior. Do not use `<command-name>.spec.md` for the
  bundle specification.

- `<command-name>.command.test.sh` or `<command-name>.command.test.mjs` — optional
  Deterministic executable test.

- `<command-name>.scenario.md` — optional
  Agent-run live acceptance scenario.

- Additional scripts allowed:
  `<command-name>-*.command.sh`
  Example: `sms.command-twilio.setup.sh`

- Provider/source adapters are allowed when one command needs source-specific parsing.
  Prefer `<command-name>-<provider>-<source>-adapter.command.sh` for shell entrypoints.
  Example: `statements-rbc-statement-adapter.command.sh`

- `## Providers` or `## Provider implementations` in `<command-name>.command.md` — optional
  Use when the command is a provider-neutral adapter. List stable capability IDs, linked peer provider command contracts,
  execution routes, supported operations, and missing/disabled/ambiguous-provider behavior. Provider selection comes
  only from validated profile or workflow configuration. Do not add this section when the command has no interchangeable
  provider.

- `ai-commands/dependencies.txt` — optional
  Shared Python package requirements for command scripts. Command shell entrypoints that run Python should create/use
the shared `ai-commands/.venv/` and install these dependencies before running Python helpers.

- `ai-commands/<command-name>/dependencies.txt` — optional
  Command-specific Python package additions. Use only when a command needs packages that should not be part of the
shared command environment.

- `ai-commands/<command-name>/feature.yml` — optional
  Lightweight feature-app metadata for command-owned visual tools. When present, `launch: app.sh` declares the
executable launch entry point so the main launcher does not have to guess. This is metadata, not a plugin framework.

- `ai-commands/.venv/` — optional and gitignored
  Shared Python virtual environment for command scripts. Do not rely on globally installed Python packages when command
dependencies are declared.

The `.command.md` contract and `.command.example.config` template are mandatory,
and every contract declares at least one entry point. Deterministic commands should normally provide a shell or Node
executable. A manual visual command may declare its command-owned `app.sh` UI
launcher. A reasoning-only or provider-neutral command may declare its
`.command.md` contract as the agent entry point rather than adding a no-op
wrapper script.

### Flat Catalog, Adapter Commands, and Subcommands

```mermaid
flowchart TD
  Catalog["Flat command catalog"]
  Catalog --> Adapter["Provider-neutral adapter command"]
  Adapter --> Provider["Peer provider command selected by profile"]
  Catalog --> Parent["Command with scoped operations"]
  Parent --> Subcommand["Subcommand under the same command identity"]
```

Prefer a flat public command namespace because direct command names are easier
to discover, search, register, link, and validate. Adapter commands such as
`source-control`, `ticket-tracker`, and `logs` remain top-level peers of provider
commands such as `git`, `jira`, and `datadog`; the adapter relationship does not require
directory nesting.

Subcommands are a separate concept. A subcommand is a scoped operation that
shares one parent command's identity, contract, authorization boundary, and
configuration—for example, `discussion lookup-conversation`. Use a subcommand
when the operation is part of the same capability, not to model interchangeable
providers. Implementation-only folders remain allowed and do not create new
public command names.

### Command App Launchers (`app.sh`)

A command may provide an optional `app.sh` next to its `*.command.md` and `*.command.sh`. This is the command's visual
tool surface: a small, command-owned UI that can be launched directly from the main AI Electron app while preserving
workflow context.

Use an app launcher when a command benefits from interactive controls, previews, progress streaming, file picking, or
richer visual feedback than a terminal-only script can provide. The launcher is part of the command ecosystem, not a
separate product app. It should be convenient to open from the main AI Electron app and also runnable directly from the
command folder:

```bash
./app.sh
```

Launcher expectations:

- Keep the command documentation source of truth in `<command-name>.command.md`; document the UI launcher there when one exists.
- Keep the launcher self-contained under `ai-commands/<command-name>/` or clearly command-owned subfolders such as `launcher/`.
- Accept launch context from the main AI Electron app when provided, so the UI opens with the selected profile,
workflow, project, scope, paths, output destination, and breadcrumb already applied.
- Do not require manual user preparation after a normal `git pull`. If dependencies are missing, the launcher should
either bootstrap them safely or fail with a clear, actionable message.
- If bootstrapping Node dependencies, distinguish fresh clone setup from repair of an existing install. Fresh clones
may use clean install behavior; launches from an already-running Electron app must not delete or recreate repo-level
`node_modules` in a way that can break the parent app.
- Test launcher startup decisions with non-destructive dry-run coverage where possible, especially for fresh-machine
and partial-install edge cases.
- Treat the UI as independent from the main AI app: it should be runnable with `./app.sh` for local use, while still
integrating cleanly when opened from the main app.
- When creating a new command, consider whether it needs a visual app surface in addition to terminal/script behavior.

Self-contained feature app direction:

- Treat command app launchers as independent feature applications, not implementation details of the main launcher.
- The main launcher discovers and launches feature apps; it should not own feature-specific dialogs when a
command-owned app can own that workflow.
- Feature apps own startup, UI, lifecycle, shutdown, validation, and business flow.
- Feature apps should call their shared TypeScript domain code directly for ordinary application logic.
- Backend APIs are optional and should be introduced only for a real runtime need such as shared services, remote
execution, WebSocket sessions, or long-running orchestration.
- Keep CLI and UI as equal adapters over the same shared domain implementation.
- Use the Video Handwriting launcher as the current reference pattern: command-owned `app.sh`, command-owned UI under
`launcher/`, direct standalone execution, and main launcher integration through the command app button.
- Add `feature.yml` for feature applications so the launch entry point is explicit, for example `id`, `name`,
`workflow`, and `launch: app.sh`.

---

### Platform vs Workflow Commands

Not every command should be globally reusable.

- Platform commands are workflow-independent utilities, such as search, git helpers, Markdown formatting, file
utilities, image optimization, and generic validators.
- Workflow commands belong to a bounded context and are allowed to know workflow-specific concepts.

Examples:

- Multimedia `create-project` may know lyrics, release type, cover mode, thumbnail mode, and scene structure.
- Development `create-project` may know modules, packages, libraries, and release builds.
- Accounting `create-quarter` may know statements, tax reports, quarters, and business folders.

Do not force one universal command when the domains are different. The launcher, command discovery, and `app.sh`
lifecycle are generic; workflow command domain logic is not required to be generic.

### Command Documentation Convention (`*.command.md`)

```mermaid
flowchart TD
  Actor["Actor: command author defines or updates a command"] --> Prompts{"Decision: mandatory Supported Prompts section is present near the top?"}
  Prompts -->|Allowed| Scenarios{"Decision: separate test scenarios are needed?"}
  Prompts -->|Prohibited| Blocked["BLOCKED: command contract is incomplete"]
  Scenarios -->|Yes| Derive["Allowed: derive every scenario from one supported prompt"]
  Scenarios -->|No| Document["Allowed: retain prompt-based command documentation only"]
  Derive --> Outcome["Outcome: discoverable command behavior and test evidence"]
  Document --> Outcome
  Blocked --> Outcome
```

Every command documentation file must contain a `## Supported Prompts` section after the four required opening sections
and before behavior or implementation detail. It declares the natural-language prompts the command accepts and the
expected result for each prompt. A command with no safe supported prompt is `BLOCKED` until its prompt contract is
defined.

Every command contract starts with the same four second-level sections, in
this exact order: `## Purpose`, `## Inputs`, `## Outputs`, and `## Entry Point`. No tags, roles,
usage, diagram, or free-standing description appears before them. Use tables
for the two interface sections so humans and hosts can compare command
interfaces without interpreting prose:

```markdown
## Purpose

State the command's concrete job, when it should be used, the outcome it owns,
and the most important behavior it does not own. Do not use a generic sentence
that merely points back to the rest of the contract.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| `<name>` | Yes / No / Conditional | User / workflow / profile / artifact | What the command consumes and why. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| `<name>` | Caller / file / external system | Observable result or evidence produced. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `<command-name>/<entrypoint>` | Shell executable / Node executable / Command-owned UI launcher / AI-readable contract | How the activated host invokes or loads it. |
```

List profile/workflow activation when it is an execution precondition. List
external effects explicitly. If a command has no domain input, output artifact,
or external effect, write `None` rather than omitting the row or section.

Provider declarations are part of the common structure but are optional. When
the command is provider-neutral, place the declaration after the four required
opening sections:

```markdown
## Provider implementations

| Configured capability | Provider command contract | Route |
|---|---|---|
| `<provider-id>` | [`<provider-id>`](../<provider-id>/<provider-id>.command.md) | Authorizing role resolves intent; execution role runs provider mechanics. |
```

The section must also document supported operations and fail-closed behavior
for missing, disabled, unknown, or ambiguous bindings. It does not move or
replace `Purpose`, `Inputs`, `Outputs`, or `Entry Point`.

A command may add a separate `<command-name>.scenario.md` file for repeatable live acceptance. Each scenario must
name the supported prompt it exercises, use only that prompt's declared scope and expected result, and state its setup,
steps, expected evidence, and prohibited effects. A scenario must not invent a new prompt, broaden file or workspace
scope, or treat an unavailable optional UI route as a successful visible interaction. The command documentation links to
its separate scenario file when one exists.

For new commands and when updating existing command docs, include:

- `## Tags` — searchable hashtags for command discovery / grep-based lookup
  - example: `#coding #ddd #tdd #code-style #oop`
  - use stable topic tags (avoid one-off wording)
- Prefer adding tags near the top of the file so `rg` lookup and quick scanning work well
- Optional: `## Model Recommendations` when command quality depends on model choice
  - include task-specific guidance (for example: writing command should prefer writing-capable models; coding-focused
models may be a poor fit for creative writing)
  - include a `validated on YYYY-MM-DD` date
  - include `subject to change` wording and provider reference links for revalidation

`## Tags` is strongly recommended for all command docs and should be treated as the default documentation style.

---

## Command Index

- `show-context` — render files, URLs, local paths, and `--see` drops into browser-visible context
- `taxes` — summarize configured accounting tax reports and optionally open the result through `show-context`
- `statements` — scan accounting statement PDFs for tax-payment candidates and source evidence
- `acc-report` — inspect, create, and validate accounting report folders under reports/[year]/[business]/[quarter]/in|out|statements
- `review` — governed review with correctness, risk, workflow, role, documentation, and test evidence
- `sdd` — spec-driven development (English-first behavior spec -> code -> verification)
- `session` — create/open/list/close the current AI work session (aliases: `work session`, `session flow`; includes
todo gate, close marker, terminal agent reset)
- `backlog` — manage repo-backed backlog files under `session-root/<work-profile>/backlog/`, pick one into the active
session, sync a story to a GitHub issue, and compile to active `plan.md`
- `writing` — produce writing drafts by type (blog/story/essay) using selected narrative approaches
- `tts` — synthesize speech from text/script via the Whisper TTS pipeline
- `audio-report` — alias of `tts` used when the workflow or user expects spoken progress/final reporting
- `note` — create/update/link/retag Smart Notes in Obsidian-compatible Markdown with retrieval-first tag rules
- `multi-media` — multimedia assistant command with subcommands for YouTube, Suno, and blogging policies/templates/checklists
- `youtube` — CRUD/scaffolding command for YouTube channel, playlist, and episode filesystem structures under the multimedia root
- `lyrics-timestamp` — map lyrics plus audio into timestamped JSON/SRT timing artifacts for renderers and subtitle workflows
- `voice-report` — short-lived spoken completion summaries via the shared Whisper TTS stack

---

### Command Resolution

- User input from `ai-session` (see `AGENTS.md`) is interpreted via the selected workflow (`workflows.md`).
- Every verb-like query must be evaluated against available commands in `ai-commands/`.
- If a match is found, the corresponding command is executed within the workflow context.
- When the active project is resolved through the project registry and its `project.yml` declares `project_rule_paths`,
those repo-local rule files must be read before substantive work and treated as mandatory alongside workflow and
command rules.

---

### Workflow Integration

- Commands are executed by workflows and must:
  - Accept workflow-provided input
  - Produce output consumable by the workflow
  - Respect working directories and reporting expectations defined by the workflow

### Command Python Dependencies

- Keep common Python command packages in `ai-commands/dependencies.txt`.
- Command shell entrypoints that run Python should bootstrap the shared `ai-commands/.venv/` before invoking Python helpers.
- Run command Python helpers through `ai-commands/.venv/bin/python`, not through the global `python3`, when dependency files exist.
- A command may add `ai-commands/<command-name>/dependencies.txt` for command-specific extras, but shared dependencies
should be preferred when multiple commands can reasonably use them.
- The command entrypoint may auto-create `.venv/` and install or refresh dependencies when dependency files change.
- Do not assume globally installed Python packages are available when command dependency files exist.
- OS-level tools such as `ffmpeg`, `tesseract`, or `jq` are not Python dependencies; commands should check for them
explicitly and print a clear install hint when they are missing.

---

### Dialog Command Convention

- `ai-commands/dialog/` handles Q/A logging.
- If user input contains `??`:
  - Route to `dialog` command
  - Append entry to:
    `ai-commands/dialog/log/<project-name>/<task-name>/*-dialog.md`
  - Logs are gitignored

---

### Policies

- Commands must load and follow policies defined by the active workflow.
- Commands must also honor project-local rule files declared by the selected profile project's metadata (for example
`project_rule_paths` in the selected profile project definition (`AI_PROFILE_PROJECT_FILE`)).
- Workflow policies override local command behavior when applicable.
- Project-dependent commands receive one exact profile-owned `project.yml`
through `AI_PROFILE_PROJECT_FILE`; reusable commands never own a project
registry under `ai-commands/`.

---

### Shared Scripts

- Common setup script:
  `command-config.setup.sh`
- Should be reused by all commands where applicable.

---

### Policies:

No default workflow policies are enforced.
