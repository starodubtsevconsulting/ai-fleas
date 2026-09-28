# qwen3-coder-next-q5km through Hermes

The actionable settings are in [qwen3-coder-next-q5km.strategy.yml](qwen3-coder-next-q5km.strategy.yml). This file
records the observations behind them.

Applies when the configured `provider_model` is exactly `qwen3-coder-next-q5km` and the selected delegate uses
Hermes. Review this profile if the model changes. Combine it with the strategy for the selected transport: A2A or
CLI one-shot.

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
- The first failed recognizer session made 277 `write_file` calls and continued after A2A had marked its task failed.
  A gateway restart left a separate session worker alive. The Manager stopped that worker before cleanup. A later
  broad CLI assignment again wrote unrequested fixtures and continued after a client `fetch failed` result; the Manager
  stopped the gateway. A2A task state is not a reliable stop signal for filesystem work.
- With a 20-turn profile cap, a 240-second advisory run budget, and tool-loop hard stops enabled, a one-file,
  no-test recognizer assignment completed in about 38 seconds. A broader CLI assignment still exceeded the transport
  window. Three subsequent one-file corrections completed in roughly one to two minutes each, and independent checks
  confirmed a working read-only CLI against the real PDF. At that time these settings bounded ordinary turns without
  a hard wall-clock limit or repaired A2A cancellation; the later CLI wrapper adds a separate process deadline.
- A one-file monetary extractor parsed a synthetic example and the real contract, but its single correction for
  duplicate labels removed the real tax amounts. The draft was rejected. For numeric parsers, require an independent
  real-layout check after each edit and stop this model stage after one failed correction; do not publish a parser
  merely because its synthetic example passes.

These are observations from the financial-records and Hermes delegation work in September 2026. They guide the next
assignment; they do not claim that every run or other deployment of the model behaves this way.

## A2A versus CLI one-shot comparison

A later read-only, no-tool `READY` probe separated basic response latency from coding-task behavior. The local model API
returned in about 0.4 seconds; the first Hermes CLI call took about 8.6 seconds, a repeated CLI call about 2.4 seconds,
and the profile delegate launcher completed `check` in about 0.1 seconds and `run` in about 2.9 seconds. These are single
warm/cold observations with slightly different system prompts, not a controlled throughput benchmark. The A2A gateway
was stopped, so this probe did not measure A2A. It suggests that the multi-minute coding runs need phase-level diagnosis
of prompt processing, model turns, tool calls, and retries rather than attributing the delay to transport overhead alone.
The earlier matched coding run below is the available transport comparison.

In a separate visual probe, the Hermes desktop app was switched to the same `sc-dev-5-coder` profile and
`qwen3-coder-next-q5km` model. A fresh session's first no-tool `READY` reply appeared in about 23 seconds; the same
prompt in that session completed in about 2.5 seconds. The first-turn delay is consistent with startup or session
initialization, but two turns do not isolate its cause. This visual route is distinct from the A2A gateway route, which
was not restarted for this probe.

A more substantial read-only desktop task traced the delegate launcher's profile binding and both transport branches,
then asked for three concrete ways a caller might mistake task state for stopped work, with file and line references.
It explored six files and completed in about 60 seconds without editing the checkout. Its answer correctly flagged
`CancelTask` as not proving that an in-flight Hermes turn stopped, but two points repeated an unsupported inference
about writes after a *completed* A2A task and introduced an unverified `fsync` explanation. The observed failure/cancel
case should not be generalized to every completed task. This is one UI task with different work from the earlier
implementation runs; it measures neither GPT overhead nor code-implementation speed.

On one visible branch, the same one-file task asked the Coder to recognize the English phrase `SNOW REMOVAL CONTRACT`
with `PAYMENT` while retaining the French path. The same profile, model, project, assignment text, and four independent
behavior checks were used. The recognizer was restored to the same starting revision between runs; the two runs were
sequential. A2A completed in roughly 90 seconds and passed all four checks, but its diff had two trailing-whitespace
errors. CLI one-shot completed in roughly 100 seconds, passed the same checks and `git diff --check`, and left no
one-shot process after exit. These approximate times are observations from one run per transport, not a speed
benchmark or evidence that CLI produces better code. The CLI completion prose incorrectly called the unsupported
contract result "supported"; review the result object and diff rather than trusting that prose on either route.

CLI one-shot provides a directly observable process exit and avoids the A2A message deadline for this assignment.
At the time of this comparison the launcher had no hard wall-clock timeout; a later change added the verified wrapper.
A2A remains available for later session-oriented work, but its current task status must not be treated as a
process-stop guarantee. Select the transport in the profile binding and load its matching transport strategy; do not
change the model strategy when switching between these two routes.

