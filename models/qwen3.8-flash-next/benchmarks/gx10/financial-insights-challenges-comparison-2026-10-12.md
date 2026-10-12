# Financial Insights challenge observations

Both harnesses recovered all requested financial values and expected unknowns from this five-document/six-page corpus. They did not satisfy every canonical classification, literal-evidence and ambiguity requirement. Mechanical extraction prepared four documents and stopped the conflicting-total document for review. This is one exploratory suite per harness, separate from the five repeated baseline pairs.

## Task and evidence boundaries

The example human profile owns the [fictional challenge sources](../../../../ai-profile/example/data/financial-insights-challenges/README.md). Each harness ran six fresh blind page extractions, then five actual mechanical preparation operations and five JSON-aware whole-document requests. Raster, sideways, two-page, missing-currency and conflicting-total forms were included. All 22 full-suite native requests passed transport verification, including two genuine images for the whole two-page document. No records were applied or approved.

The first [Hermes pilot](financial-insights-challenge-hermes-multipage-pilot-2026-10-12.json) attached only one page and failed transport/non-object output. It remains preserved and is excluded from accuracy comparison. The supported quoted-path framing fix was verified against the actual installed collector. Subsequent valid [Hermes](financial-insights-challenge-hermes-multipage-pilot-attempt2-2026-10-12.json) and [Pi](financial-insights-challenge-pi-multipage-pilot-2026-10-12.json) pilots received both pages, extracted 14/14 raw values and passed 10/14 and 11/14 strict fields respectively. Pilot observations do not count as the complete suite.

## Original reference audit and labelled amendment

The executed reference classified three literal provider-status fields as inferred although the source pages print “Provider status: To be processed.” An independent page audit corrected exactly these support annotations to printed, plus reference revision metadata. Source PDFs, transcripts, numeric facts, model answers, prompts and evaluator remain unchanged. The [separate amendment](financial-insights-challenges-reference-amendment-2026-10-12.json) re-scores the same stored answers and native controls; original full-suite/pilot JSON bytes and version1 scores remain intact.

Original reference SHA-256: `529c42be0b91d8bc8082576dcb8c463aa75f8fd4243da84b32b8084623c13261`. Corrected revision 2: `5afe9e183df65b7a692c7f4e04e651d3a57e888eec8b7b1cc706231c1a6f85b9`. The amendment records exact original record hashes, evaluator hash, all current PDF hashes and per-field corrected checks. It starts no inference.

| Full-suite strict fields | Pi | Hermes |
|---|---:|---:|
| Blind pages, original reference |47/67|45/67|
| Blind pages, corrected support reference |50/67|48/67|
| JSON-aware documents, original reference |43/61|40/61|
| JSON-aware documents, corrected support reference |46/61|43/61|

## Separate accuracy dimensions

Financial observations cover dates, periods, amounts/components/totals and currency. A raw observation can be correct while its support label, literal quote or candidate-comparison status is wrong. Canonical semantic checks cover document role, jurisdiction, lifecycle and provider status; they are reported separately.

| Corrected-reference measure | Pi blind pages | Hermes blind pages | Pi contextual | Hermes contextual |
|---|---:|---:|---:|---:|
| Raw visible financial values | 37/37 | 37/37 | 37/37 | 37/37 |
| Raw expected financial unknowns | 11/11 | 11/11 | 1/1 | 1/1 |
| Strict financial fields | 47/48 | 45/48 | 37/38 | 36/38 |
| Raw canonical semantic values | 3/19 | 3/19 | 19/23 | 19/23 |
| Strict canonical semantic fields | 3/19 | 3/19 | 9/23 | 7/23 |

Visible financial values include the literal ambiguous total; correct extraction does not resolve its contradiction. Blind page checks include eleven expected unknowns (fields absent from that page, including unprinted currency). Whole-document checks include one unprinted-currency unknown. Four joint multi-page classifications are scored only in whole-document mode. Consequently, the task denominators differ and must not be pooled as independent observations.

