# install.command

## Purpose

Use `install` to manage the physical lifecycle of explicitly selected software: inspect, install, check for updates,
upgrade, or uninstall it through a target-specific adapter and verify the result. Application-specific agent, profile,
workflow, project, bot, task, and group lifecycle remains in the application's own command.

```mermaid
flowchart LR
  Request["Human software request"] --> Install["install command"]
  Install --> Target{"Canonical target"}
  Target -->|gpt-app| GPT["GPT App package adapter"]
  Target -->|hermes-app| Hermes["Hermes App package adapter"]
  GPT --> Physical["status / install / update / upgrade / uninstall"]
  Hermes --> Physical
  GPT -. agent lifecycle .-> GPTCommand["gpt-app command"]
  Hermes -. bot lifecycle .-> HermesCommand["hermes-app command"]
```

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |
| Installation target | Yes for targeted lifecycle | User or profile | Canonical target ID such as `gpt-app` or `hermes-app`; human aliases `GPT` and `Hermes` resolve to those exact IDs. |
| Lifecycle action | Yes for targeted lifecycle | User | One of `status`, `install`, `check-update`, `update`, `upgrade`, or `uninstall`. |

- `ai-commands/install/*`

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Local machine tooling configured by the selected `install.sh` (some tools install under the home directory, others system-wide).

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/install.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/install.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #install

Install and configure dev tooling using the local `ai-commands/install/` tree.

## Usage

- `${AI_COMMANDS_ROOT}/install/install.sh` (run all installs)
- `${AI_COMMANDS_ROOT}/install/<tool>/install.sh` (run a single tool)
- `${AI_COMMANDS_ROOT}/install/check.sh` (optional, if present)
- `Install GPT` → resolve target `gpt-app`, then invoke its package adapter's `install` action.
- `Update Hermes` → resolve target `hermes-app`, then invoke read-only `check-update`; use `upgrade` only after explicit authorization.
- `Uninstall <target>` → require the exact canonical target, adapter support, and explicit confirmation.

## Application targets

| Human wording | Canonical target | Physical lifecycle owner | Not owned here |
|---|---|---|---|
| `GPT`, `GPT App`, `Codex App`, or `ChatGPT App` | `gpt-app` | The GPT desktop application's trusted host installer and update channel. First-time installation uses the official platform-appropriate ChatGPT desktop installer. | Codex task, sidebar-section, logical-project, and managed-agent lifecycle. |
| `Hermes` or `Hermes App` | `hermes-app` | The reviewed Hermes package installer already exposed by the public Hermes integration. | Hermes role profiles, bots, conversations, and workflow groups. |

The existing `install/codex` target remains **Codex CLI**, not `gpt-app`. Detecting a Codex binary bundled inside a desktop
application does not make the CLI installer a desktop-application installer.

## Lifecycle semantics

| Action | Mutation | Required behavior |
|---|---|---|
| `status` | No | Report installed/not-installed and exact version evidence when available. |
| `check-update` / `update` | No | Consult only the target's trusted stable channel and recommend `upgrade` when newer. `update` is a human-friendly alias for this read-only action. |
| `install` | Yes | Install an absent target through its reviewed target adapter, then verify identity and version. |
| `upgrade` | Yes | Require explicit authorization, preserve supported application data, apply the reviewed stable update, and verify the new version. |
| `uninstall` | Yes | Require the exact target and explicit confirmation; remove only adapter-owned application artifacts and report separately preserved user data. |

If a host does not expose a trustworthy operation, return `<TARGET>_<ACTION>_UNAVAILABLE` without substituting a CLI,
opening an unrelated package manager, scraping a download, or claiming success.

## Rules

- Prefer running `${AI_COMMANDS_ROOT}/install/check.sh` first to see what is already installed.
- Resolve application aliases to a canonical target before execution; never infer a target from a running agent or nearby repository.
- Keep package lifecycle in `install`; application commands may retain compatibility delegates but must route physical
  installation or upgrade through this contract.
- `update` is read-only. Never turn an update check into an automatic upgrade.
- Never interpret uninstalling an application as authorization to delete its agents, profiles, projects, groups,
  conversations, credentials, repositories, or other user data.
- Each folder owns its own `install.sh` and README.
- If a tool supports update checks, add a `check-update.sh` and have `install.sh` call it to decide whether to prompt
for updates or reinstall.
- For language runtimes, use `v_matrix.json` to pick recommended versions.
- All install scripts must initialize logging via `report_log_init`; logs go to `ai-commands/install/logs/install.log`.
- Install logs are local artifacts and must not be committed.
- Reinstalling is OK; scripts should be idempotent where possible.
- After running installs, open a new shell (or run `exec zsh`) to activate changes.

## Roles selection

- dev
