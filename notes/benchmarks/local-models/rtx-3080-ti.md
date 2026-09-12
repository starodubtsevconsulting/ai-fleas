# RTX 3080 Ti workstation — Hermes System agent

This comparison uses a 12 GiB NVIDIA GeForce RTX 3080 Ti workstation with approximately 47 GiB of OS-visible RAM. The provider runs a pinned CUDA build of `llama.cpp` with one inference slot; context varies by candidate. Unlike the controlled GX10 measurements, the first result records a real, existing Hermes System-agent conversation and is therefore an operational baseline rather than a synthetic benchmark.

## Takeaways

The RTX 3080 Ti turned out to be **useful, but for a different role than a large-model worker**.

### Pros

- **Compute is not the main problem.** A fully GPU-resident Qwen3.5 9B Q4_K_M generated about 95 tok/s in the measured direct request, with live inference reaching 94% GPU utilization.
- **Small and medium models are a good fit.** Qwen3.5 9B fits completely in VRAM together with its caches, uses about 6.7 GiB, and still provides the 65,536-token context required by Hermes.
- **Good fit for the local [System agent](../../../ai-workflows/_common/roles/system.md) and micro-command workers** where responsiveness and low-cost repeated inference matter more than running the largest possible model. This is the intended practical use for this workstation.
- **Already available hardware with CUDA support**, so it can add useful local inference capacity without buying another AI box.

### Cons

- **12 GiB VRAM limits large models.** The 30B candidates only partially fit on the GPU and become too slow for an interactive Hermes System agent.
- **Large and heavy workstation.** It occupies substantially more physical space than compact AI boxes.
- **Noisy under operation.** This matters for an always-on local worker, especially when the machine is located in a normal living or working space rather than a server room.
- **Less attractive for incremental scaling.** Adding multiple compact AI boxes is operationally easier than adding more full-size workstations of this type.
- **Hermes latency can hide the GPU's actual speed.** In the first Desktop acceptance run, the substantive provider request completed in 6.9 seconds; much of the remaining 37–63 second wall time came from orchestration overhead, especially automatic title-generation requests competing for the single inference slot.

The practical architecture is therefore complementary rather than competitive: **GX10-class hardware handles larger heavyweight workers, while the RTX 3080 Ti is intended to run the local [System agent](../../../ai-workflows/_common/roles/system.md) and other fast, frequent local tasks.** Its inference performance makes it worth using, but its size, weight, noise, and VRAM ceiling make it less attractive as the pattern for future cluster expansion.

| Metric | Qwen3-Coder 30B A3B Q8_0 | Qwen3-Coder 30B A3B Q4_K_M | Qwen3 8B Q4_K_M |
|---|---:|---:|---:|
| Model size | 30.2 GiB | 17.3 GiB | 4.68 GiB |
| GPU residency | Partial | Partial | Full (8,040 MiB observed) |
| GPU layers | 12 | 20 | All (`-ngl 99`) |
| Configured context | 65,536 | 65,536 | 40,960 (native maximum) |
| Inference slots | 1 | 1 | 1 |
| Existing conversation input | ~19K tokens | 17,282 input + 1,839 cache-read tokens | Not tested |
| Prompt-processing time | ~2 minutes | 60.0 s (288.2 tok/s) | 734.7 tok/s (21-token uncached portion) |
| Longer direct generation | ~7.3 tok/s | 14.5 tok/s (157-token response) | 122.9 tok/s (25-token response) |
| Direct request wall time | Not recorded | Not recorded | 0.27 s |
| Preserved-session wall time | ~5 minutes observed | 165 s, including ~103 s waiting for the single occupied slot | Not tested |
| Direct API verification | PASS | PASS | PASS |
| Hermes existing-session test | PASS | PASS | FAIL: below Hermes 64K minimum |

The Q8_0 result was functionally correct but too slow for an interactive System agent. Q4_K_M approximately doubled sustained generation in the longer direct response, reduced large-conversation prompt processing to about one minute, and reduced the observed preserved-session wall time from roughly five minutes to 165 seconds. The service itself completed that Hermes request in 61.8 seconds; approximately 103 seconds were queue time behind another request because the memory-safe configuration exposes one inference slot. Switching away from the still-open Q8 process immediately released about 31 GiB on disk, while the Q4 artifact is about 12.9 GiB smaller than Q8.

The preserved-session test resumed the existing `Bot Chat`, retained its history, and returned the exact requested marker through the Q4 provider in one API call. Short-response generation rates are unstable, so the seven-token Hermes marker's 3.2 tok/s rate is not used as the representative generation measurement.

## Full Hermes System-agent overhead

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

## Fully GPU-resident candidate

Qwen3 8B Q4_K_M replaced the 30B artifact and kept its weights plus Q8 key/value caches entirely within the RTX 3080 Ti's VRAM. A fresh direct request completed in 0.27 seconds, with 734.7 prompt tokens per second and 122.9 generated tokens per second. The provider advertised the expected alias and its native 40,960-token context, and the machine retained 91 GiB of free model-volume storage after the installer removed the inactive 30B artifact.

This direct result is fast enough to proceed, but it is not yet a Hermes acceptance result. The previously measured default Hermes System request contained 46,536 prompt tokens, which exceeds this model's native context before response generation. The next acceptance test must therefore use a reduced System prompt/tool surface and a fresh or compressed session; silently truncating the existing full request would not be a valid migration.

## Hermes-compatible fully GPU-resident candidate

Qwen3.5 9B Q4_K_M replaced the incompatible 8B candidate. The server advertises a real 65,536-token context against the model's native 262,144-token limit, satisfying Hermes Agent's 64K minimum. With all layers and Q8 key/value caches on the RTX 3080 Ti, the process used 6,674 MiB of VRAM. The only retained model artifact is 5,680,522,464 bytes and the model volume has 91 GiB free.

GPU execution was also verified under live inference rather than inferred only from the `-ngl 99` configuration. During an active request, `nvidia-smi` reported 94% GPU compute utilization, 81% memory-controller utilization, P2 performance state, and 6,684 MiB assigned directly to the `llama-server` process (6,885 MiB total device usage out of 12,288 MiB). This confirms full CUDA execution while leaving roughly 5.3 GiB of physical VRAM headroom.

A fresh direct marker request completed in 0.23 seconds. The measured request processed 19 prompt tokens at 306.0 tokens per second and generated five tokens at 95.4 tokens per second. Direct inference, endpoint advertisement, profile reconciliation, and the Hermes System binding check all passed. Full Hermes chat latency remains to be measured because its default bootstrap previously supplied 46,536 prompt tokens.

The first Hermes Desktop acceptance run used a smaller 22,476-token bootstrap. A plain model-identification turn took 37.3 seconds, and a terminal-assisted time query took 62.7 seconds across three model calls. Provider logs showed that the substantive first request itself completed in 6.9 seconds (6.2 seconds of prompt evaluation plus 0.7 seconds of generation). Most remaining wall time came from automatic title-generation requests contending for the provider's only inference slot and repeatedly timing out after 30 seconds. The System-profile reconciler now disables automatic title generation because this pinned lifecycle profile does not need generated chat titles; manual titles remain available. A follow-up Hermes timing run is required to confirm the expected improvement.
