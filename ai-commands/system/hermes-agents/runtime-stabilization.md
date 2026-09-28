# Hermes / Qwen3-Coder-Next runtime stabilization

This implementation specification drives diagnosis and correction of incomplete Qwen3-Coder-Next assignments under Hermes on the GX10. Benchmark evidence is input to this work; the objective is a stable operational runtime.

## Existing evidence

Do not start by assuming Qwen3-Coder-Next Q5_K_M is generally unable to use tools.

The controlled GX10 Hermes file-tools fixture already passed with Q5_K_M at a configured 65,536-token context. Later repository work found a different failure class on larger delegated assignments: repeated writes, transport timeout while the gateway continued working, completion text that did not match the diff, and unrequested files.

Relevant baseline work:

- PR #207 / commit `8fc4ef4`: Qwen runtime diagnostics, model-vs-A2A strategy separation, retry/session guard, Q5 numeric-parser gate, and GX10 A2A findings.
- `cd5d299`: matched Hermes A2A/CLI transport work and coordinator lifecycle controls.
- `ae1e847`: focused-assignment and lifecycle-control findings.

Treat these as prior evidence, not experiments to repeat without a reason.

## Isolation matrix

Use one small known-good fixture and one representative assignment that has exhibited the real failure. Keep model, quant, prompt intent, context setting, and output cap fixed where the compared route permits it.

| Route | Purpose | Completion evidence |
|---|---|---|
| direct OpenAI-compatible model endpoint | isolate inference/template/tool-parser behavior from Hermes | response/finish reason plus server log |
| Hermes CLI one-shot | add Hermes prompt/tools while retaining process lifecycle visibility | process exited plus independent output verification |
| Hermes A2A | add A2A transport/session behavior | terminal task state **and** gateway/process stopped plus independent output verification |

Do not interpret an A2A terminal state alone as process termination.

## Capture before changing settings

Record:

- exact model artifact and quantization;
- serving backend and version/commit;
- effective chat template and Qwen tool parser;
- configured and effective per-slot context;
- GPU-layer/offload and Flash Attention settings;
- concurrency/parallel-slot count;
- output/token cap and finish reason;
- whole-system available memory and swap before/during the run;
- Hermes version/profile and selected transport;
- wall time, API-call count, tool-call count, and unexpected writes.

Preserve the failing logs before upgrading the backend or replacing the GGUF.

## Decision sequence

1. Reproduce with the current configuration.
2. Run the same bounded case against the direct model endpoint.
3. Run it through Hermes CLI one-shot.
4. Run it through Hermes A2A.
5. Compare the first layer where behavior diverges.
6. Change one variable at a time and rerun the same case.

### If direct inference/tool calls fail

Investigate the serving layer first:

- verify the current backend supports the model's expected tool-call/chat template;
- compare the installed backend against a current known-good build;
- verify the GGUF provenance/checksum and whether a corrected artifact is actually required;
- test a bounded context profile, beginning with 32,768 tokens **only when the harness permits it**;
- inspect memory/swap and finish reasons before attributing a stop to model reasoning.

Do not claim a historical GGUF/parser defect applies to the installed artifact until it is reproduced or the exact affected version is established.

### If direct endpoint is stable but Hermes CLI fails

Focus on Hermes template/tool binding, output limits, loop guards, and assignment shape. Do not replace the model merely because the harness fails.

### If CLI is stable but A2A fails

Focus on transport/session lifecycle. Verify the gateway really stops after timeout/failure and prevent overlapping retries from writing the same paths.

## 32K context caveat

A 32K server context is a useful memory-isolation experiment, not automatically a production Hermes configuration. Existing GX10 evidence shows Hermes rejected another locally served model when its reported 32,768-token context was below Hermes Agent's 64,000-token minimum. Record this as a controlled direct-endpoint experiment unless the current Hermes route accepts the smaller context honestly.

## Exit criteria

The investigation is complete when:

- the first failing layer is identified;
- the representative case completes repeatedly after a measured change;
- independent output verification passes;
- no unexplained OOM, swap escalation, connection drop, or continuing gateway remains;
- before/after versions and settings are recorded;
- rollback is documented.

Do not simultaneously replace the GGUF, inference backend, context policy, and agent harness: that can hide the actual cause.
