# Pi CLI agent initialization contract

This is the target lifecycle for a managed Pi agent. The current `pi-agents` command implements `check` and `prepare` for Dev Coder only; it does not implement the controller transaction below or return `CODER_READY`.

## Preflight and preparation

Resolve the exact work profile, workflow, selected logical project, authorized repository root, and effective platform using the normal platform precedence. `pi-cli` must be selected for the Coder being initialized, not merely listed under `platforms.available`. Read the portable Dev roster and role contract without changing their authority. Resolve the profile's explicit Pi model bindings and verify the Pi CLI and required host capabilities. Missing or conflicting selection blocks managed initialization before any session or binding mutation.

`pi-agents check` verifies the configuration. `pi-agents prepare` generates the Pi agent directory, model settings, role instructions, and auxiliary compaction extension. Preparation may also be used when `pi-cli` is only available, for an unmanaged local experiment. The generated directory is configuration, not an identity receipt. It may be reused across Pi sessions; each session still needs its own exact binding.

## Managed instance transaction

Follow the [portable bootstrap contract](../../contract/agent-bootstrap.md):

1. The lifecycle controller validates the requested role, project, caller, canonical sources, selected `pi-cli` platform, and authorized effects.
2. Launch a fresh Pi session with the prepared agent directory and authorized repository working directory. Obtain its runtime-owned, immutable session ID from Pi. Do not derive identity from a path, title, prompt, or process ID.
3. Store a controller-owned **pending** binding for that exact session ID and scope. A directly launched session without that binding remains unbound and read-only with respect to protected workflow operations.
4. Deliver a one-time `INIT` request to that session through Pi's actual input lifecycle. Bind the request to the session ID, expiry, canonical initialization bundle, and expected `CODER_READY` token. Writing a transcript or session file is not delivery.
5. The session verifies its own exact ID and pending binding, reads the current role, scope, project, and repository instructions, and returns the exact readiness token. The controller verifies the token and host session state before atomically activating the binding and routing work.
6. On restart or session switch, restore authority only from an active binding for the exact current session ID and re-read canonical sources. Never carry authority to a different session because it shares `PI_CODING_AGENT_DIR` or working directory.

The controller owns pending and active binding records and disables delivery when a session ends, is replaced, expires, or is deactivated. A successor must be verified and active before replacing an authoritative predecessor when continuity applies. `END`/`STOP` must confirm deactivation and disabled delivery. If Pi cannot expose an exact session ID, deliver a request through its real input lifecycle, or confirm deactivation, report the missing capability and stop the dependent stage.

Pi CLI currently has no implemented AI Fleas controller for this transaction. `prepare`, generated `AGENTS.md`, Pi's ordinary session persistence, and profile model configuration must not be reported as managed `INIT` evidence. Full roster initialization also needs separate, verified mappings for every required Dev role and transport between them.
