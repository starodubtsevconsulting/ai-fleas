# Install AI Local Provider

## Purpose

Use `install-ai-local-provider` to provision a remote Ubuntu AMD64 machine as a local AI inference provider over SSH.

Normative behavior is defined by [`install-ai-local-provider.spec.md`](install-ai-local-provider.spec.md).

**Status: SNAPSHOT — not runnable until implemented and tested.**

## Entry point

```text
install/ai-local-provider/install-ai-local-provider.sh
```

## Interface

```text
install-ai-local-provider.sh --target <user@host>
```

Operational values are resolved from profile-owned command configuration through `AI_COMMAND_CONFIG_PATH`.

## Configuration

Copy `install-ai-local-provider.command.example.config` into the selected profile and reference that copy from the command configuration. The committed example is documentation only.

The configuration defines the provider rather than the installer identity: runtime, model, context size, API address/port and service settings can vary per machine.

## Execution

The command connects to the target over SSH, validates Ubuntu 24.04 and `x86_64`, detects hardware, installs the configured runtime/model, creates a systemd service, enables it at boot and verifies the resulting API with a health/inference request.

The operation is idempotent: subsequent executions reconcile the target with the requested configuration.

## Initial scope

- Ubuntu 24.04 LTS Desktop or Server
- AMD64 / x86_64 only
- SSH remote provisioning
- systemd-managed provider
- local/private API exposure by default

ARM64 is not supported by the initial implementation.

## Completion

Complete only when the provider service is enabled, running and verified through its configured endpoint.

## Tags

`#command` `#ai-command` `#install` `#ai` `#local-ai` `#provider` `#ubuntu` `#amd64` `#ssh` `#systemd` `#sdd`
