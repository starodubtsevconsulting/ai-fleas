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

The purpose of these benchmarks is therefore practical: find the strongest local model that can run at an acceptable speed and reliability on the available hardware. The target is not simply the largest model that fits in memory, but a model capable enough to be useful as a real worker while remaining fast enough for sustained or on-demand operation.

## ASUS Ascent GX10 — Qwen worker models

Benchmarked on a single ASUS Ascent GX10 with NVIDIA GB10 and 128 GB unified memory. Both models were served with `llama.cpp`/CUDA and exercised through Hermes Agent using the same local OpenAI-compatible endpoint and tool-use workflow.

| Metric | Qwen3-Coder-Next Q5_K_M | Qwen3.5-122B-A10B Q5_K_S |
|---|---:|---:|
| Parameters | 79.67B (~3B active) | 124.64B (~10B active) |
| Model size | 52.81 GiB | 81.40 GiB |
| Cold-load unified-memory delta | 56.77 GiB | 82.33 GiB |
| Cold load | 7.29 s | 66.14 s |
| Prompt processing | 1,435.8 tok/s | 862.9 tok/s |
| Generation | 55.68 tok/s | 22.16 tok/s |
| Median TTFT | 202 ms | 438 ms |
| TTFT range | 179–205 ms | 427–456 ms |
| Configured context | 65,536 | 65,536 |
| Native max context | 262,144 | 262,144 |
| Hermes tool-use test | PASS | PASS |
| Tool task wall time | 21.94 s | 149.23 s |
| Model API calls | 9 | 7 |

### Hermes tool-use baseline

The reproducible baseline required the agent to read a file, sort and deduplicate its contents, write two output files, count lines, calculate SHA-256, and verify the outputs. Results were independently checked after the agent completed the task.

For Qwen3-Coder-Next the run used 6,382 input tokens and 620 output tokens and passed independent verification.

### Current choice

Both models completed the baseline tool-use task correctly. **Qwen3-Coder-Next Q5_K_M is currently the default single-GX10 worker** because it generated at about 2.5× the speed and completed the tested Hermes task about 6.8× faster. Qwen3.5-122B-A10B remains a useful candidate when additional reasoning quality may justify lower throughput.

## Planned experiments

The next model family planned for this benchmark is **DeepSeek V4**. Two configurations are of particular interest:

1. A compressed/quantized DeepSeek V4 configuration that can run on a single GX10, if a practical configuration is available.
2. Full or substantially larger DeepSeek V4 inference distributed across **two GX10-class boxes**, using the combined hardware as a local worker cluster.

Those experiments are not benchmarked here yet. When tested, their measurements will be added to this page using the same approach where practical so the results remain useful for comparison.

The existing Qwen measurements will remain here for historical reference even if a later model becomes the preferred worker.

These numbers describe this specific GX10/runtime/configuration and should be treated as empirical baselines rather than general model-performance claims.

## RTX 3080 Ti workstation — Hermes System agent

This comparison uses a 12 GiB NVIDIA GeForce RTX 3080 Ti workstation with approximately 47 GiB of OS-visible RAM. The provider runs a pinned CUDA build of `llama.cpp` with a 65,536-token context and one inference slot. Unlike the controlled GX10 measurements above, the first result records a real, existing Hermes System-agent conversation and is therefore an operational baseline rather than a synthetic benchmark.

| Metric | Qwen3-Coder 30B A3B Q8_0 | Qwen3-Coder 30B A3B Q4_K_M |
|---|---:|---:|
| Model size | 30.2 GiB | 17.3 GiB |
| GPU layers | 12 | 20 |
| Configured context | 65,536 | 65,536 |
| Inference slots | 1 | 1 |
| Existing conversation input | ~19K tokens | 17,282 input + 1,839 cache-read tokens |
| Prompt-processing time | ~2 minutes | 60.0 s (288.2 tok/s) |
| Longer direct generation | ~7.3 tok/s | 14.5 tok/s (157-token response) |
| Preserved-session wall time | ~5 minutes observed | 165 s, including ~103 s waiting for the single occupied slot |
| Direct API verification | PASS | PASS |
| Hermes existing-session test | PASS | PASS |

The Q8_0 result was functionally correct but too slow for an interactive System agent. Q4_K_M approximately doubled sustained generation in the longer direct response, reduced large-conversation prompt processing to about one minute, and reduced the observed preserved-session wall time from roughly five minutes to 165 seconds. The service itself completed that Hermes request in 61.8 seconds; approximately 103 seconds were queue time behind another request because the memory-safe configuration exposes one inference slot. Switching away from the still-open Q8 process immediately released about 31 GiB on disk, while the Q4 artifact is about 12.9 GiB smaller than Q8.

The preserved-session test resumed the existing `Bot Chat`, retained its history, and returned the exact requested marker through the Q4 provider in one API call. Short-response generation rates are unstable, so the seven-token Hermes marker's 3.2 tok/s rate is not used as the representative generation measurement.

### Full Hermes System-agent overhead

A second Q4 test started a genuinely new Hermes chat containing only the user question `what model do you use?`. It was still not interactive because the full System-agent configuration constructed a 46,536-token request before generation. This isolates agent bootstrap and tool-schema overhead from accumulated conversation history.

| Metric | New-chat result |
|---|---:|
| User conversation messages before request | 1 |
| Provider prompt tokens | 46,536 |
| Prompt processing | 188.0 s (247.6 tok/s) |
| Generation | 53 tokens in 47.0 s (1.1 tok/s) |
| Provider total | 235.0 s |
| Hermes timely interactive completion | FAIL |
| System prompt | 32.7 KB |
| Tool schemas | 46.2 KB across 30 tools |
| Skills index | 5.7 KB |

The model and endpoint remained healthy throughout the test. The failure is architectural: the default full Hermes tool surface and System prompt are too large for responsive inference on this hardware. A useful deployment needs a lean System profile with only the required toolsets and a scheduler whose reports do not continuously expand the interactive chat. Model self-identification is not a valid routing test; this run repeated a stale Q8 identifier found in earlier preserved history even though session metadata, the running process, and the provider's `/v1/models` response all proved that Q4_K_M handled the request.
