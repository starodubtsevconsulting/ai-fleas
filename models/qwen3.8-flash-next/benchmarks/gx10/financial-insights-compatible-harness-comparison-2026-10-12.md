# Matched Financial Insights visual-check trial

On October 12, 2026, native Hermes ran first and Pi ran second against the
same fictional Financial Insights fixture. This is one paired no-tools,
JSON-aware visual-check trial, not a complete tool-driven financial workflow.

Both arms used `qwen3.8-flash-next-iq4-nl`, verified served context 65,536,
output cap 2,048, temperature 0, top-p 1, and disabled thinking. Actual request
observations confirm these controls and one image for each call. All seven
paired task prompt and image hashes match. Original PDF hashes, fixture/code
source hashes, mechanical-engine hashes and variant-manifest hash also match.
The recorded fixture source hashes match Git commit `d62e64ad`.

| Observation | Native Hermes | Pi |
| --- | ---: | ---: |
| Mechanical fields correct | 37/37 | 37/37 |
| Visual runs passed | 7/7 | 7/7 |
| Visual field decisions correct | 83/83 | 83/83 |
| Seeded contradictions detected | 6/6 | 6/6 |
| False accepts / false rejects | 0 / 0 | 0 / 0 |
| Full wall time, seconds | 194.977 | 264.933 |
| Visual-call wall time, seconds | 184.298 | 257.760 |
| Mechanical stage, seconds | 1.790 | 1.745 |
| Reported total tokens | 25,888 | 23,846 |
| Reported input tokens | 18,018 | 17,285 |
| Reported output tokens | 3,100 | 6,147 |
| Reported cache-read tokens | 4,770 | 414 |
| Reported cache-write tokens | 0 | 0 |
| Observed API duration, seconds | 152.828 | Unavailable |
| Visual wall time less API duration, seconds | 31.470 | Unavailable |

Token counters are preserved as reported by each harness; category totals must
not be silently redefined to force identical accounting. Hermes API duration
comes from observed native request hooks. The remaining visual wall time
combines startup, teardown and other overhead; it is not startup time alone.
Pi has no comparable API-duration or first-chunk measurement in this capture.
Full time includes run setup, fictional input copying, real preparation,
source-quote preparation, rendering and inference/evaluation. Fixture generation
and manual visual inspection are excluded.

Hermes completed faster in this pair. Run order, different cache usage, output
length and native system prompts prevent a stable causal harness ranking.
Pi replaces its default system prompt with the benchmark instruction; Hermes
retains native system behavior plus an ephemeral instruction while ignoring
context files. Identical task prompts do not mean identical complete contexts.
Repeat alternating-order trials before generalizing timing or token costs.

Evidence: [native Hermes result](financial-insights-compatible-hermes-matched-64k-2026-10-12.json),
[Pi result](financial-insights-compatible-pi-matched-64k-2026-10-12.json), and
[fixture/reproduction instructions](../../../../notes/benchmarks/local-models/fixtures/financial-insights-compatible/README.md).
The earlier 8,192-context Hermes preflight remains historical blocked evidence.
These runs use fresh isolated harness homes, publish only fictional inputs and
sanitized metadata, and do not alter operational profiles or publish sidecars.
Human review remains pending. The shared server's current runtime context and
any later configuration persistence are separate operational evidence.
