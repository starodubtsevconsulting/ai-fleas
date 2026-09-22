# Flow contracts

A flow is a bounded path inside a workflow. It reuses existing roles and commands without adding authority.
Use the [flow template](flow.template.md); load only applicable flows.
The workflow-scoped [Router runtime](../runtime/workflow-router.md) may execute declared flow transitions. The flow remains
the authoritative program; the Router interprets it and does not acquire an assigned role's judgment.

A flow states:

- **Purpose:** parent workflow, outcome, and when it applies.
- **Entry:** scope, inputs, and prerequisite evidence.
- **Steps:** ordered objectives, one accountable owner and expected proof per step; link to existing mechanics.
- **Exit:** completion proof, failure/recovery action, and the parent checkpoint to resume.

## Evidence and recovery

Record required gates as pending, passed with evidence, not applicable with a reason, or blocked with an owner/next action.
Proof identifies its actual executor, relevant revision/artifact and environment, and terminal check or observed behavior.
Partial, unknown, different-candidate output or a successful process exit alone cannot prove required behavior.
Reuse valid proof; repeat failed or invalidated gates. Preserve completed evidence and the first unfinished step.
Material plan changes return to planning; storage and external synchronization follow existing workflow/profile contracts.
