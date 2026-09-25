# Hermes file-tools fixture

This is the controlled Hermes Agent task used for the GX10 worker-model comparisons.

For every candidate:

1. Copy `INPUT.txt` and `TASK.md` into a clean run directory.
2. Give Hermes the contents of `TASK.md` without additional task guidance.
3. Measure wall time from agent invocation through completion.
4. Retain the Hermes usage summary and count model API calls.
5. Compare the generated `NORMALIZED.txt` and `REPORT.txt` byte-for-byte with the expected files in this directory.

Run `verify.sh <run-directory>` for the independent output check. The script does not trust the agent's own verification claim.

`../../run-hermes-file-tools.sh <run-directory> <model> <provider>` performs the controlled run, captures wall time and Hermes usage, then invokes the independent verifier. Set `HERMES_BIN` when the executable is not on `PATH`.

Use a dedicated Hermes benchmark profile whose `terminal.cwd` is the run directory. An explicit `terminal.cwd` in the active profile can override the runner's `--in` argument; in that case the independent verifier intentionally fails instead of accepting files created elsewhere. Do not enable a broad host-directory mount merely to make the benchmark pass.

The fixture records task correctness and orchestration behavior. Direct runtime measurements such as cold load, prompt throughput, generation throughput, TTFT, memory, and GPU utilization are collected separately.
