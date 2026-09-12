# Local Model Benchmarks

## Why local workers

A local model does not have to replace a high-level reasoning model. A useful architecture is to keep a strong hosted model such as GPT or Claude in the coordinating/reasoning role and delegate suitable work to a pool of agents. Some agents can use hosted models while others run locally.

Local workers are especially useful for repetitive, long-running, or high-volume tasks where using a hosted model for every token would be unnecessarily expensive. They can run on demand or continuously, including 24/7 worker-style workloads, while the stronger reasoning model remains available for coordination, difficult decisions, and escalation.

```mermaid
flowchart TD
  Human["Human"] --> Coordinator["High-level reasoning model\nGPT / Claude / other"]
  Coordinator --> Hosted["Hosted agents\nstrong remote models"]
  Coordinator --> LocalPool["Local agent pool"]
  LocalPool --> Worker1["Local worker agent\nHermes + local model"]
  LocalPool --> Worker2["Local worker agent\nHermes + local model"]
  Hosted --> Result["Combined result"]
  Worker1 --> Result
  Worker2 --> Result
  Result --> Coordinator
  Coordinator --> Human
```

The purpose of these benchmarks is practical: find the strongest local model that can run at an acceptable speed and reliability on the available hardware.

## Current results

| Hardware | Current choice | Context | Generation | Status |
|---|---|---:|---:|---|
| ASUS Ascent GX10, 128 GB unified memory | **Qwen3-Coder-Next Q5_K_M** | 65,536 | 55.68 tok/s | Default single-GX10 worker |
| RTX 3080 Ti, 12 GiB VRAM | **Qwen3.5 9B Q4_K_M** | 65,536 | 95.4 tok/s direct | Hermes-compatible System-agent candidate |
| MacBook Pro M5, ~40 GB unified memory | **Qwen 8B-class** | TBD | TBD | Operationally fast; top-down benchmark pending |
| MINISFORUM UM790 Pro, 32 GB DDR5 | TBD | TBD | TBD | Always-on small-worker benchmark pending |

## Benchmark reports

- [ASUS Ascent GX10](gx10.md) — Qwen worker comparison, single-GX10 capacity tests and DeepSeek V4 experiments.
- [RTX 3080 Ti workstation](rtx-3080-ti.md) — System-agent target; 30B Q8/Q4, 8B and 9B experiments plus Hermes overhead.
- [MacBook Pro M5](macbook-pro-m5.md) — portable local-inference tier; benchmark starts from ~30B Q6 and works downward.
- [MINISFORUM UM790 Pro](minisforum-um790-pro.md) — compact always-on worker with Ryzen 9 7940HS, Radeon 780M and 32 GB DDR5; benchmark pending.
- [Methodology](methodology.md) — what is measured and how direct inference differs from full agent acceptance testing.

## Main findings

**GX10:** Qwen3-Coder-Next Q5_K_M is currently the preferred worker. Both tested Qwen models passed the Hermes tool-use baseline, but Qwen3-Coder-Next generated about 2.5× faster and completed the tested task about 6.8× faster than Qwen3.5-122B-A10B.

**RTX 3080 Ti:** the 30B candidates work but are too slow for an interactive Hermes System agent. Qwen3 8B is fast but cannot satisfy Hermes' 64K context requirement. Qwen3.5 9B Q4_K_M provides both full GPU residency and a 65,536-token configured context and is the current candidate.

**MacBook Pro M5:** an 8B-class Qwen model is already operationally responsive. The next benchmark starts at ~30B Q6 to determine whether the laptop can serve as a practical medium-size worker while retaining enough memory for normal laptop use.

**MINISFORUM UM790 Pro:** not benchmarked yet. Its candidate role is a compact always-on small worker; testing will determine whether local inference is useful on the Radeon 780M/CPU or whether the machine is better reserved for orchestration and conventional services.

## Next experiments

- Benchmark the MacBook Pro M5 from ~30B Q6 downward.
- Benchmark the UM790 Pro from ~14B Q5 downward.
- Repeat Hermes timing on the RTX 3080 Ti after disabling automatic title generation.
- Test the higher-capacity single-GX10 candidates documented in the GX10 report.
- Test DeepSeek V4 Flash on one GX10 and the documented FP8/TP=2 configuration across two GX10-class boxes.

Detailed measurements and historical results remain in the hardware-specific reports rather than this dashboard.
