# MacBook Pro M5 — local models

This benchmark covers the MacBook Pro M5 with approximately 40 GB of unified memory as a portable tier in the local AI worker pool.

The machine is already used successfully for local inference, but controlled measurements have not yet been recorded. An 8B-class Qwen model is already known to run responsively, so the benchmark should start from the largest practical candidate and work downward rather than beginning with the known-easy case.

## Intended role

The MacBook is intended for **portable local inference**:

- personal/on-device agents
- commands and local worker tasks
- local inference while away from the larger worker machines
- development and experimentation without consuming GX10 capacity

The benchmark will determine whether it can also serve as a useful medium-size worker rather than only a lightweight-model machine.

## Current status

**Operationally usable, not yet benchmarked.** Existing experience indicates that an 8B-class model is fast enough for practical use, but no controlled throughput, latency, memory, or Hermes tool-use measurements have been recorded yet.

## TODO — benchmark from the top down

Start with a **~30B Q6 model**. With approximately 40 GB of unified memory, this is a plausible upper-tier candidate, but the test must include total runtime and KV-cache memory rather than considering model weights alone.

If the candidate does not leave enough memory for normal Mac use or is not responsive enough, step down in this order:

1. **~30B Q6**
2. **~30B Q5**
3. **~30B Q4**
4. **~16B Q8/Q6**
5. **8B** baseline

Acceptance goal: **the largest model/quantization that remains responsive while leaving enough unified memory for normal laptop use.** The objective is not to consume all available memory.

Run the same practical benchmark methodology used for the other local machines and, where possible, the same Hermes tool-use task.

Record:

- exact M5 MacBook Pro hardware configuration
- exact model and quantization
- model size
- configured and native context
- unified-memory usage and peak memory during inference
- memory remaining for normal macOS/application use
- prompt-processing speed
- generation speed
- TTFT
- direct request wall time
- Hermes compatibility and tool-use result where applicable
- Hermes task wall time
- power/thermal behavior for sustained operation

The result should establish where the MacBook belongs in the local compute hierarchy and whether a ~30B model makes it a practical medium-size worker.
