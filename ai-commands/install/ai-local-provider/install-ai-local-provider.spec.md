# Install AI Local Provider Specification

## Purpose

`install-ai-local-provider` interactively provisions a remote Ubuntu machine as a self-contained local AI inference provider.

The command is profile-aware. The active profile may preconfigure a shelf/pool of AI machines and connection defaults. A normal user can run the command without arguments, select an existing machine or add a new one, select a model preset, confirm the resolved plan, and let the command provision and verify the provider.

## Status

SNAPSHOT. The command MUST NOT perform installation until implementation and tests are complete.

## Interaction contract

Interactive execution is the default behavior.

When profile command configuration contains known boxes, the command MUST present those boxes plus an `Add new machine` option. It MUST ask only for values that cannot be resolved from CLI input, selected box configuration, profile defaults or preset defaults.

When command configuration is absent, empty or incomplete, the command MUST remain useful. It MUST explain what is missing, what the command does, where profile command configuration belongs, and offer guided next actions such as:

1. add/configure a machine now;
2. show the expected profile configuration/example;
3. exit without changes.

Adding a machine interactively collects at minimum a logical box name, host/IP and SSH user, plus SSH port/key path when needed. The command MUST summarize the resolved connection before attempting provisioning.

The command MUST NOT respond to missing configuration with only a low-level file/path/parser error.

## Profile awareness and multiple boxes

The host activates the selected AI profile/workflow and provides profile-owned command configuration through `AI_COMMAND_CONFIG_PATH` according to the common command contract.

A profile may define multiple named boxes. Each box may contain:

- logical name (map key);
- host/IP;
- SSH user;
- SSH port;
- SSH key path/reference;
- optional default model preset;
- supported machine-specific overrides.

The public repository MUST NOT contain private key contents or passwords. A profile should reference a local key path, SSH agent/configuration, or another supported private credential mechanism.

The committed `install-ai-local-provider.command.example.config` documents the profile-owned shape and is never operational configuration.

## Value resolution

Values MUST resolve with this precedence, highest first:

1. explicit CLI arguments;
2. selected box values from active-profile command configuration;
3. active-profile command defaults;
4. selected committed preset defaults;
5. interactive prompt for still-required values.

Before any target modification, the command MUST display the resolved machine, connection identity, model preset and material installation choices and obtain interactive confirmation unless the invocation uses an explicitly supported non-interactive authorization mode.

## CLI modes

Normal interactive invocation:

```text
install-ai-local-provider.sh
```

Select a preconfigured box while retaining interactive completion/confirmation:

```text
install-ai-local-provider.sh --box mini-02
```

Automation/agent invocation may explicitly provide box/preset or direct target values. CLI values override profile values but do not change the stored profile configuration unless an explicit configuration-write operation is requested.

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

The lifecycle service is installed as `/etc/systemd/system/ai-local-provider.service`. Logs use systemd/journald.

After provisioning, the original install command/host is not required for normal boot and inference operation.

## Privilege model

The target is assumed to be a dedicated AI machine. The SSH installation user MUST have root access or sufficient `sudo` capability to provision machine-level files, packages, users and systemd services.

The inference server MUST NOT run as root. Installation MUST create or use a dedicated unprivileged service account (default `ai-local-provider`) and give that account only the filesystem/device access required to run the provider and acceleration hardware.

## Deployment model

**one machine -> one provider server -> maximum one active model at a time**.

A machine may retain multiple downloaded models under `/opt/ai-local-provider/models/`. The provider loads only one model at a time. The active model can be unloaded and another installed model selected and loaded.

The active/default model is recorded in provider configuration and loaded by systemd on provider/machine startup. Multiple concurrent active models are out of scope for the initial implementation.

## Default API and network contract

The default is a trusted-LAN provider:

- HTTP API;
- no TLS/HTTPS;
- no API key;
- no application-level authentication;
- reachable from the local LAN;
- never exposed to the public Internet by default.

Network isolation is the security boundary. Installation MUST NOT create router/NAT port forwarding, public tunnels or other public exposure.

## Supported platform

Initial implementation supports only Ubuntu 24.04 LTS (Desktop or Server), AMD64/x86_64, provisioned remotely over SSH.

