# Coder handoff strategies

Admin selects one strategy per bounded Coder assignment. Every packet states the outcome, verified project and branch,
allowed write roots, allowed read-only reference roots, starting files, governing contract, excluded effects, completion
evidence, and a stop condition. Starting files are leads, not a complete inventory. Coder may investigate within the
read scope and iterate on its own implementation within the write scope; Admin waits for the declared result or blocker
instead of approving each small step.

Before selection, resolve the workflow's configured local model and any registered
[strategy config](model-profiles/README.md). Apply its route for that exact model and transport, or record why the task
needs another strategy. Its evidence notes explain the settings; they do not replace the config or these strategy rules.

The execution delegate selects its Hermes transport through `transport` in the profile's `gpt-agents` command config.
When a GPT coordinator operates this delegate from outside the Hermes workflow, use the
[external coordinator contract](../../../../ai-commands/system/hermes-agents/external-coordinator.md) for transport
lifecycle calls. Its direct adapter operations take precedence over internal Router handoffs for that external
transport control; they do not change workflow role ownership or project authorization.
Use `cli-oneshot` with [its transport strategy](transports/hermes-cli-oneshot.strategy.yml) for one bounded process per
assignment, or `a2a` with [its transport strategy](transports/hermes-a2a.strategy.yml) for protocol task IDs and future
session-oriented use. Change `strategy_transport_config` to match the selected transport. The model strategy remains
the same. Run the launcher `check --project ID` after switching and use the same launcher `run --project ID` for the
assignment; do not bypass the configured route. A CLI `check` currently validates the binding but does not prove an
inference turn can complete. A2A status does not prove its gateway turn has stopped after a timeout. Independently
inspect files and the active process/session before retrying either route.

- [Focused implementation](focused-implementation.md): the code path and expected change are known.
- [Bounded exploration and implementation](bounded-exploration.md): Coder must trace related code before editing.
- [Goal-backed continuation](goal-backed-continuation.md): several Coder turns are useful and the transport has a
  verified persistent goal and task-status mechanism.

Use read-only discovery before implementation when the write scope or required behavior is uncertain. A strategy never
grants new file authority or transfers testing, review, or acceptance ownership to Coder. Check the launcher's actual
restrictions before dispatch. If transport fails, inspect the task state and visible diff before considering a retry.

Use this compact packet shape; omit fields that do not apply, rather than adding a long repository tour:

```text
Strategy and outcome:
Project, branch, and allowed write roots:
Allowed read-only reference roots and starting files:
Behavior to preserve, constraints, and explicit exclusions:
Internal iteration: investigate, edit, inspect the diff, and retry within scope before reporting.
Completion evidence and checks owned by another role:
Stop and report when: outcome met, scope/design blocker, or transport budget reached.
```
