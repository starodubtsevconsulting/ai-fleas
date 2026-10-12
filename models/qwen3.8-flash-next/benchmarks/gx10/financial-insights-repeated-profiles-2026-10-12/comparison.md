# Five paired Financial Insights trials

Both harnesses passed every repeated field check and seeded contradiction. Hermes had shorter observed end-to-end times in all five pairs, while generating fewer output tokens and using more cached input. These measurements describe this task/configuration and do not isolate causal harness overhead.

The [terminal summary](summary.json) and ten linked arm records retain actual fictional outputs, transport controls and hashes. The example human profile owns the [source dataset](../../../../../ai-profile/example/data/financial-insights/README.md); the test harness does not own financial data.

## Conditions and timing

`qwen3.8-flash-next-iq4-nl`, actual context 65,536, output cap 2,048, temperature 0, top_p 1, thinking off/server false. Every arm freshly verified live model, native vision and context. Each arm prepared three original PDFs mechanically, then made seven contextual image requests: three unchanged candidates and four tampered candidates. The same prompt/image signatures and evaluator/configuration code were held constant. Native harness system context remained different.

| Measure per seven-request arm | Pi | Hermes |
|---|---:|---:|
| End-to-end seconds | 265.147 median; 263.181–266.310 | 190.311 median; 184.824–206.691 |
| Visual stage seconds | 258.733 median; 256.234–259.300 | 181.628 median; 176.244–197.608 |
| Reported output tokens | 6143 median; 6077–6204 | 3089 median; 3089–3098 |
| Reported input tokens | 17309 median; 17309–17309 | 18038 median; 18038–18038 |
| Reported cached input tokens | 432 median; 432–432 | 4806 median; 4806–4806 |
| Reported cache-write tokens | 0 median; 0–0 | 0 median; 0–0 |
| Output characters | 17446 median; 17173–17693 | 10899 median; 10899–10952 |

End-to-end population standard deviation was 1.129s for Pi and 7.833s for Hermes. End-to-end quartiles (Q1/median/Q3) were 264.291/265.147/265.912s and 186.014/190.311/190.970s respectively. Output-token population spread was 46.448 for Pi and 3.487 for Hermes. These statistics use five valid arms per profile.

End-to-end time includes setup, copying fictional originals, actual preparation, text evidence preparation, rendering and inference/evaluation. It excludes data generation and manual visual review. The visual stage is subprocess wall time across seven requests, including harness startup and inference; it is not pure server time. Median mechanical-stage time was 1.717s for Pi arms and 1.704s for Hermes arms; this includes the complete preparation/text-reading operation, not isolated PDF-reader speed.

The batch took 2284.667s (38.08 minutes). Hermes native hooks report a median summed API duration of 150.491s per arm. Comparable Pi API latency and actual network request counts were unavailable; seven provider-request hooks per arm were observed. Token/cache figures retain each harness's reported accounting and were not independently re-tokenized.

## Paired order and outcomes

| Pair | Order | Pi seconds | Hermes seconds | Hermes minus Pi | Hermes/Pi |
|---|---|---:|---:|---:|---:|
| 1 | Pi → Hermes | 264.291 ([arm](pair-01-a.json)) | 190.970 ([arm](pair-01-b.json)) | -73.321s | 0.723 |
| 2 | Hermes → Pi | 266.310 ([arm](pair-02-a.json)) | 206.691 ([arm](pair-02-b.json)) | -59.619s | 0.776 |
| 3 | Pi → Hermes | 265.147 ([arm](pair-03-a.json)) | 184.824 ([arm](pair-03-b.json)) | -80.323s | 0.697 |
| 4 | Hermes → Pi | 263.181 ([arm](pair-04-a.json)) | 186.014 ([arm](pair-04-b.json)) | -77.167s | 0.707 |
| 5 | Pi → Hermes | 265.912 ([arm](pair-05-a.json)) | 190.311 ([arm](pair-05-b.json)) | -75.601s | 0.716 |

Each profile passed 415/415 accumulated visual field checks, detecting 30/30 seeded contradictions, with zero false accepts, false rejects, omissions or unknown responses. These are five repetitions of the same **83 field-case checks and six contradictions**, not 415 independent cases or 30 independent defects. All 35 visual requests per profile and all five transport arms passed; no infrastructure, transport or arm-accuracy failures occurred. Mechanical extraction matched all 37 reference fields in each arm (185 repeated checks per profile).

Hermes median full-task time was about 28.2% lower, conditional on this corpus, task and configuration. Its median output was 3,089 tokens versus 6,143 for Pi, and 10,899 versus 17,446 characters. Cached input and native harness context also differed. The experiment does not establish what runtime would be at matched output length, cold cache or identical system context.

## Reproducibility

Executed repository commit: `dfd763da4d72e4472328e9e40ba8277ce53fa690`. Pi version `1.1.0`; Hermes version `Hermes Agent v0.21.5+7438.gf102b16 (2026.9.24) · upstream f102b16c`, installed source revision `f102b16c1fbe73b1fcc40a19d0653fe15a0f1584`.

| Input | SHA-256 |
|---|---|
| federal-confirmation PDF | `f10b3d86dd7fc866aa848b4552d583534c072fb88f7b3f30578dbab4e83122b6` |
| quebec-confirmation PDF | `83b8ecec1986012d4051648d838a74c635053815e69ddca85b7f62a929d1a46d` |
| quebec-obligation PDF | `c969cfd6b372a982e4eb5f8e6cd5d4691e3575efff414dea56d007be72bd7b1b` |
| Shared prompt source | `ec5e3252cc5ea1624ae2949b1be6951a569a6acdc45efe4ccee5c00d35a3517e` |

The summary records full runner, evaluator, adapter, variant, wrapper, reference-fact and per-case prompt/image hashes. Arm records retain the raw reference-file and generator hashes, mechanical implementation hashes and independently observed runtime controls. No real financial source, private transport configuration or raw private logs are published. Earlier single-pair observations remain separate historical evidence; the harder challenge corpus uses a separately measured pipeline.
