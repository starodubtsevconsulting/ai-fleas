# Install AI Local Provider Specification

## Purpose

`install-ai-local-provider` provisions a remote Ubuntu machine as a self-contained local AI inference provider.

The install command is a machine provisioner. It connects over SSH, installs the AI Local Provider onto the target, downloads the selected model, launches it, verifies inference, and leaves the target independently runnable after installation.

The user selects a model preset. A preset defines the model/runtime defaults and the machine requirements for that model. Machine-specific connection details remain profile-owned configuration.

## Status

SNAPSHOT. The command MUST NOT perform installation until implementation and tests are complete.

## Installed component

The target receives a machine-level AI Local Provider installation under:

```text
/opt/ai-local-provider/
├── runtime/
│   └── llama.cpp/
│       └── bin/
│           └── llama-server
├── models/
│   ├── <model-a>/
│   └── <model-b>/
└── config/
    └── active-model.yml
```

The lifecycle service is installed separately as:

```text
/etc/systemd/system/ai-local-provider.service
```

Logs use systemd/journald rather than a separate provider log directory.

The provider installation is self-contained: after provisioning, the original install command/host is not required for normal boot and inference operation.

## Privilege model

The target is assumed to be a dedicated AI machine. The SSH installation user MUST have root access or passwordless/interactive `sudo` sufficient to provision machine-level files, packages, users and systemd services.

The inference server MUST NOT run as root. Installation MUST create or use a dedicated unprivileged service account (default `ai-local-provider`) and give that account only the filesystem/device access required to run the provider and access acceleration hardware.

Root/sudo privileges are for provisioning; normal inference execution is unprivileged.

## Initial deployment model

**one machine -> one provider server -> maximum one active model at a time**.

A machine may have multiple downloaded models under `/opt/ai-local-provider/models/`. The provider process loads only one model at a time. The active model can be unloaded and another installed model can then be selected and loaded.

The selected active/default model is recorded in provider configuration and loaded when the provider starts. The provider is managed by systemd and starts automatically with the machine. On reboot, the currently configured default model is loaded.

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

Each preset MUST describe or resolve the model artifact required for installation. Selecting a preset means the command downloads the actual model weights/artifacts unless a valid matching artifact is already present in `/opt/ai-local-provider/models/`.

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

Before making changes, the command MUST inspect the target and compare detected capabilities with the selected preset. Minimum requirements are blocking. Recommended requirements are advisory.

A failed requirement check MUST return `REQUIREMENTS_NOT_MET` and identify the failed requirements. A preset containing unresolved required values MUST return `PRESET_NOT_READY`.

## Required behavior

The command MUST:

1. Resolve and validate the selected preset.
2. Verify SSH connectivity and required sudo/root provisioning capability.
3. Detect the remote OS and architecture without changing the target.
4. Refuse unsupported OS/architecture before installation.
5. Detect available CPU, memory, free disk and GPU hardware.
6. Compare the machine against the preset requirements.
7. Stop before changes when minimum requirements are not met.
8. Create/update the dedicated unprivileged provider service account.
9. Create/reconcile `/opt/ai-local-provider/` and its runtime, models and config directories with appropriate ownership/permissions.
10. Install required Ubuntu packages.
11. Install/configure the preset runtime under `/opt/ai-local-provider/runtime/` (initially `llama.cpp` / `llama-server`).
12. Download and verify the selected model under `/opt/ai-local-provider/models/`, reusing an already valid matching artifact.
13. Preserve other installed models unless explicitly asked to remove them.
14. Configure the provider so no more than one model can be active at a time.
15. Record/set the selected model as active/default when requested by installation.
16. Create/update `/etc/systemd/system/ai-local-provider.service` to run as the unprivileged provider account.
17. Enable the service at boot.
18. Launch the service immediately as part of installation and load only the configured active model.
19. Wait for the provider/model to become ready or fail with evidence.
20. Make the HTTP endpoint reachable on the intended LAN interface without public exposure.
21. Verify that the HTTP endpoint responds.
22. Send a minimal real inference request to the active model.
23. Validate that the inference response is structurally valid and non-empty.
24. Return `SUCCESS` only after service, model, HTTP and inference verification all pass.
25. Return observable installation and verification evidence.

## Post-install verification gate

Installation is not complete when files/packages are merely present.

The mandatory verification sequence is:

**install provider -> download model -> configure -> launch service -> load model -> verify HTTP -> run inference -> validate response -> success**.

`SUCCESS` MUST NOT be returned unless the systemd service is active under the intended unprivileged account, the selected model is loaded and ready, the HTTP endpoint responds, and a real minimal inference request returns a valid non-empty response.

Any failure MUST return a non-success result and include enough systemd/journal/API evidence to diagnose it.

## Model switching

The machine MAY retain multiple installed models.

Switching models means:

1. stop/unload the current active model;
2. select another installed model/preset;
3. update `/opt/ai-local-provider/config/active-model.yml`;
4. start/load the selected model;
5. verify the API and inference result.

At no point may the initial provider intentionally keep two models active concurrently. Model switching may be exposed by a dedicated command or lifecycle operation later; this install command establishes the provider semantics.

## Idempotency

The command MUST be idempotent. Re-running it reconciles the target with the requested preset/configuration. Valid runtimes/models MUST be reused rather than blindly downloaded/reinstalled.

## Runtime

Runtime is defined by the selected preset, not command identity. The initial runtime may be `llama.cpp`, installed under `/opt/ai-local-provider/runtime/llama.cpp/`, with `llama-server` used as the provider process.

Additional runtimes may be added later without changing the command name.

Hardware-specific acceleration (for example CUDA or ROCm) MUST be selected only when detected and supported by the preset/runtime. The command MUST NOT assume a GPU vendor.

## Service

The provider MUST run as a systemd service rather than requiring an interactive desktop session. Ubuntu Desktop remains a supported host OS.

The service MUST:

- run as the dedicated unprivileged provider account, never root;
- run no more than one active model at a time;
- start automatically after reboot;
- load the configured active/default model as part of provider startup;
- restart according to configured service policy;
- expose the configured HTTP API endpoint to the trusted LAN;
- require no API key by default;
- write operational logs to systemd/journald.

## Safety

The command MUST NOT:

- modify an unsupported target;
- proceed without required provisioning privileges;
- run the inference server as root;
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
- `INSUFFICIENT_PRIVILEGES`
- `PRESET_NOT_FOUND`
- `PRESET_NOT_READY`
- `REQUIREMENTS_NOT_MET`
- `UNSUPPORTED_OS`
- `UNSUPPORTED_ARCHITECTURE`
- `RUNTIME_INSTALL_FAILED`
- `MODEL_DOWNLOAD_FAILED`
- `MODEL_VERIFICATION_FAILED`
- `SERVICE_FAILED`
- `MODEL_NOT_READY`
- `HTTP_VERIFICATION_FAILED`
- `INFERENCE_VERIFICATION_FAILED`
- `VERIFICATION_FAILED`
- `SNAPSHOT_NOT_RUNNABLE`

## Completion

Complete only when the AI Local Provider is independently installed under `/opt/ai-local-provider/`, the selected model artifact is present and verified, no more than one model is active, the systemd service is enabled and running as the unprivileged provider account, the model is loaded and ready, the trusted-LAN HTTP endpoint responds, and a real minimal inference request succeeds with a valid non-empty response.