Blind prompts supplied field paths but not the allowed canonical enum vocabulary. Responses such as “submission confirmation,” “Quebec” or “Canadian” fail exact schema mapping, and lifecycle fields can conflate scheduled/provider status. These results expose a task-contract limitation; they do not establish an inability to read amounts or dates. Actual candidate JSON supplies canonical context in the second task, so that task is not independent blind extraction.

Strict evidence failures include plausible but absent source quotations, such as “Obligation only; no payment is evidenced.” Correct values alone therefore do not justify trusting an automatically approved record. Both suites passed only one of six complete blind requests and zero of five complete contextual requests under all strict requirements.

## Specific challenge behavior

- **Mechanical preparation:** four of five documents prepared and matched all 47 reference fields in those four documents, including the raster form through the actual PDF reader’s local Tesseract OCR fallback. The conflicting-total form returned review-required with no fabricated extraction. This safety stop is separate from accuracy; the captured 0/14 absent candidate fields are not treated as wrong extracted amounts.
- **Missing currency:** mechanical preparation inferred CAD from domain context. Both visual tasks correctly returned null for unprinted currency. Pi contextual status was unknown; Hermes used unavailable, failing that strict status requirement while preserving the correct null observation.
- **Conflicting total:** both harnesses, in both tasks, preserved printed 2,300 and independently computed 2,350 with discrepancy=true. Both labelled the total printed rather than ambiguous, and contextual status unavailable rather than ambiguous. Detecting the arithmetic issue did not satisfy the ambiguity contract.
- **Partial-page arithmetic:** Both harnesses falsely flagged the normal two-page document’s second page because visible components summed 110 while the full printed total was 2,330. The other components were on page 1; partial-page extraction must not infer a full-document arithmetic error from their absence.

## Timing and reported usage

| Measure | Pi | Hermes |
|---|---:|---:|
| Full pipeline seconds | 474.083 | 336.184 |
| Rendering seconds | 7.355 | 6.860 |
| Mechanical preparation seconds | 2.356 | 2.385 |
| Blind page task wall seconds | 224.959 | 164.739 |
| Blind page task output tokens | 5354 | 2898 |
| Blind page task input tokens | 13742 | 14464 |
| Blind page task cached input tokens | 320 | 3900 |
| Blind page task output characters | 15520 | 9598 |
| JSON-aware task wall seconds | 239.173 | 159.525 |
| JSON-aware task output tokens | 5750 | 3189 |
| JSON-aware task input tokens | 14173 | 14179 |
| JSON-aware task cached input tokens | 320 | 3900 |
| JSON-aware task output characters | 16834 | 10962 |

Recorded pipeline time includes isolated harness setup, rendering, actual mechanical preparation, native harness subprocess execution and evaluation. It excludes plan resolution, the live model/context/vision preflight, dataset authoring and manual review; the timer starts after the live preflight. The two visual task times include harness startup and inference, rather than isolated server latency. Hermes native summed API durations were 137.427s for blind pages and 148.946s for contextual documents; comparable Pi API duration was unavailable. Usage retains each harness’s reported token/cache accounting.

Hermes completed this single suite in 336.184s and Pi in 474.083s. Output lengths, cache usage and native system context differed. There are no repeat distributions for this challenge suite, so this observed difference does not establish stable causal harness overhead or a general accuracy ranking.

## Execution configuration and snapshots

`qwen3.8-flash-next-iq4-nl`, actual 65,536 context, 2,048 output cap, temperature 0/top_p 1, off/false thinking; fresh isolated native profiles, no tools or auxiliary models. Each full run freshly verified actual live model/context/vision. Reference answers and manual transcripts never entered model context.

[Hermes full record](financial-insights-challenges-hermes-2026-10-12.json): executed commit `4e2eb0fec907e772722228b7c8435431b96b7635`; version `Hermes Agent v0.21.5+7438.gf102b16 (2026.9.24) · upstream f102b16c`; installed revision `f102b16c1fbe73b1fcc40a19d0653fe15a0f1584`.

[Pi full record](financial-insights-challenges-pi-2026-10-12.json): executed commit `4e4ac4641c9b56915d752b93195e83dce2be9b45`; version `1.1.0`. Full records preserve per-request prompt/image hashes and source snapshots; the amendment preserves original record hashes and separate corrected scores. No real financial data or private runtime configuration is published.
