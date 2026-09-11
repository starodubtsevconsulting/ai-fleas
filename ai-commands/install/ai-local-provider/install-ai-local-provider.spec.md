# Install AI Local Provider Specification

## Purpose

`install-ai-local-provider` provisions a remote Ubuntu machine as a reusable local AI inference provider.

The user selects a model preset. A preset defines the model/runtime defaults and the machine requirements for that model. Machine-specific connection details remain profile-owned configuration.

## Status

SNAPSHOT. The command MUST NOT perform installation until implementation and tests are complete.

## Initial deployment model

The initial contract is intentionally simple:

**one machine -> one provider server -> maximum one active model at a time**.

A machine may have multiple model files/presets installed. The provider process loads only one model at a time. The active model can be unloaded and another installed model can then be selected and loaded.

The selected active/default model is loaded when the provider starts. The provider is managed by systemd and starts automatically with the machine. On reboot, the currently configured default model is loaded.

Running multiple models concurrently from the same provider is out of scope for the initial implementation.

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
10. Install or download the selected model without requiring other installed models to be deleted.
11. Configure the provider so no more than one model can be active at a time.
12. Set the selected model as active/default when requested by the installation operation.
13. Create/update the systemd service.
14. Enable the service at boot.
15. Launch the service immediately as part of installation and load only the configured active model.
16. Wait for the provider/model to become ready or fail with evidence.
17. Make the HTTP endpoint reachable on the intended LAN interface without public exposure.
18. Verify that the HTTP endpoint responds.
19. Send a minimal real inference request to the active model.
20. Validate that the inference response is structurally valid and non-empty.
21. Return `SUCCESS` only after service, model, HTTP and inference verification all pass.
22. Return observable installation and verification evidence.

## Post-install verification gate

Installation is not complete when files/packages are merely present.

The command MUST finish with the provider running and ready for requests. The mandatory verification sequence is:

**install -> configure -> launch service -> load model -> verify HTTP -> run inference -> validate response -> success**.

`SUCCESS` MUST NOT be returned unless all of the following are observable:

- the systemd service is active;
- the selected model is loaded and ready;
- the configured HTTP endpoint responds;
- a real minimal inference request completes successfully;
- the inference response is valid and non-empty.

Any failure in this gate MUST return a non-success result and include enough service/journal/API evidence to diagnose the failure.

## Model switching

The machine MAY retain multiple installed models.

Switching models means:

1. stop/unload the current active model;
2. select another installed model/preset;
3. update the active/default model configuration;
4. start/load the selected model;
5. verify the API and inference result.

At no point may the initial provider intentionally keep two models active concurrently. Model switching may be exposed by a dedicated command or lifecycle operation later; this install command only establishes the required provider semantics.

## Idempotency

The command MUST be idempotent. Re-running it against an already configured target brings the machine to the requested preset/configuration instead of blindly reinstalling components.

## Runtime

Runtime is defined by the selected preset, not command identity. Initial implementation may support `llama.cpp`; additional runtimes such as Ollama may be added without changing the command name.

Hardware-specific acceleration (for example CUDA or ROCm) MUST be selected only when detected and supported by the preset/runtime. The command MUST NOT assume a GPU vendor.

## Service

The provider MUST run as a systemd service rather than requiring an interactive desktop session. Ubuntu Desktop remains a supported host OS.

The service MUST:

- run no more than one active model at a time;
- start automatically after reboot;
- load the configured active/default model as part of provider startup;
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
- report success without endpoint and inference verification.

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
- `MODEL_NOT_READY`
- `HTTP_VERIFICATION_FAILED`
- `INFERENCE_VERIFICATION_FAILED`
- `VERIFICATION_FAILED`
- `SNAPSHOT_NOT_RUNNABLE`

## Completion

Complete only when the provider has no more than one active model, the selected default model is configured, the systemd service is enabled and running, that model is loaded and ready, the trusted-LAN HTTP endpoint responds, and a real minimal inference request succeeds with a valid non-empty response.