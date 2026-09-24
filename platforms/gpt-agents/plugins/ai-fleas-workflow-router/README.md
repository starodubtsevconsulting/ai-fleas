# AI Fleas Workflow Router plugin

This Codex plugin supplies workflow-neutral lifecycle hooks for exact, receipt-bound AI Fleas role tasks.

- `SessionStart` and `UserPromptSubmit` load the task's trusted binding into developer context.
- `Stop` requires a valid `WORKFLOW_ROUTER_RESULT` and gives the endpoint one bounded continuation to correct it.
- Unregistered Codex tasks are ignored.
- Endpoint bindings contain workflow coordinates, role, capabilities, and an authoritative workflow reference; they never contain peer task IDs.
- The separate host-only workflow registry contains executable transitions and exact role-to-task resolution.
- After validating a result, `Stop` resolves the declared successor and starts an asynchronous dispatch worker. The
  worker queues the packet through the existing Codex app-server task owner and records whether that queue accepted or
  rejected it. Before queueing, the worker creates a one-shot permit bound to the exact destination task, packet prompt
  digest, correlation, stage, role, and expiry. The destination consumes that permit and preserves the workflow
  correlation; Router-looking prompt text without the permit remains ordinary ingress. Dispatch receipts make retries
  idempotent.
- A workflow transition may declare a progress-reference retry policy. The Router counts attempts for the same bounded
  progress references and stops visibly at the declared ceiling instead of creating an endpoint loop.

The plugin is a host adapter, not the authoritative workflow definition. Transitions remain owned by the selected `*.workflow.md`; the initializer registers its executable projection with `scripts/register-workflow.mjs` and each exact task binding with `scripts/register-binding.mjs`.

The lookup is deterministic: `(current stage, endpoint event) -> next stage -> declared role -> exact registered task`.
The plugin contains no Writing-specific `Reviewer -> Writer` rule.

Initialization or reactivation of an already bound endpoint uses `scripts/queue-lifecycle-control.mjs`. It atomically
registers the prompt-bound permit and delivers the prompt through daemon-backed `codex queue`, so the existing desktop
task owner runs `UserPromptSubmit`. The resulting one-shot permit is bound to the exact session, prompt digest, action,
expiry, and expected readiness token. Only that matching turn bypasses ordinary Router ingress/result enforcement;
prompt text by itself cannot request a bypass.

The adapter uses the daemon-backed `codex queue` command so delivery goes through the existing desktop task owner. It
must not use `codex exec resume`: that starts a second writer for a desktop-owned task and fails with a thread-store
conflict. Queue acceptance is recorded as `queued`, not as completed execution. Cross-endpoint references must resolve
to durable artifacts; conversation-only reports and synthetic identifiers are not transferable evidence.

## Architecture and development contract

See [Architecture](docs/architecture.md) for:

- the portable mechanical workflow contract;
- the Codex-specific hook and delivery adapter;
- sequence and component diagrams;
- queue and receipt semantics;
- invariants that changes must preserve; and
- the regression checklist for plugin development.
