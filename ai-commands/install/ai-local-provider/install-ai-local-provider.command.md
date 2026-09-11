# Install AI Local Provider

## Purpose

Use `install-ai-local-provider` to provision a remote Ubuntu AMD64 machine as a local AI inference provider over SSH.

The user selects a model preset from [`presets/`](presets/). The preset defines the model/runtime and machine requirements; profile configuration contains machine-specific connection values and supported overrides.

Normative behavior is defined by [`install-ai-local-provider.spec.md`](install-ai-local-provider.spec.md).

**Status: SNAPSHOT — not runnable until implemented and tested.**

## Entry point

```text
install/ai-local-provider/install-ai-local-provider.sh
```

## Interface

```text
install-ai-local-provider.sh \
  --target <user@host> \
  --preset <preset-id>
```

Example:

```text
install-ai-local-provider.sh \
  --target ai@192.168.1.50 \
  --preset qwen3-coder-next
```

Operational machine values are resolved from profile-owned command configuration through `AI_COMMAND_CONFIG_PATH`.

## Presets

Presets are committed, selectable local-model definitions. They describe the model, runtime, context and minimum/recommended machine requirements.

Before installation the command inspects the target and compares it with the selected preset. Failed minimum requirements block execution with `REQUIREMENTS_NOT_MET`; recommended requirements are advisory.

## Configuration

Copy `install-ai-local-provider.command.example.config` into the selected profile and reference that copy from the command configuration. The committed example is documentation only.

SSH credentials and machine-specific/private values remain outside the preset and outside this public repository.

## Execution

The command connects to the target over SSH, validates Ubuntu 24.04 and `x86_64`, detects hardware, validates the selected preset's requirements, installs its runtime/model, creates a systemd service, enables it at boot and verifies the resulting API with a health/inference request.

The operation is idempotent: subsequent executions reconcile the target with the requested preset/configuration.

## Initial scope

- Ubuntu 24.04 LTS Desktop or Server
- AMD64 / x86_64 only
- SSH remote provisioning
- selectable model presets
- systemd-managed provider
- local/private API exposure by default

ARM64 is not supported by the initial implementation.

## Completion

Complete only when the provider service is enabled, running and verified through its configured endpoint.

## Tags

`#command` `#ai-command` `#install` `#ai` `#local-ai` `#provider` `#model-preset` `#ubuntu` `#amd64` `#ssh` `#systemd` `#sdd`
