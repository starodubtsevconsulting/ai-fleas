# Install AI Local Provider

## Purpose

Use `install-ai-local-provider` to interactively provision a remote Ubuntu AMD64 machine as a local AI inference provider over SSH.

The command is profile-aware. Normally the user runs it without arguments and the active profile supplies known boxes, SSH settings and defaults. Missing information is collected interactively.

Normative behavior is defined by [`install-ai-local-provider.spec.md`](install-ai-local-provider.spec.md).

**Status: SNAPSHOT — not runnable until implemented and tested.**

## Entry point

```text
install/ai-local-provider/install-ai-local-provider.sh
```

## Normal invocation

```text
install-ai-local-provider.sh
```

When the active profile already contains boxes, the command presents them and an option to add another target:

```text
AI Local Provider

Available machines:
1. mini-01   192.168.1.41
2. mini-02   192.168.1.42
3. gx10-01   192.168.1.43
4. Add new machine

Select machine:
```

After selecting a machine, the command resolves its profile configuration, asks only for unresolved required values, presents available model presets, shows the final plan and asks for confirmation before provisioning.

## First-run / incomplete configuration

If no command configuration exists, or it contains no boxes, the command MUST NOT fail with an unexplained missing-config error. It explains what it needs and guides the user through adding a target machine.

Example interaction:

```text
No AI provider machines are configured for the active profile.

This command provisions an Ubuntu AMD64 machine over SSH.
You can add a machine now. Its connection settings can then be saved in the profile command configuration for reuse.

1. Add machine
2. Show configuration example/path
3. Exit
```

The interaction then collects a logical box name, host/IP, SSH user, SSH port if non-default, SSH key path if required, and preset/default choices. Before connection or installation it summarizes the resolved target.

The command may tell the user exactly which active-profile command configuration needs to be created/updated. It MUST NOT silently write secrets into the public command repository.

## Non-interactive overrides

Explicit arguments remain supported for agents/automation:

```text
install-ai-local-provider.sh \
  --box mini-02 \
  --preset qwen3-coder-next
```

A direct target may also be supplied when intentionally bypassing the saved box list:

```text
install-ai-local-provider.sh \
  --target ai@192.168.1.50 \
  --preset qwen3-coder-next
```

## Resolution order

Values are resolved in this order, highest precedence first:

1. explicit CLI arguments;
2. selected box values from active-profile command configuration;
3. active-profile command defaults;
4. selected committed preset defaults;
5. interactive prompt for still-required values.

The command MUST show the resolved target/model before provisioning.

## Profile configuration

The host activates the selected AI profile/workflow and exposes profile-owned command configuration through `AI_COMMAND_CONFIG_PATH` according to the common command contract.

A profile configuration may contain multiple named boxes. This represents the user's shelf/pool of dedicated AI machines. Each box can define:

- logical name;
- host/IP;
- SSH user;
- SSH port;
- SSH key path;
- optional default model preset;
- supported machine-specific overrides.

SSH private key contents and passwords MUST NOT be stored in this public repository. Configuration should reference a local SSH key path or compatible SSH configuration/agent instead.

See `install-ai-local-provider.command.example.config`.

## Presets

Presets are committed selectable local-model definitions under [`presets/`](presets/). They describe model/runtime defaults and minimum/recommended machine requirements.

The command presents available presets interactively unless a preset is already resolved. Selecting a preset includes downloading the model if a valid matching model is not already installed.

## Execution

After target/model resolution and confirmation, the command connects over SSH, validates Ubuntu 24.04 and `x86_64`, validates machine requirements, provisions `/opt/ai-local-provider`, downloads/reuses the model, installs the systemd service, launches the provider and completes a real inference verification.

The operation is idempotent.

## Initial scope

- interactive by default;
- profile-aware;
- multiple saved AI boxes per profile;
- Ubuntu 24.04 LTS Desktop or Server;
- AMD64 / x86_64 only;
- SSH remote provisioning;
- selectable model presets;
- systemd-managed provider;
- trusted-LAN HTTP API without authentication by default.

ARM64 is not supported by the initial implementation.

## Completion

Complete only when the selected target is provisioned, the provider is running, the selected model is loaded, and real HTTP inference verification succeeds.

## Tags

`#command` `#ai-command` `#install` `#ai` `#local-ai` `#provider` `#interactive` `#profile-aware` `#model-preset` `#ubuntu` `#amd64` `#ssh` `#systemd` `#sdd`
