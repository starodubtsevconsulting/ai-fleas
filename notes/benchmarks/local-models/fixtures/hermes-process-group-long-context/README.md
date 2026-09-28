# Long-context process-group coding protocol

This extends the [process-group timeout fixture](../hermes-process-group-timeout/README.md) with a fixed source-reading sequence. It tests whether a 32,768-token Hermes compression cap changes independently accepted coding work. The source packet is deliberately large; it is a context stress case, not a representative distribution of coding requests.

## Frozen task

Stage a fresh copy of `../hermes-process-group-timeout/starter/run-installer-with-timeout.py` at one visible, ignored path under `notes/benchmarks/local-models/runs/`. The staged file is the only writable root. Use the configured Coder launcher after its `check --project` succeeds; keep the model, 65,536-token served context, CLI route, 20-turn cap, source revision, prompt, starter, and verifier fixed. Set the launcher process deadline to 300 seconds for the initial run and 180 seconds for the one correction. Inspect the actual process exit before running `../hermes-process-group-timeout/verify.py` against the staged candidate. Preserve the candidate and verifier output for each run.

Before editing, ask Coder to read these **eleven complete public source files in order, one file result per model response**, paging any truncated result. It must not batch reads. It may then read the staged starter and the fixture `TASK.md`. Ask it to implement process-group cleanup so timeout and forwarded SIGTERM/SIGINT stop signal-resistant same-group descendants while preserving normal exit, streams, validation, and exit 124. Tell it not to inspect the production helper, verifier, or saved candidates, and not to run tests or edit reference files. Admin performs independent verification.

1. `ai-commands/system/hermes-agents/spec.md`
2. `ai-commands/system/hermes-agents/command-runner-route.mjs`
3. `ai-commands/system/hermes-agents/hermes-delegate.command.sh`
4. `ai-commands/system/hermes-agents/configure-bounded-routes.mjs`
5. `ai-commands/system/hermes-agents/src/configure-group.py`
6. `ai-commands/system/hermes-agents/src/realize-workflow.py`
7. `ai-commands/system/hermes-agents/install-agents.sh`
8. `ai-commands/system/hermes-agents/a2a-client.mjs`
9. `ai-commands/system/hermes-agents/tests/install-agents.test.sh`
10. `ai-commands/system/hermes-agents/src/validate-profile.py`
11. `ai-commands/system/hermes-agents/delegation-architecture.md`

The source packet was 110,711 bytes in the recorded trial. Freeze its revision when repeating the comparison. Run old, cap, cap, old in fresh sessions. The **only profile treatment** is adding `compression.threshold_tokens: 32768` to the old profile, which has `compression.threshold=0.25`, `target_ratio=0.15`, and `protect_last_n=8`. Restore and byte-check the original profile after each run. Do not pool a run unless a model input crossed 32,768 tokens or a committed compaction occurred; record actual largest input and compaction events from the Hermes log.

If the first verifier fails timeout/SIGTERM/SIGINT descendant cleanup, allow exactly one identical correction per arm: signal the captured process group; wait at most five seconds for the direct child; unconditionally attempt group SIGKILL even if that child exited; reap the child; preserve the interface. Rerun the independent six-case verifier after the correction. Count acceptance only when it passes and source review finds no early return before reaping. Report total Coder wall time including correction, model calls, compaction count and time, and process termination. An initial exploratory run that batched large reads and peaked below the cap is a harness diagnostic, not a matched sample.

The [2026-09-28 pilot record](../../gx10-long-context-coding-pilot-2026-09-28.json) contains sanitized measurements. Exact operational prompts, outputs, logs, and staged code are retained only in the local ignored `runs/` folder.
