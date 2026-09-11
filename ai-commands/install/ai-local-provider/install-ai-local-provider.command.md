# Install AI Local Provider

## Purpose

Use `install-ai-local-provider` to install an AI Local Provider either on the active profile's local computer or on a dedicated remote AI machine.

The command is interactive and profile-aware. The installed provider belongs to the AI profile and may be consumed by the profile's `(profile, platform)` System agents and by commands that declare optional AI assistance.

Normative behavior is defined by [`install-ai-local-provider.spec.md`](install-ai-local-provider.spec.md).

**Status: BETA — SSH onboarding, machine qualification, fresh-Ubuntu dependency installation, pinned model/runtime provisioning, service setup, and inference verification are runnable.**

The normative, human-readable execution contract is [`PLAN.md`](PLAN.md). Stable
step IDs are emitted during execution, and automated plan-sync validation prevents
the document and implementation from drifting apart.

Every invocation prints and writes a timestamped, permission-restricted transcript
under `ai-commands/install/ai-local-provider/logs/`. The terminal and log receive the same progress,
so a human or AI collaborator with workspace access can inspect an active or failed
run. Interactive sudo password input is never echoed or logged.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned machine configuration. |
| Action | No | Human or workflow | `inspect`, `status`, `preflight`, or `install`; defaults to `install`. |
| Target | Yes for remote mode | Profile, CLI, or interactive prompt | A configured box ID, SSH alias, or explicit host and SSH user. |
| Model preset | Yes for installation | Profile, CLI, or committed preset default | Reviewed model/runtime definition to validate and provision. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Connection and machine evidence | Caller or private profile inventory | Structured SSH, identity, OS, architecture, resource, GPU, privilege, and service status. |
| Guided recovery | Caller | Safe host-key, public-key enrollment, configuration, and retry guidance. |
| Provider installation | Selected local or remote machine | Reconciled runtime, model, service, endpoint, and verified inference when supported. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/ai-local-provider/install-ai-local-provider.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify workflow authorization and expose the selected profile-owned
configuration as `AI_COMMAND_CONFIG_PATH`.

Committed configuration template: `install/ai-local-provider/install-ai-local-provider.command.example.config`. Copy it
into the selected profile, set only supported non-secret overrides, reference the copy through `commands[].config`, and let
the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be operational configuration.

## Normal invocation

```text
install-ai-local-provider.sh [status|preflight|install]
```

Launching the shell file with no arguments in a terminal opens a deterministic guided menu. It explains the command's
current capabilities, offers first-run preflight, status, installation-plan validation, help or exit, lists machines from
the active profile, and collects a one-run target when the profile has none. This interface does not require AI-powered
execution. A future AI layer orchestrates the same entry point and result states rather than replacing its mechanics.

The command first selects installation mode:

```text
Install AI Local Provider

1. This profile / local computer
2. Dedicated remote machine
3. Exit
```

## Profile-local provider

The first implementation targets macOS, where the active AI profile commonly runs on the user's laptop/desktop.

The profile-local flow:

1. detect macOS and CPU architecture;
2. inspect available memory/resources;
3. present compatible small/fast model presets;
4. install/reuse `llama.cpp` / `llama-server` locally;
5. download/reuse the selected model;
6. configure a localhost-only HTTP provider;
7. configure local autostart/service lifecycle appropriate for macOS;
8. launch the provider;
9. verify HTTP and real inference;
10. register/reconcile the provider in the active profile's `ai_providers` configuration when explicitly authorized.

The default profile-local endpoint is localhost only and is intended as a small, always-available inference capability for System and AI-enabled commands.

## Dedicated remote provider

The remote flow provisions Ubuntu AMD64 over SSH. When profile command configuration contains known boxes, the command lists them plus `Add new machine`.

```text
Available machines:
1. mini-01   192.168.1.41
2. mini-02   192.168.1.42
3. gx10-01   192.168.1.43
4. Add new machine
```

