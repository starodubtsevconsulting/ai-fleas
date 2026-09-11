# Install AI Local Provider Specification

## Purpose

`install-ai-local-provider` provisions a remote Ubuntu machine as a reusable local AI inference provider.

The user selects a model preset. A preset defines the model/runtime defaults and the machine requirements for that model. Machine-specific connection details remain profile-owned configuration.

## Status

SNAPSHOT. The command MUST NOT perform installation until implementation and tests are complete.

## Initial deployment model

The initial contract is intentionally simple:

**one machine -> one provider server -> one model**.

The configured model is loaded when the provider starts. The provider is managed by systemd and starts automatically with the machine.

The initial implementation does not support multiple simultaneously hosted models, model switching, or a model registry. To use a different model, re-provision the machine with another preset or use another machine.

## Default API and network contract

The initial default is a trusted-LAN provider:

- HTTP API;
- no TLS/HTTPS;
- no API key;
- no application-level authentication;
- reachable from the local LAN;
- never exposed to the public Internet by default.

Because the default API is unauthenticated HTTP, network isolation is the security boundary. Installation MUST NOT create router/NAT port forwarding, public tunnels, or other public exposure.

## Supported platform

Initial implementation supports only:

- Ubuntu 24.04 LTS (Desktop or Server)
- AMD64 / x86_64 architecture
- remote access over SSH

The command MUST verify the remote architecture with `uname -m` before making changes. Any value other than `x86_64` MUST fail with `UNSUPPORTED_ARCHITECTURE`.

ARM64 is explicitly out of scope for the initial implementation.

## Inputs

- SSH target (`user@host`)
- preset ID (`--preset <preset-id>`)
- optional SSH port / identity supplied by profile-owned configuration
- optional supported preset overrides supplied by profile-owned configuration

Secrets and machine-specific credentials MUST NOT be committed to this repository.

## Model presets

Presets live under `presets/` and are selectable by ID.

Each preset MUST be able to describe:

- model source, repository/file and quantization;
- context size;
- runtime;
- supported OS and architecture;
- minimum and recommended memory;
- minimum free disk space;
- GPU requirements when applicable;
- HTTP API and LAN exposure defaults;
- systemd/autostart settings.

The preset is the portable definition of a known local AI provider configuration. SSH targets, credentials and machine-specific secrets are not preset data.

Before making changes, the command MUST inspect the target and compare detected capabilities with the selected preset. Minimum requirements are blocking. Recommended requirements are advisory.

A failed requirement check MUST return `REQUIREMENTS_NOT_MET` and identify the failed requirements. A preset containing unresolved required values MUST return `PRESET_NOT_READY`.

## Required behavior

The command MUST:

1. Resolve and validate the selected preset.
2. Verify SSH connectivity.
3. Detect the remote OS and architecture without changing the target.
4. Refuse unsupported OS/architecture before installation.
5. Detect available CPU, memory, free disk and GPU hardware.
6. Compare the machine against the preset requirements.
7. Stop before changes when minimum requirements are not met.
8. Install required Ubuntu packages.
9. Install/configure the preset runtime.
10. Install or download the preset model.
11. Configure exactly one provider service/model for the machine.
12. Create the systemd service.
13. Enable the service at boot.
14. Start/restart the service as required and load the configured model.
15. Make the HTTP endpoint reachable on the intended LAN interface without public exposure.
16. Verify the configured API endpoint.
17. Perform a minimal inference/health test.
18. Return observable installation and verification evidence.

## Idempotency

The command MUST be idempotent. Re-running it against an already configured target brings the machine to the requested preset/configuration instead of blindly reinstalling components.

## Runtime

Runtime is defined by the selected preset, not command identity. Initial implementation may support `llama.cpp`; additional runtimes such as Ollama may be added without changing the command name.

Hardware-specific acceleration (for example CUDA or ROCm) MUST be selected only when detected and supported by the preset/runtime. The command MUST NOT assume a GPU vendor.

## Service

The provider MUST run as a systemd service rather than requiring an interactive desktop session. Ubuntu Desktop remains a supported host OS.

The service MUST:

- own exactly one configured model in the initial implementation;
- start automatically after reboot;
- load that model as part of provider startup;
- restart according to configured service policy;
- expose the configured HTTP API endpoint to the trusted LAN;
- require no API key by default;
- have observable status and logs through systemd/journald.

## Safety

The command MUST NOT:

- modify an unsupported target;
- modify a machine that fails the selected preset's minimum requirements;
- install ARM64 binaries on the initial AMD64 implementation;
- overwrite SSH configuration unnecessarily;
- expose the provider to the public Internet by default;
- configure router/NAT port forwarding or public tunnels;
- commit or print private SSH keys or credentials;
- report success without endpoint verification.

## Result states

At minimum:

- `SUCCESS`
- `SSH_UNREACHABLE`
- `PRESET_NOT_FOUND`
- `PRESET_NOT_READY`
- `REQUIREMENTS_NOT_MET`
- `UNSUPPORTED_OS`
- `UNSUPPORTED_ARCHITECTURE`
- `RUNTIME_INSTALL_FAILED`
- `MODEL_INSTALL_FAILED`
- `SERVICE_FAILED`
- `VERIFICATION_FAILED`
- `SNAPSHOT_NOT_RUNNABLE`

## Completion

Complete only when the machine has exactly one configured provider/model, the systemd service is enabled and running, the model is loaded, and the trusted-LAN HTTP endpoint passes the configured health/inference verification.