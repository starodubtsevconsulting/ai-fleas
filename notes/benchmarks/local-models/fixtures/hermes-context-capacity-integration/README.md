# Hermes context-capacity integration fixture

This fixture tests whether a Coder can retain and integrate elementary requirements distributed across one fixed long context packet. It is not intended to test algorithmic sophistication.

All context-capacity arms receive byte-identical packet content and ordering as a sequence of bounded session messages. Only the synchronized served/Hermes context limit changes. The packet generator positions:

- `CONTRACT_EARLY.md` near 20K tokens;
- `CONTRACT_MIDDLE.md` near 90K tokens;
- `CONTRACT_LATE.md` near 150K tokens;
- `TASK.md` near 205K tokens.

The runner sends each frozen chunk in order and requires a fixed acknowledgement before sending the next chunk. Every individual request must fit the arm's observed effective context with frozen output headroom. The cumulative session intentionally exceeds arms A and B: declared Hermes compression or oldest-context eviction is the treatment being observed, not an invalid transport truncation. A run is invalid if the server silently truncates an individual request, the delivered chunk sequence or hashes differ, the configured compression/eviction policy differs, or the final model input cannot be measured. Record cumulative delivered tokens, largest model input, compaction events, evicted-token evidence when available, and the final model input size.

The requirement groups appear exactly once. The final task names their IDs but does not restate their meanings. After task delivery, the worker must not reread contract-bearing files. The runner must enforce that boundary or invalidate the run.

Each run starts with `starter/recognizers/change-approval-recognizer.mjs` staged as `recognizers/change-approval-recognizer.mjs`. That staged file is the only writable path. The worker may not inspect `verify.mjs`, expected outputs, saved candidates, or assertion descriptions.

Run `node verify.mjs RUN_DIRECTORY` only after the worker process is confirmed stopped. The verifier reports EARLY, MIDDLE, LATE, and legacy group scores. Complete first-pass acceptance requires every assertion, exact write scope, truthful completion prose, and verified restoration.

The fixture is deliberately one pure function with no packages, processes, concurrency, or repository discovery. A failure therefore maps more directly to retained contract use than the earlier process-group task, whose 0/8 baseline mixed context with substantial lifecycle reasoning difficulty.
