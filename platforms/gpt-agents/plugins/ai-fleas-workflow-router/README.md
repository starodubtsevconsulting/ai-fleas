# AI Fleas Workflow Router plugin

This Codex plugin supplies workflow-neutral lifecycle hooks for exact, receipt-bound AI Fleas role tasks.

- `SessionStart` and `UserPromptSubmit` load the task's trusted binding into developer context.
- `Stop` requires a valid `WORKFLOW_ROUTER_RESULT` and gives the endpoint one bounded continuation to correct it.
- Unregistered Codex tasks are ignored.
- Endpoint bindings contain workflow coordinates, role, capabilities, and an authoritative workflow reference; they never contain peer task IDs.
- The separate host-only workflow registry contains executable transitions and exact role-to-task resolution.
- After validating a result, `Stop` resolves the declared successor and starts an asynchronous resume worker. A receipt
  remains `pending` until the exact target task emits `thread.started` followed by `turn.started`; only then is delivery
  recorded as started. Completion and failure are recorded separately, and dispatch receipts make retries idempotent.
- A workflow transition may declare a progress-reference retry policy. The Router counts attempts for the same bounded
  progress references and stops visibly at the declared ceiling instead of creating an endpoint loop.

The plugin is a host adapter, not the authoritative workflow definition. Transitions remain owned by the selected `*.workflow.md`; the initializer registers its executable projection with `scripts/register-workflow.mjs` and each exact task binding with `scripts/register-binding.mjs`.

The lookup is deterministic: `(current stage, endpoint event) -> next stage -> declared role -> exact registered task`.
The plugin contains no Writing-specific `Reviewer -> Writer` rule.

The adapter uses `codex exec resume` rather than `codex queue`, because queue acceptance does not wake an idle desktop
task and is not proof of delivery. The resume worker verifies the exact resumed task and observes `turn.started` before
promoting its pending receipt. Cross-endpoint references must resolve to durable artifacts; conversation-only reports
and synthetic identifiers are not transferable evidence.
