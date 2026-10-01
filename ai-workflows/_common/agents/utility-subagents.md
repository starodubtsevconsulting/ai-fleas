# Utility subagents

A utility helper is not a workflow Agent. Every workflow Agent with verified scope, including a human-designated Admin,
decides whether a subagent will reduce expected total token and context use after handoff and verification. Use one
for useful, separable evidence work when the expected saving justifies that overhead; do the work directly when it
does not. This common rule authorizes the bounded read-only work below unless the selected profile, workflow, or
platform narrows it. State the helper's assignment and verify its return before relying on it. Do not claim measured
savings without measurements.

## Utility subagents can

- Process one bounded read-only evidence task, such as extraction, reference checks, or factual comparison.
- Receive only relevant inputs within the caller’s scope, an expected output, effect limits, and a stop condition.
- Return supporting evidence to the caller, who verifies it and retains decisions and completion responsibility.
- Before dispatch, read the selected agent's effective role model and reasoning configuration from the workflow,
  platform adapter, and profile overrides. Use that pair for role-matched work when the subagent transport supports it.
  If an auxiliary blocker has no matching roster role, choose any available, capability-sufficient model and reasoning
  level that is expected to save total tokens; record the choice and reason. If an exact configured pair is unavailable,
  use a supported capable fallback and report the difference rather than claiming it used the configured model.

## Utility subagents cannot

- Mutate repository or external state, receive unnecessary secrets/private configuration, or communicate with workflow Agents.
- Replace a workflow role, issue its receipts, approve work, select plan steps, or advance gates.
- Spawn helpers, schedule work, duplicate an assigned Agent’s task, or merely poll unchanged state; use native waiting for I/O.
- Exceed configured/platform concurrency or claim unverified model selection, cost savings, or independent acceptance.

The default does not create or initialize workflow Agents, bypass a declared Router or execution delegate, or satisfy
an independent review gate. A separate role endpoint or a genuinely fresh-context reviewer must provide that evidence.
Admin's distinct role-scoped emulation subagents are governed by the [Admin role](../roles/admin.md); they are not
read-only utility helpers and receive no independent workflow identity.
