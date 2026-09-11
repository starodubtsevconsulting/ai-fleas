## Commands Folder — Specification

### Resolving the command catalog

The selected AI Profile is authoritative for the command catalog. Profile activation resolves `AI_COMMANDS_ROOT` and profile-owned command configuration. Every command execution is profile-aware.

Reusable command directories must not contain populated operational configuration. Secret-bearing and organization-specific overrides belong in the selected profile's ignored local configuration and are exposed as `AI_COMMAND_CONFIG_PATH`.

`ai-commands/_runtime/` is reserved internal infrastructure, not a public command bundle.

### Structure

Each top-level public command has a command contract and adjacent metadata manifest.

- `<command-name>/<command-name>.command.md` — required command contract.
- `<command-name>/<command-name>.command.yml` — required lightweight command metadata for the top-level command.
- `<command-name>/<command-name>.command.example.config` — required safe configuration template.
- Profile-owned configuration — optional operational values and credential references.
- `<command-name>.command.sh` / `.mjs` — optional deterministic executable.
- `spec.md` — optional detailed normative behavior.
- `<command-name>.command.test.*` — optional deterministic test.
- `<command-name>.scenario.md` — optional live acceptance scenario.
- `feature.yml` / `app.sh` — optional command-owned visual application.

A command bundle may contain subcommands. Subcommands execute under the parent command's contract and do not declare their own `ai.powered` metadata unless they are promoted to independent top-level commands.

Every top-level public command MUST have an adjacent `<command-name>.command.yml` with an explicit AI-powered flag. The canonical minimum is:

```yaml
ai:
  powered: false
```

`false` is the default for the catalog. Existing and newly created commands remain deterministic unless a human intentionally changes that command's metadata/contract to `true` and defines the AI-powered behavior. Hosts MUST fail validation for a top-level public command whose adjacent manifest is missing or whose `ai.powered` value is absent/non-boolean; they must not infer `true` from model availability.

### AI-powered commands

`ai.powered` controls only human-initiated interactive command execution, such as a person invoking the command from a terminal or equivalent manual command surface. It does not change how workflow agents, managers, coders, command runners, schedulers, or other automation invoke commands.

AI-powered execution is an interactive mode of the same command, not a separate permanent role or replacement command.

```yaml
ai:
  powered: true
```

For a manual interactive invocation:

- when `ai.powered: false`, the Command Runner invokes the deterministic executable/UI path normally;
- when `ai.powered: true`, the host creates a fresh ephemeral command AI session initialized from the active AI Profile's System role/configuration for the selected platform.

The ephemeral session is System-scoped for authority and configuration, but it is NOT the persistent System agent conversation. It must not read, append to, or retain the persistent System agent's conversational context unless a command contract explicitly authorizes a narrowly scoped persisted artifact.

For an agent-, workflow-, scheduler-, or automation-initiated invocation, the command ALWAYS executes through its deterministic path. The caller must not activate the command's AI interaction mode, even when the command declares `ai.powered: true`.

```mermaid
flowchart LR
  Caller{"Invocation source"}
  Caller -->|human / interactive| Mode{"top-level command ai.powered"}
  Caller -->|workflow / agent / automation| Exec["Deterministic command"]
  Mode -->|false| Exec
  Mode -->|true| Profile["Active AI Profile"]
  Profile --> Session["Ephemeral System-scoped command session"]
  Session --> Context["System role/config + command contract + profile + command config"]
  Context --> Capability["Command-authorized capabilities / subcommands"]
  Session --> Provider["Profile System-agent provider binding"]
  Provider --> Model["Model"]
  Session --> Done["Finish command and discard session context"]
```

This prevents recursive or competing agent orchestration. A workflow agent that already owns reasoning for a workflow calls commands as deterministic capabilities; it must not cause the command to create another reasoning layer merely because `ai.powered` is enabled for humans.

The persistent System agent remains profile-aware and platform-specific: there is exactly one active System agent per `(profile, platform)` binding. AI-powered command sessions reuse its role/configuration model and provider binding, but do not reuse its conversation history or become additional persistent System identities.

Whether inference is local or remote is an implementation detail of the profile binding and does not change command-session authority.

AI-powered command execution is not implemented yet. Until that runtime exists, if a human manually invokes a top-level command whose `ai.powered` is `true`, the interactive runner MUST stop before deterministic execution and report clearly that AI-powered command support is not implemented yet. It MUST NOT silently ignore the flag or fall back to ordinary interactive execution. Non-interactive workflow/agent/automation invocation continues to use the deterministic command path.

For a manual AI-powered invocation, the ephemeral System-scoped session acts only inside the selected command's scope. It may reason, explain, ask questions, guide interactively, handle errors/recovery, and invoke only the deterministic mechanics, subcommands, and external effects authorized by that command contract.

AI-powered mode MUST NOT expand command authority or permanently expand System authority. The command contract remains the authorization boundary for the invocation. Model reasoning cannot create permissions, bypass confirmations, broaden external effects, access unrelated capabilities, or reinterpret prohibited behavior as allowed.

Commands do not hard-code Hermes, provider, or model details. The selected platform realizes the System role/configuration used to initialize the ephemeral command session, and the session resolves the profile's configured `system_agent` provider/model binding. Hermes is currently the default local platform/harness assumption, but the command contract remains platform-independent.

A command may also use direct provider inference for narrow deterministic operations explicitly defined by that command. That is separate from `ai.powered`, which refers to the manual ephemeral AI interaction layer.

```text
human + ai.powered=false -> deterministic command
human + ai.powered=true  -> ephemeral System-scoped session -> command scope -> deterministic mechanics/subcommands -> discard context
workflow/agent/automation -> deterministic command
```

### Command App Launchers (`app.sh`)

A command may provide an optional `app.sh` visual surface. UI and CLI remain adapters over the same command contract and authority boundary.

### Platform vs Workflow Commands

Platform commands are workflow-independent utilities; workflow commands belong to a bounded context and may know workflow-specific concepts. Do not force one universal command when domains differ.

### Command Documentation Convention (`*.command.md`)

Every top-level command documentation file must contain `## Purpose`, `## Inputs`, `## Outputs`, and `## Entry Point` in that order, followed by a mandatory `## Supported Prompts` section before behavior/implementation detail.

Every top-level command contract has an adjacent `<command-name>.command.yml` AI execution declaration. Commands with `ai.powered: false` remain deterministic for manual invocation. Commands changed to `ai.powered: true` are considered declared for future human-facing ephemeral System-scoped execution. This metadata never changes workflow/agent/automation invocation into AI-powered execution.

Subcommand contracts may exist inside a bundle but inherit the parent command's authority envelope. They do not independently select AI execution.

### Command Resolution

The host resolves the top-level command and the invocation source.

- Human/manual interactive invocation: read the top-level manifest and select deterministic versus ephemeral System-scoped interactive execution.
- Workflow/agent/scheduler/automation invocation: execute the deterministic command path regardless of `ai.powered`.

Profile policy may disable AI execution but MUST NOT turn a command whose catalog flag is `false` into an AI-powered command without an explicitly governed command metadata change.

### Workflow Integration

Commands accept workflow-provided input, produce workflow-consumable output, and respect workflow/project scope. Workflow agents use commands as deterministic capabilities. They do not inherit or trigger the human-facing `ai.powered` interaction layer.

### AI provider relationship

AI providers belong to the active profile. Provider selection supplies inference only; it does not grant capabilities. Human-facing AI-powered command sessions use the provider/model bound to the active profile/platform System configuration. The provider may be local or remote; command authority remains defined by the command contract.
