# Install AI Local Provider

## Purpose

Use `install-ai-local-provider` to install an AI Local Provider either on the active profile's local computer or on a dedicated remote AI machine.

The command is interactive and profile-aware. The installed provider belongs to the AI profile and may be consumed by the profile's `(profile, platform)` System agents and by commands that declare optional AI assistance.

Normative behavior is defined by [`install-ai-local-provider.spec.md`](install-ai-local-provider.spec.md).

**Status: SNAPSHOT — not runnable until implemented and tested.**

## Normal invocation

```text
install-ai-local-provider.sh
```

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

## First-run / incomplete configuration

Missing configuration is handled interactively. The command explains what is needed and offers to configure the local provider, add a remote machine, show the relevant profile configuration/example, or exit.

It MUST NOT fail with only a low-level missing-config/path/parser error.

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
