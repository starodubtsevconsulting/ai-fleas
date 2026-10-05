# Context Capacity calibration results

Date: 2026-10-04

Branch: `test-qwen-context-capacity`

Model: Qwen3-Coder-Next Q5_K_M
Arm: A (`65,536` server and Hermes context tokens, Hermes compression threshold `25%`)

## Status

No attempt below is a valid scored benchmark run. These are harness-calibration results only. Attempts stopped on the first fail-closed condition, and every post-snapshot attempt restored the captured Hermes configuration and remote systemd override byte-for-byte.

## Attempts

| Run ID | Furthest point | Outcome | Calibration finding |
| --- | ---: | --- | --- |
| `exploratory-abc-a-001` | startup | invalid | A one-shot health check observed the model-loading `503`; readiness must be polled after restart. |
| `exploratory-abc-a-002` | chunk 1 | invalid | Raw packet text did not communicate the frozen acknowledgement protocol; explicit frozen delivery envelopes are required. |
| `exploratory-abc-a-003` | model call 30 | invalid | A compression-bound turn exceeded the original 180-second per-turn timeout; bounded 600-second turn/correction ceilings were frozen before any valid run. |
| `exploratory-abc-a-004` | final coding turn | invalid | Hermes mixed a non-JSON compaction progress line into stream-JSON output. The preserved workspace independently passed all 21 assertions, but no canonical evidence was produced. |
| `exploratory-abc-a-005` | final coding turn | invalid | Hermes exited nonzero after its internal 180-second run budget. The preserved target independently passed all 21 assertions, but the model also created four unexpected files, violating write scope. |

## Last-attempt observations

- Frozen payload delivered: 205,080 tokens in 53 turns; chunks 1–52 acknowledged successfully.
- Session totals: 398,164 input tokens, 8,938 output tokens, 72 model API calls.
- External verifier on the preserved target: 21/21 assertions passed.
  - EARLY: 6/6
  - MIDDLE: 6/6
  - LATE: 2/2
  - LEGACY: 7/7
- Scope violation: besides `recognizers/change-approval-recognizer.mjs`, the workspace contained `run-tests.sh`, `verify.mjs`, `package.json`, and `recognizers/verify.mjs`.
- Measured benchmark wall time before failure: 1,498,728 ms (about 24 minutes 59 seconds).
- System peak used memory: 74,724,593,664 bytes.
- Minimum available memory: 55,871,455,232 bytes.
- Swap growth: 0 bytes.
- Model-server peak RSS observed by the adapter: 11,507,695,616 bytes.
- Hermes peak RSS: 267,632,640 bytes.
- Baseline after the final attempt: health `ok`, Hermes context 65,536, compression threshold 0.25, local and remote snapshot hashes matched.

## Interpretation

The two complete preserved workspaces provide strong calibration evidence that a 65K server context plus Hermes compression can carry the distributed EARLY/MIDDLE/LATE requirements through a 205K multi-turn session well enough to produce functionally correct target code. They do not establish a valid benchmark success rate: the experiment currently has zero valid scored runs, one complete attempt failed transport parsing, and the last attempt failed both process-exit and write-scope gates.

Before any future scored matrix, the remaining harness/runtime issue is to align Hermes's internal run budget with the frozen outer turn deadline while retaining strict write-scope enforcement. No B or C arm was run in this calibration.
