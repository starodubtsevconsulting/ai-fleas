# Local Model Benchmarks

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

### Current conclusion

Both models completed the baseline tool-use task correctly. Qwen3-Coder-Next is currently the default GX10 worker because it generated at about 2.5× the speed and completed the tested Hermes task about 6.8× faster. The 122B model remains useful as a candidate for harder quality/reasoning comparisons where additional capability may justify lower throughput.

These numbers describe this specific GX10/runtime/configuration and should be treated as an empirical baseline rather than general model performance claims.