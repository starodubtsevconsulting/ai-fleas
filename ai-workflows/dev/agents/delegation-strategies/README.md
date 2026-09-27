# Coder handoff strategies

Admin selects one strategy per bounded Coder assignment. Every packet states the outcome, verified project and branch,
allowed write roots, allowed read-only reference roots, starting files, governing contract, excluded effects, completion
evidence, and a stop condition. Starting files are leads, not a complete inventory. Coder may investigate within the
read scope and iterate on its own implementation within the write scope; Admin waits for the declared result or blocker
instead of approving each small step.

Before selection, resolve the workflow's configured local model and any registered
[model profile](model-profiles/README.md). Apply its default for that exact model and transport, or record why the task
needs another strategy. Model observations refine the packet and checks; they do not replace these strategy rules.

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
