# MacBook Pro M5 — lightweight local models

This benchmark covers the MacBook Pro M5 with approximately 40 GB of unified memory as a lightweight tier in the local AI worker pool.

The machine is already used successfully for local inference, but controlled measurements have not yet been recorded. The initial candidate is a **Qwen 8B-class model** already known to run responsively on the machine.

## Intended role

The MacBook is not intended to compete with the GX10 for heavyweight models. Its useful role is **portable, lightweight local inference**:

- small personal/on-device agents
- lightweight commands and micro-tasks
- local inference while away from the larger worker machines
- development and experimentation without consuming GX10 capacity

## Current status

**Operationally usable, not yet benchmarked.** Existing experience indicates that the 8B-class model is fast enough for practical use, but no controlled throughput, latency, memory, or Hermes tool-use measurements have been recorded yet.

## TODO — benchmark the existing setup

Run the same practical benchmark methodology used for the other local machines.

Record:

- exact M5 MacBook Pro hardware configuration
- exact model and quantization
- model size
- configured and native context
- unified-memory usage and peak memory during inference
- prompt-processing speed
- generation speed
- TTFT
- direct request wall time
- Hermes compatibility and tool-use result where applicable
- Hermes task wall time
- power/thermal behavior if useful for sustained operation

Start with the existing **Qwen 8B-class model**, then consider a larger 14B-class candidate if memory and performance headroom make it worthwhile.

The purpose of this benchmark is to determine where the MacBook fits in the local compute hierarchy, not to maximize model size at the expense of portability and responsiveness.
