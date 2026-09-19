# hermes

## Purpose

Use `hermes` inside the `install` command group to manage physical Hermes software without encoding its installation
form in the command identity. It can inspect, smoke-test, install, check for updates, upgrade, or uninstall a selected
component on macOS Apple Silicon. The current implementation supports the reviewed `bundle`; future adapters may add
standalone application, backend, or CLI forms without renaming the command. The separate `hermes-agents` command manages Hermes profiles,
bots, conversations, and workflow groups.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorization and audit envelope only; it does not configure installation. |
| Action | Yes | User | `status`, `smoke-test`, `install`, `check-update`, `update`, `upgrade`, or `uninstall`. |
| Component | No | User | Installation form selected with `--component`; defaults to `bundle`. Unsupported values fail closed. |
| Local platform | Yes | Runtime | Must be exactly `Darwin/arm64`. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Installation result | Caller | Verified Hermes version, offline smoke evidence, stable-update recommendation, or exact no-mutation failure. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/hermes/hermes.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke `<action> [--component bundle]` through the command runner. |

Every governed invocation is profile-authorized, but installation behavior is profile-independent. The profile cannot
select the component, version, destination, or post-install tuning.

The committed configuration file is an authorization placeholder and declares no operational overrides.

## Supported Prompts

| Human prompt | Expected result |
|---|---|
| `Is Hermes installed?` | Report the exact installed Hermes version without mutation. |
| `Smoke-test Hermes` | Run isolated offline `--version` and `--help` probes. |
| `Install Hermes` | Run the reviewed installer, verify the pinned result, and require a passing smoke test. |
| `Check for a Hermes update` | Compare installed, latest stable, and reviewed supported versions without mutation. |
| `Upgrade Hermes` | Apply the reviewed stable version only after explicit authorization, then smoke-test it. |
| `Uninstall Hermes` | Require explicit confirmation and preserve profiles and conversations; fail closed until an ownership-safe remover exists. |

## Linked Commands

| Command | Relationship | Use when |
|---|---|---|
| [`install`](../install.command.md) | Parent command group and alias router | A generic installation request such as `Install Hermes` needs routing to this command. |
| [`hermes-agents`](../../system/hermes-agents/hermes-agents.command.md) | Dependent platform lifecycle command | The installed application will initialize or manage Hermes profiles, bots, conversations, or workflow groups. |

This command establishes the physical prerequisite only. A successful installation never initializes bots automatically.
For an existing, selected AI profile and workflow, `hermes-agents initialize` is the next step. It creates the workflow
bots and their generated instructions; when a protected model connection is selected through `secrets run hermes-agents`,
it also configures Hermes's built-in command secret source for those bots. No separate Hermes plugin installation is
required for that integration.

## Behavior

- Supports local `Darwin/arm64` only.
- Keeps installation form orthogonal to command identity. Currently supported: `bundle`; possible future forms include
  reviewed application, backend, and CLI adapters.
- Treats `update` as the read-only alias of `check-update`; `upgrade` is the mutating action.
- Reuses the public reviewed Hermes installer and its rollback checks without depending on a private launcher.
- Requires isolated `--version` and offline `--help` probes after install or upgrade.
- Never deletes Hermes profiles, conversations, workflow groups, provider configuration, or credentials.

## FAQ

### If I install Hermes, will my agents use the secret service automatically?

The app install makes Hermes available; it cannot choose a private profile, workflow, model route, or secret provider.
If the installed Hermes CLI already passes this command's `status` and `smoke-test`, do not reinstall it merely to use
`hermes-agents` or `secrets`; continue with profile initialization or reconciliation. The standalone `secrets` command
does not require Hermes at all.
Once those are configured in the selected profile, initialize the workflow with `hermes-agents`. For a model route
protected by credentials, invoke initialization through `secrets run hermes-agents -- initialize ...`; the initializer
wires Hermes's built-in startup source automatically. For agent work, the selected workflow must also allow `secrets`
and each intended consumer must have a mapping in the profile-owned `secrets` config. Generated agent instructions then
direct the bot to `secrets run <consumer> -- <operation>`. Initialization validates the selected `secrets` configuration
before changing Hermes profiles; it does not fetch every consumer credential. There is no generic secret-reading plugin
to install.

Verify these layers separately: `hermes smoke-test` proves the physical install; `secrets validate` and `secrets status`
check the configured provider; `hermes-agents initialize` must produce a complete workflow receipt; a fresh bot session
must get a model response; and a bounded read-only `secrets run` operation must succeed for each consumer being adopted.
An install smoke test alone does not prove provider authentication or consumer access.

## Tags

#command #install #hermes-agents #macos #apple-silicon #smoke-test
