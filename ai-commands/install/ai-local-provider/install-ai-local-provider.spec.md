# Install AI Local Provider Specification

## Purpose

`install-ai-local-provider` provisions a remote Ubuntu machine as a reusable local AI inference provider.

The command is model-independent. Runtime, model, context size, port, and related settings are configuration.

## Status

SNAPSHOT. The command MUST NOT perform installation until implementation and tests are complete.

## Supported platform

Initial implementation supports only:

- Ubuntu 24.04 LTS (Desktop or Server)
- AMD64 / x86_64 architecture
- remote access over SSH

The command MUST verify the remote architecture with `uname -m` before making changes. Any value other than `x86_64` MUST fail with `UNSUPPORTED_ARCHITECTURE`.

ARM64 is explicitly out of scope for the initial implementation.

## Inputs

- SSH target (`user@host`)
- optional SSH port / identity supplied by profile-owned configuration
- provider runtime
- model source and model file/identifier
- context size
- API listen address and port
- service name

Secrets and machine-specific credentials MUST NOT be committed to this repository.

## Required behavior

The command MUST:

1. Verify SSH connectivity.
2. Detect the remote OS and architecture without changing the target.
3. Refuse unsupported OS/architecture before installation.
4. Detect available CPU, memory and GPU hardware.
5. Install required Ubuntu packages.
6. Install/configure the selected model runtime.
7. Install or download the configured model.
8. Create a systemd service for the provider.
9. Enable the service at boot.
10. Start/restart the service as required.
11. Verify the configured API endpoint.
12. Perform a minimal inference/health test.
13. Return observable installation and verification evidence.

## Idempotency

The command MUST be idempotent. Re-running it against an already configured target brings the machine to the requested configuration instead of blindly reinstalling components.

## Runtime

The runtime is configuration, not command identity. Initial implementation may support `llama.cpp`; additional runtimes such as Ollama may be added without changing the command name.

Hardware-specific acceleration (for example CUDA or ROCm) MUST be selected only when detected and supported. The command MUST NOT assume a GPU vendor.

## Service

The provider MUST run as a systemd service rather than requiring an interactive desktop session. Ubuntu Desktop remains a supported host OS.

The service MUST:

- start automatically after reboot;
- restart according to configured service policy;
- expose the configured local API endpoint;
- have observable status and logs through systemd/journald.

## Safety

The command MUST NOT:

- modify an unsupported target;
- install ARM64 binaries on the initial AMD64 implementation;
- overwrite SSH configuration unnecessarily;
- expose the provider publicly by default;
- commit or print private SSH keys or credentials;
- report success without endpoint verification.

## Result states

At minimum:

- `SUCCESS`
- `SSH_UNREACHABLE`
- `UNSUPPORTED_OS`
- `UNSUPPORTED_ARCHITECTURE`
- `RUNTIME_INSTALL_FAILED`
- `MODEL_INSTALL_FAILED`
- `SERVICE_FAILED`
- `VERIFICATION_FAILED`
- `SNAPSHOT_NOT_RUNNABLE`

## Completion

Complete only when the remote provider service is enabled, running, reachable at its configured endpoint, and passes the configured health/inference verification.