It resolves SSH settings from the active profile, installs the provider under `/opt/ai-local-provider`, downloads/reuses the model, installs/enables systemd, launches the model and verifies real inference.

Before installation it performs conservative system cleanup using Ubuntu's own
temporary-file policy, trims old journals and package caches, and removes stale
partial downloads owned by this command. It does not delete Downloads, user
documents, arbitrary home caches or backups, or unrelated application data.

Selecting a machine applies only to the current invocation. The profile may contain any number of named machines, and the
human can choose a different configured machine or `Add new machine` each time without changing the default.

Before provisioning, the command guides SSH onboarding:

1. resolve or collect the machine's logical ID, host, user, port and key/SSH-alias reference;
2. verify reachability and present an unknown SSH host-key fingerprint for human verification;
3. test non-interactive public-key or SSH-agent authentication;
4. if authorization is missing, show the public key being used and a copyable `ssh-copy-id` command, then let the human retry;
5. verify the remote user, Ubuntu/architecture and required `sudo` access;
6. optionally save only non-secret connection references to the active profile; and
7. continue directly to model selection and installation.

The command never accepts a password override and never asks for a password in AI chat. A one-time SSH or `sudo` password
may be entered only into a trusted, non-echoing interactive terminal prompt. Passwords and private-key contents are never
stored in the profile, command arguments, environment variables, logs or this repository.

## First-run / incomplete configuration

Missing configuration is handled interactively. The command explains what is needed and offers to configure the local provider, add a remote machine, show the relevant profile configuration/example, or exit.

It MUST NOT fail with only a low-level missing-config/path/parser error.

Connection discovery is read-only. Saving a new machine to the profile and provisioning it are separate choices. The human
may use an entered machine once without saving it, and may retry after authorizing a public key without restarting the command.

## Profile AI providers

AI provider definitions belong to the profile, not to individual commands or System instances. A profile can expose providers such as:

```yaml
providers:
  - id: local
    type: local
    endpoint:
      url: http://127.0.0.1:8080/v1

  - id: mini-01
    type: remote
    endpoint:
      url: http://192.168.1.41:8080/v1
```

Consumers bind by provider ID. A System instance may use the profile's `system_agent` provider binding; AI-enabled commands may use the profile's command default or their own allowed provider policy.

Provider selection supplies inference only. It never expands a command's or System agent's authority.

## System cardinality

System remains exactly one active instance per `(profile, platform)` binding. Several profiles may run on one platform, each with an isolated System instance. One profile may also have separate System instances on several platforms.

Those instances may share the same profile-level AI provider without sharing their platform runtime state, watch scope or lifecycle authority.

## Remote box configuration

Remote provisioning details stay in profile-owned command configuration. A profile may define multiple named boxes with host/IP, SSH user, SSH port, SSH key path/reference, optional preset and supported overrides.

Private key contents/passwords MUST NOT be committed. Reference local key paths or supported private credential mechanisms.
An `ssh_alias` from the user's SSH configuration is also supported. Conflicting alias and explicit connection values fail
closed instead of being guessed.

## Resolution order

Values resolve in this order:

1. explicit CLI arguments;
2. selected profile provider/box values;
3. active-profile command defaults;
4. committed preset defaults;
5. interactive prompt for unresolved required values.

The command shows the resolved plan before provisioning and requires confirmation unless an explicitly supported non-interactive authorization mode is used.

## Presets

Presets are committed selectable model/runtime definitions under [`presets/`](presets/). The command presents compatible presets interactively when one is not already resolved. Selecting a preset includes downloading the model when a valid matching artifact is not already installed.

## Completion

Complete only when the selected provider is installed, launched, its model is ready, HTTP responds and real inference succeeds. When profile registration was requested, the profile provider binding must also be reconciled successfully.

## Tags

`#command` `#ai-command` `#install` `#ai` `#local-ai` `#provider` `#macos` `#ubuntu` `#interactive` `#profile-aware` `#system-agent` `#model-preset` `#ssh` `#sdd`
