# GX10 candidate comparison — Qwen3.8-27B and MiniMax M2.7

Measured 2026-09-27 on one GX10 with 128 GB unified memory. The selection question is whether either candidate improves independently accepted coding work over Qwen3-Coder-Next Q5_K_M, the default route. A real 65,536-token serving context, correct Hermes tool use, practical wall time, memory headroom, and a compatible license are required gates. Fitting more model weights in RAM does not establish a coding-quality gain.

## Qwen3.8-27B Q4_K_M

- Source: [official Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B), Apache-2.0, 262,144-token native context. Tested artifact: [ggml-org GGUF](https://huggingface.co/ggml-org/Qwen3.8-27B-GGUF/tree/71bc7b627595dc8a91039addd9c791ae548d6747), revision `71bc7b627595dc8a91039addd9c791ae548d6747`, `Qwen3.8-27B-Q4_K_M.gguf`, 18,973,870,528 bytes (17.67 GiB), local SHA-256 `c600de0300ae8a0eb3a6c0b8b5561b8b96f16bd2c863c2a66c42de29d391a747`.
- Runtime: CUDA `llama.cpp` commit `a97cce86a`, single slot, full GPU layer offload, flash attention, Jinja template, 65,536-token configured context. The server reported a 65,536-token slot. Thinking was left at the model/template default.
- Load: server initialization reported 6.66 seconds. The model file had just been read for its checksum, so this is a warm-file-cache load, not a disk-cold load. Q5 and Qwen3.8 were resident together; whole-system available memory was about 31 GiB after Qwen3.8 loaded and 27.3 GiB after the fixture. From the first post-load check to the final snapshot, occupied swap rose from about 483 to 484 MiB and the swap-out counter rose by 88 pages.

| Same-day direct API measure | Q5 baseline | Qwen3.8-27B Q4_K_M |
|---|---:|---:|
| First 2K-token prompt processing | 1,290 tokens/s | 745 tokens/s |
| Three-run generation range | 57.46–57.83 tokens/s | 10.98–10.99 tokens/s |
| Uncached streaming time to first token | 0.407 s | 1.198 s |
| Served context | 65,536 | 65,536 |

The direct requests used the same review prompt and a 128-token output cap. Q5 stopped after 110 tokens; Qwen3.8 reached the cap at 128 tokens. Prompt tokenization differed slightly (2,000 versus 2,044 tokens). Throughput comes from each server's reported generation timings. Q5 was retested after its service restarted on the same `llama.cpp` build. Qwen3.8 was tested while Q5 remained loaded; Q5 was tested with the optional 35B service off.

Both models passed the unchanged [Hermes file-tools fixture](fixtures/hermes-file-tools/README.md) after pinning the benchmark profile's working directory to each isolated run directory. The independent verifier compared both output files byte-for-byte. An initial setup check showed that an unpinned Hermes working directory can cause a model to write in the source fixture directory; those setup runs are excluded from this matched comparison.

| Matched Hermes fixture | Q5 baseline | Qwen3.8-27B Q4_K_M |
|---|---:|---:|
| Independent output check | PASS | PASS |
| Agent wall time | 35.67 s | 128.04 s |
| Model API calls | 4 | 5 |
| Input tokens reported | 17,295 | 17,032 |
| Cache-read tokens reported | 51,515 | 65,228 |
| Output tokens reported | 677 | 834 |

Qwen3.8 used the tools correctly, but this run took 3.59 times the Q5 wall time. The earlier Q5 fixture result of 21.94 seconds used a different run date and harness state; the same-day 35.67-second result is the comparison here.

### Matched coding task

No clean repository task was retained from the earlier pilots, so a separate synthetic one-file coding task asked each Hermes agent to implement a receipt amount parser. The same prompt and starter file required exact labels, strict money syntax, integer-cent arithmetic, duplicate rejection, and total reconciliation. An independent 15-case verifier stayed outside each work directory, and the target file was checked after the run.

| Coding-task result | Q5 baseline | Qwen3.8-27B Q4_K_M |
|---|---:|---:|
| Agent wall time | 73.45 s | 600 s limit |
| Target-file edit | Yes | No |
| Independent cases | 14/15 | Incomplete stub; no accepted result |
| Review finding | Accepted a leading comma in an amount | No implementation to review |

The Q5 parser is not fully accepted code; a review-derived case exposed an invalid comma grouping. Qwen3.8 did not produce a candidate within the ten-minute boundary. The task is synthetic and small, so it does not rank either model's general coding ability. Together with the slower fixture and direct generation, it provides no measured basis to change the Q5 route.

## Qwen3.8-Flash-Next IQ4_NL — deployment candidate; benchmarks not run

Qwen describes Flash-Next as a multimodal MoE with a 125B-parameter language model, 6B active parameters per token, plus 51B n-gram embedding and 4B multi-token-prediction parameters. It combines Gated DeltaNet and Qwen Sparse Attention with a 262,144-token native context; extension to one million tokens uses additional RoPE scaling. These are upstream model-card claims, not local measurements. The [Qwen model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) publishes language, agent, coding, and vision-language evaluation results; those scores do not establish quality or speed for this quantized local deployment.

The selected artifact is the [ggml-org IQ4_NL GGUF](https://huggingface.co/ggml-org/Qwen3.8-Flash-Next-GGUF/tree/052beeaca7bec4a303e59cc7bc630c4f3a1b845d), pinned to revision `052beeaca7bec4a303e59cc7bc630c4f3a1b845d`. Its two files total 102,048,918,944 bytes (about 95.0 GiB); each file has a pinned size and SHA-256 in `ai-commands/install/ai-local-provider/presets/qwen3.8-flash-next.yml`. The deployment preset targets one GB10 with ARM64, CUDA 13, explicit SM 121, and an 8,192-token serving context. The configured local context is much smaller than the model's native context.

The model card declares [Qwen Community License 1.0](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/main/LICENSE). It requires a separate Qwen license for commercial use by a Model-as-a-Service or AI Work Assistant business; its internal-use exception has conditions, including that the model, outputs, and capabilities are not made available to third parties. The current intended use is not as a service; confirm that actual access remains internal before relying on the exception.

**Operational smoke (2026-10-09):** The pinned build passed provider health and one exact-response completion. The gateway advertised `qwen3.8-flash-next-iq4-nl` and returned a separate exact-response completion. The coder service is stopped and disabled for autostart but retained for manual rollback; its model files remain on disk. The new provider and gateway are active and enabled for autostart.

This verifies service load and a basic text completion only. Load time, steady-state memory headroom, direct throughput, multimodal support, tool use, and task quality remain unmeasured. Do not rank it against the Q5 coding route until a separate, controlled evaluation is requested and completed.

## MiniMax M2.7 UD-IQ4_XS

The [official model configuration](https://huggingface.co/MiniMaxAI/MiniMax-M2.7/blob/main/config.json) describes 62 attention layers, eight KV heads, 128 dimensions per head, and a 204,800-token maximum position setting. The pinned [Unsloth UD-IQ4_XS GGUF](https://huggingface.co/unsloth/MiniMax-M2.7-GGUF/tree/d2a05ccf69491b03db0cc40b335aec14bdaf7198/UD-IQ4_XS) totals 108,413,781,312 bytes (100.97 GiB) across four shards. At 65,536 tokens, an FP16 KV cache alone is approximately 15.5 GiB; Q8_0 and Q4_0 KV estimates are 8.23 and 4.36 GiB including quantization block overhead. These estimates exclude runtime buffers, the OS, and other services.

The [official MiniMax M2.7 license](https://huggingface.co/MiniMaxAI/MiniMax-M2.7/blob/main/LICENSE) permits stated personal and other non-commercial uses and requires separate prior written authorization for commercial use. Without that authorization, MiniMax is disqualified for the intended business deployment regardless of speed or memory fit. Check a model's license against the intended use before any future download or installation.

The four shard sizes and local SHA-256 hashes matched the pinned repository's file records. The GX10 had 118.7 GiB available with Q5 and the optional 35B service stopped. Both MiniMax trials used CUDA `llama.cpp` commit `a97cce86a`, full GPU layer offload, flash attention, Jinja template, one slot, `--fit off`, and an actual 65,536-token server slot. Q5 stayed available during download and was stopped for each MiniMax load.

| MiniMax measure | Q8_0 KV | Q4_0 KV |
|---|---:|---:|
| Server initialization to ready | 79.87 s | 74.58 s |
| Available memory after load | 6.66 GiB | 11.06 GiB |
| Available memory after Hermes fixture | 5.75 GiB | About 10 GiB |
| 2K prompt processing | 566 tokens/s | 583 tokens/s |
| 128-token generation | 23.38 tokens/s | 26.08 tokens/s |
| Streaming time to first token | Not measured | 0.982 s |
| Hermes independent output check | PASS | PASS |
| Hermes wall time | 103.49 s | 116.73 s |
| Model API calls | 6 | 9 |

The 2K direct requests used the same review prompt as the Q5/Qwen3.8 comparison, but MiniMax tokenized it to 2,029 tokens. Both 128-token responses hit the cap during reasoning and had no visible answer text. A separate 512-token Q4_0 streaming response also remained in reasoning; the reported time to first token is the first reasoning delta. The server accepted the full 65,536-token slot. Swap-out rose by only five pages during the Q8_0 load and did not rise during either Hermes fixture. These are short task measurements, not proof of sustained full-context use. Q8_0 left a narrow operating margin; Q4_0 provided materially more headroom while retaining the controlled tool-use pass.

The same synthetic parser task used for Q5 and Qwen3.8 was also run against MiniMax with Q4_0 KV. It reached the 600-second limit after editing the target file. The resulting partial parser passed 13/15 independent cases but rejected valid money values without a dollar sign. Hermes had stopped and the model slot was idle before the server was unloaded. This is not accepted code or evidence of a coding-quality advantage over Q5.

**Disposition:** MiniMax M2.7 UD-IQ4_XS is technically feasible on one GX10 at 65,536 tokens with Q4_0 KV and 8.6–11.1 GiB available across the measured load, fixture, and coding run. It passed the controlled file-tools fixture, but took over three times the matched Q5 wall time, and its bounded coding task did not complete acceptably. Qwen3.8 also failed to establish a coding-quality improvement over Q5. MiniMax's commercial-use restriction disqualifies it for the intended business deployment without written authorization. Q5 is the sole active coding model server and remains the default route; Qwen3.8, MiniMax, and the optional 35B are stopped. The Qwen3.8 weights remain on disk. The four pinned MiniMax shards (108,413,781,312 bytes) were deleted after evaluation on explicit authorization.
