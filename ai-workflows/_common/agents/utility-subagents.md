# Utility subagents

A utility helper is not a workflow Agent. Use one only when the human or workflow authorizes it.

## Utility subagents can

- Process one bounded read-only evidence task, such as extraction, reference checks, or factual comparison.
- Receive only relevant inputs within the caller’s scope, an expected output, effect limits, and a stop condition.
- Return supporting evidence to the caller, who verifies it and retains decisions and completion responsibility.
- Inherit model selection unless an explicit supported platform/profile binding selects another model.

## Utility subagents cannot

- Mutate repository or external state, receive unnecessary secrets/private configuration, or communicate with workflow Agents.
- Replace a workflow role, issue its receipts, approve work, select plan steps, or advance gates.
- Spawn helpers, schedule work, duplicate an assigned Agent’s task, or merely poll unchanged state; use native waiting for I/O.
- Exceed configured/platform concurrency or claim unverified model selection, cost savings, or independent acceptance.
