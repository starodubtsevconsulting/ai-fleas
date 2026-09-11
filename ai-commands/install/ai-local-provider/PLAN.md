# AI Local Provider installation plan

This is the human-readable contract followed by `install ai-local-provider`.
Every executable step prints the same stable ID. `verify-plan-sync.sh` fails when
the ordered IDs here and in the implementation differ. Reruns reconcile or reuse
already-valid results.

Every invocation streams the same output to the terminal and a timestamped local
log under `ai-commands/install/ai-local-provider/logs/`. The path is printed before the first step;
sudo password input is handled by the terminal and is never written to the log.

<!-- PLAN_STEP: AI-LOCAL-01 -->
## AI-LOCAL-01 — Resolve configuration

Resolve the profile, named machine, SSH identity, storage, preset, network, and
service settings. Never store passwords or secrets in the repository.

<!-- PLAN_STEP: AI-LOCAL-02 -->
## AI-LOCAL-02 — Verify SSH access

Verify strict host identity and public-key authentication. Stop with safe
onboarding guidance when authorization is missing.

<!-- PLAN_STEP: AI-LOCAL-03 -->
## AI-LOCAL-03 — Qualify the machine and plan

Inventory Ubuntu, architecture, CPU, RAM, GPU/driver, and both storage locations.
Reject incompatibility or insufficient capacity and report dependencies that the
install action will supply.

<!-- PLAN_STEP: AI-LOCAL-04 -->
## AI-LOCAL-04 — Clean disposable system data

Apply OS temporary-file expiry, bounded journal retention, package-cache cleanup,
and stale command-owned partial-download cleanup. Never delete Downloads,
personal data, arbitrary home caches/backups, or unrelated application data.

<!-- PLAN_STEP: AI-LOCAL-05 -->
## AI-LOCAL-05 — Install native CUDA dependencies

Install the compiler, CMake, CUDA Toolkit, and supporting packages. If the NVIDIA
driver is absent, install the recommended driver and stop clearly for a reboot.

<!-- PLAN_STEP: AI-LOCAL-06 -->
## AI-LOCAL-06 — Build the pinned runtime

Fetch and verify the exact reviewed `llama.cpp` revision, compile native CUDA
`llama-server`, and install it under `/opt`.

<!-- PLAN_STEP: AI-LOCAL-07 -->
## AI-LOCAL-07 — Acquire and verify the model

Reuse only a checksum-valid artifact. Otherwise resume/download the pinned model,
verify SHA-256, and publish it atomically on the selected volume.

<!-- PLAN_STEP: AI-LOCAL-08 -->
## AI-LOCAL-08 — Reconcile the service

Create an unprivileged identity, install the native systemd unit, and enable and
start the provider.

<!-- PLAN_STEP: AI-LOCAL-09 -->
## AI-LOCAL-09 — Verify the result

Verify provider health and a real chat-completion response. Report success only
after both checks pass.