A second, harder matched assignment asked for a one-file amount extractor with duplicate-label and integer-cent
validation. The starting target was absent for both runs, the same assignment text was used, and the runs were
sequential. A2A hit its 300-second orphan deadline: the client returned `fetch failed`, the task later became
`TASK_STATE_FAILED`, and gateway logs showed another model call and `write_file` **after** that failure. It wrote the
requested parser plus an unrequested test file. The coordinator directly stopped the exact Coder gateway, confirmed
the turn stopped, and only then removed the artifacts. Its partial parser passed 7 of 8 independent synthetic cases;
it rejected a valid case where GST and QST had equal amounts.

CLI one-shot ran past the same five-minute point without an A2A deadline, but was still active at seven minutes and
had created three unrequested test/helper files. The coordinator sent SIGTERM to that exact one-shot process; it
exited with status 143 and no Coder one-shot or separate worker remained. Its partial parser passed 8 of 8 cases,
but the assignment did not complete cleanly, and the files were removed. This is one observation of direct process
termination, not proof that every descendant or interruption mode is handled. The two partial scores are not a model
quality ranking because the runs ended under different conditions. The useful distinction is lifecycle control:
CLI can be terminated as a local process, whereas A2A task failure did not stop the gateway turn. Neither transport
prevented out-of-scope writes; require an enforced CLI wall-clock limit and independent scope review before unattended
use on larger assignments.

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

For text recognizers, state which input representation preserves the invariant being tested. In a frozen English
`PAYMENT` recognizer fixture, the Coder repeatedly used a whole-word check on `normalizedText` but also a substring
check on `compactText`, which accepted `REPAYMENT`. Eight baseline assignments passed 2/8 independent verifiers;
eight interleaved assignments explicitly saying to check whole-word `PAYMENT` in `normalizedText` and not substring
search `compactText` passed 8/8, with 319.42 versus 243.49 seconds of total Coder time. The treatment also requested
direct file-tool work and concise completion, so the source-representation sentence is not isolated as the sole cause.
This is a task-specific handoff result, not a general model-speed setting. Include both false-positive and coexistence
cases in independent acceptance checks. See the [GX10 runtime benchmark](../../../../notes/benchmarks/local-models/gx10-hermes-qwen-coder-runtime-2026-09-28.md).

For process-tree cleanup, state the exact sequence and verify each branch. On a frozen six-case helper fixture, two
fresh handoffs explicitly required an unconditional final group SIGKILL, but both initial implementations still made
it conditional on a direct-child wait timeout. One verifier-backed correction produced accepted code in 52.64 seconds
total Coder time; another passed the verifier but failed source review because an early return could skip reaping.
Porting the accepted source to the production helper passed all six cases, yet the Coder spent 143.92 seconds and
repeated patches until its 20-turn cap. Use the verifier and inspect the diff even when a turn reports success or
exits at its limit. This is a useful handoff pattern for this task, not a measured general speed improvement.
In a four-run source-port pilot, a six-turn cap passed the same verifier but exhausted its budget on both runs and
averaged 62.94 seconds; the 20-turn cap finished normally in both runs and averaged 46.85 seconds. This small port
test does not justify lowering the live cap to six. See the checked-in sanitized turn-cap pilot in the GX10 note.

The CLI launcher now runs Hermes through the process-group timeout helper, with a 240-second default and a positive
integer per-run override. A real correction turn completed through the wrapper; a fake CLI integration check confirmed
that timeout exits 124 and stops a signal-resistant descendant. Independent testing of the helper still passes six
cases. This bounds a runaway process but does not turn a timed-out assignment into accepted code. The first Coder
stage for this change itself took 163 seconds, reached 20 calls, and wrote an unrequested empty file repeatedly;
Admin removed that file after the process exited. One correction took 43.82 seconds. Continue to enforce exact write
scope and independent acceptance, and do not treat a zero process exit as proof of completion.

For launcher or protocol changes, spell out both sides of the command boundary with example invocations and where
each input is read (argument or stdin). Require the Coder to inspect existing callers and tests before editing. Ask
for concise changed-file and blocker evidence; do not rely on a prose claim of completion.

Admin waits for the real task result. On timeout or disconnect, inspect task and process state plus the visible diff before any
retry. When authorized for the exact Coder profile, Admin can stop its gateway or one-shot process directly and verify
that the turn and descendants have exited; another model role is not required for routine lifecycle control. Command
Runner runs focused existing and new tests, plus shell syntax checks where applicable. Admin reviews
whether tests actually assert the contract. Do not accept a change that breaks the delegate launcher; restore the last
working version if routing becomes unusable and report the blocked Coder stage.

The A2A launcher starts a new context for each run. The adapter can resume a context, but the launcher has no
accepted `--context-id` route yet. CLI one-shot starts a separate process and session for each run by default. Do
not describe separate runs as one persistent Coder session. Do not choose [goal-backed continuation](../goal-backed-continuation.md)
until persistent goals, status, and resume are verified through the selected delegate route.
