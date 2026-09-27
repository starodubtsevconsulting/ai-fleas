# qwen3-coder-next-q5km through Hermes A2A

The actionable settings are in [qwen3-coder-next-q5km.strategy.yml](qwen3-coder-next-q5km.strategy.yml). This file
records the observations behind them.

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
- Two recognizer assignments created unrequested test/scratch files despite an exact one-file write scope. A correction
  also repeated date and context parsing mistakes. Require concrete input/output examples and explicitly authorize
  any adjacent test file; stop and rescope after one unsuccessful correction instead of repeated long retries.

These are observations from the financial-records and Hermes delegation work in September 2026. They guide the next
assignment; they do not claim that every run or other deployment of the model behaves this way.

## External usage evidence

Qwen's [model card](https://huggingface.co/Qwen/Qwen3-Coder-Next) documents agentic tool use, recommends the
`qwen3_coder` tool-call parser for vLLM/SGLang, and gives sampling defaults of temperature 1.0, top-p 0.95, and
top-k 40. Those are deployment checks, not proof that this local llama.cpp server uses the same settings.
[Hermes's provider guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md)
notes that the effective context must be configured at the serving layer and may be split across parallel slots.
Firsthand [llama.cpp issue reports](https://github.com/ggml-org/llama.cpp/issues/19513) describe occasional premature
end-of-turn behavior with Qwen3-Coder-Next tool calls; another [issue](https://github.com/ggml-org/llama.cpp/issues/20164)
describes tool-call failures under long context. These reports are diagnostic leads only. Check the live backend,
effective context, parser, output cap, and logs before attributing our Coder failures to the model or changing
serving settings. The current endpoint identifies this model as llama.cpp, but its `/v1/models` response does not
report an effective context length.

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
