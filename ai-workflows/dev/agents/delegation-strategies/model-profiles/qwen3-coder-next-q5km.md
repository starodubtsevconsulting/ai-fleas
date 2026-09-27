# qwen3-coder-next-q5km through Hermes A2A

Applies when the configured `provider_model` is exactly `qwen3-coder-next-q5km` and the selected delegate uses
Hermes A2A. Review this profile if either value changes.

## Observed behavior

- Several bounded requests took close to or beyond the A2A server's roughly five-minute per-message limit. A client
  `fetch failed` result did not prove that the remote task had stopped; task status and visible files needed inspection.
- The Coder correctly copied small source modules after a narrowly specified correction, but one file was initially
  written at the directory path instead of the requested file path.
- In a launcher change, it confused the launcher's assignment argument with the internal A2A client's stdin contract.
  Its added tests initially passed while one had no assertion; a later correction broke existing tests.
- Completion text was sometimes more confident than the actual file state. The visible diff and independent checks
  were more reliable evidence.

These are observations from the financial-records and Hermes delegation work in September 2026. They guide the next
assignment; they do not claim that every run or other deployment of the model behaves this way.

## Default handoff

Use [focused implementation](../focused-implementation.md) for one cohesive, reviewable change. Give the exact
output file path, the nearest source and contract, the existing interface that must remain intact, allowed read and
write roots, exclusions, and a concrete stop condition. For a port, state the expected source-to-target comparison.
If the code path is unknown, use read-only discovery first, then send a focused implementation packet once scope is
known. Use [bounded exploration](../bounded-exploration.md) only when the transitive code path truly requires it and
the stage fits the transport's verified limit.

For launcher or protocol changes, spell out both sides of the command boundary with example invocations and where
each input is read (argument or stdin). Require the Coder to inspect existing callers and tests before editing. Ask
for concise changed-file and blocker evidence; do not rely on a prose claim of completion.

Admin waits for the real task result. On timeout or disconnect, inspect the A2A task state and visible diff before any
retry. Command Runner runs focused existing and new tests, plus shell syntax checks where applicable. Admin reviews
whether tests actually assert the contract. Do not accept a change that breaks the delegate launcher; restore the last
working version if routing becomes unusable and report the blocked Coder stage.

The current launcher starts a new A2A context for each run. The adapter can resume a context, but the launcher has
no accepted `--context-id` route yet. Do not describe separate runs as one persistent Coder session. Do not choose
[goal-backed continuation](../goal-backed-continuation.md) until persistent goals, status, and resume are verified
through this delegate route.