The command MUST verify `uname -m` before target modification. Any value other than `x86_64` fails with `UNSUPPORTED_ARCHITECTURE`. ARM64 is out of scope initially.

## Model presets

Presets live under `presets/` and are selectable by ID. The command MUST present available presets interactively when one is not already resolved.

Selecting a preset includes downloading the actual model weights/artifacts unless a valid matching artifact is already present under `/opt/ai-local-provider/models/`.

Each preset describes/resolves model source/artifact, quantization, context, runtime, supported OS/architecture, memory/disk/GPU requirements and service/API defaults.

Before modification, detected machine capabilities MUST be compared with minimum/recommended preset requirements. Minimum failures block with `REQUIREMENTS_NOT_MET`; recommendations are advisory. Unresolved required preset values return `PRESET_NOT_READY`.

## Required behavior

The command MUST:

1. load active-profile command configuration if available;
2. resolve/select an existing box or interactively collect a new target;
3. resolve/select and validate the model preset;
4. resolve remaining values using the defined precedence;
5. show the resolved plan and obtain required confirmation;
6. verify SSH connectivity and required sudo/root provisioning capability;
7. detect OS, architecture, CPU, memory, free disk and GPU without modifying the target;
8. validate platform and preset minimum requirements;
9. create/update the dedicated unprivileged provider service account;
10. reconcile `/opt/ai-local-provider/` directories and permissions;
11. install required Ubuntu packages;
12. install/configure the preset runtime under `/opt/ai-local-provider/runtime/`;
13. download and verify the selected model under `/opt/ai-local-provider/models/`, reusing a valid matching artifact;
14. preserve other installed models unless explicitly asked to remove them;
15. configure no more than one active model and record the selected active/default model;
16. create/update the systemd service to run as the unprivileged provider account;
17. enable the service at boot;
18. launch it immediately and load the configured active model;
19. wait for model/provider readiness;
20. expose the HTTP endpoint to the intended trusted LAN without public exposure;
21. verify HTTP response;
22. perform a real minimal inference request;
23. validate a structurally valid non-empty response;
24. return `SUCCESS` only after all verification gates pass;
25. return observable installation/verification evidence.

## Post-install verification gate

Installation is not complete when files/packages are merely present.

**install provider -> download model -> configure -> launch -> load model -> verify HTTP -> run inference -> validate response -> success**

`SUCCESS` requires an active systemd service under the intended unprivileged account, loaded/ready model, responding HTTP endpoint and successful real inference.

## Model switching

The machine may retain multiple installed models. Switching means stop/unload current model, select another installed model/preset, update `/opt/ai-local-provider/config/active-model.yml`, start/load it and verify HTTP/inference. No more than one model may intentionally be active concurrently.

## Idempotency

Re-running reconciles the target with requested configuration. Valid runtimes/models are reused rather than blindly reinstalled/downloaded.

## Runtime and service

The initial runtime may be `llama.cpp`, installed under `/opt/ai-local-provider/runtime/llama.cpp/`, with `llama-server` as the provider process. Additional runtimes may be added later.

The systemd service runs as the dedicated unprivileged provider account, starts automatically, loads the configured active/default model, exposes trusted-LAN HTTP without an API key by default, and logs through journald.

Hardware-specific acceleration such as CUDA or ROCm is selected only when detected and supported. The command MUST NOT assume a GPU vendor.

## Safety

The command MUST NOT modify an unsupported target, proceed without required provisioning privileges, run inference as root, proceed when preset minimum requirements fail, install ARM64 binaries in the initial implementation, unnecessarily overwrite SSH configuration, expose the provider publicly by default, create public tunnels/NAT forwarding, commit/print private credentials, or report success without endpoint and inference verification.

## Result states

At minimum:

- `SUCCESS`
- `CONFIGURATION_REQUIRED`
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
- `CANCELLED`
- `SNAPSHOT_NOT_RUNNABLE`

## Completion

Complete only when the selected machine is independently provisioned under `/opt/ai-local-provider/`, the selected model is present/verified, no more than one model is active, systemd is enabled/running as the unprivileged provider account, the model is ready, the trusted-LAN HTTP endpoint responds and real inference succeeds.