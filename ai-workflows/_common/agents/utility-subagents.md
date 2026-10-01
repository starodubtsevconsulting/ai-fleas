# Utility subagents

A subagent is not a workflow Agent. Every agent with verified scope may delegate a bounded, separable task, including
long-running work, when the expected token and context saving justifies handoff and verification. The parent decides
which work to delegate and which to do directly. This common rule permits work within the parent's actual role,
project, and effect authority unless the selected profile, workflow, configured execution route, or platform narrows
it. State the subagent's assignment, allowed effects, evidence, and stop condition; verify its result before relying
on it. Do not claim measured savings without measurements.

## Utility subagents can

- Process one bounded role-owned task, such as evidence extraction, drafting, implementation, review preparation, or a
  long-running investigation, only when the parent may perform it and the selected transport enforces its effect scope.
- Receive only relevant inputs within the caller’s scope, an expected output, effect limits, and a stop condition.
- Return supporting evidence to the caller, who verifies it and retains decisions and completion responsibility.
- Before dispatch, read the selected agent's effective role model and reasoning configuration from the workflow,
  platform adapter, and profile overrides. Use that pair for role-matched work when the subagent transport supports it.
  If an auxiliary blocker has no matching roster role, choose any available, capability-sufficient model and reasoning
  level that is expected to save total tokens; record the choice and reason. If an exact configured pair is unavailable,
  use a supported capable fallback and report the difference rather than claiming it used the configured model.

## Utility subagents cannot

- Mutate outside its parent's exact authority or assigned effects, receive unnecessary secrets/private configuration,
  or communicate with workflow Agents.
- Replace a workflow role, issue its receipts, approve work, select plan steps, or advance gates.
- Spawn helpers unless the parent explicitly authorizes a bounded nested handoff within platform concurrency, schedule
  work, duplicate another Agent’s assigned task, or merely poll unchanged state; use native waiting for I/O.
- Exceed configured/platform concurrency or claim unverified model selection, cost savings, or independent acceptance.

Delegation does not create or initialize workflow Agents, bypass a declared Router or execution delegate, or satisfy
an independent review gate. A separate role endpoint or a genuinely fresh-context reviewer must provide that evidence.
Admin's role-scoped emulation subagents also follow the [Admin role](../roles/admin.md); they receive no independent
workflow identity.
