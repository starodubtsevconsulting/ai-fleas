# local-image-benchmark.command

## Purpose

Use `local-image-benchmark` as the human-facing interface for selecting, running, serving, validating, and summarizing
local image-generation models. Reusable Python/container implementation lives under this command's `runtime/` directory;
deployable service and environment templates live under `assets/`. Benchmark directories contain catalogs and evidence,
not executable command implementations.

The command defaults to the repository's local image-generation catalog. Set
`LOCAL_IMAGE_BENCHMARK_CATALOG_DIR` to another absolute directory containing `candidates.json` and `cases.json` when a
profile owns a separate catalog; runtime code remains shared.

The command exists to keep measurements reproducible, explain each model's purpose and license disposition, and prevent an operator from casually loading a second large model alongside the active one.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Action | Yes | User | `explain`, `candidates`, `run`, `summarize`, `serve`, `test-stream`, or `evaluate-policy`. |
| Active AI Profile and workflow | For `run` and `serve` | Host activation | Authorizes an operation that loads a large model. |
| `--confirm-model-isolated` | For `run` and `serve` | User | Confirms the managed model-mode switch has unloaded any conflicting large model. |
| Candidate and output root | For `run` | User | Candidate ID and private directory where retained evidence is written. |
| Completed JSONL files | For `summarize` | User | One or more benchmark result files. |
| `LOCAL_IMAGE_BENCHMARK_PYTHON` | Optional | Environment | Python executable from the isolated benchmark/container environment; defaults to `python3`. |

Use `candidates` before a run. It prints the stable ID, underlying model, benchmark purpose, capabilities, and license status for every configured candidate.

## Outputs

| Output | Destination | Description |
|---|---|---|
| Plain-language guidance | Terminal | Workflow, examples, candidate purpose, and license information. |
| Timestamped benchmark evidence | Private output root | Environment evidence, package versions, JSONL measurements, and retained PNGs. |
| Markdown summary | Standard output | Comparison table suitable for a benchmark report. |
| Foreground HTTP service | Selected local runtime | OpenAI-compatible image and browser-chat endpoints. |
| Regression result | Terminal | Pass/fail evidence for browser disconnect and resume behavior. |

Public results must use generic machine labels and portable paths. Never commit tokens, hostnames, IP addresses, account names, private service URLs, secret identifiers, or personal filesystem paths.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `data/local-image-benchmark/local-image-benchmark.command.sh` | Shell executable | Read-only help/reporting can run directly. `run` and `serve` require an activated profile/workflow in which this command is registered. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used. The executable also permits direct read-only help and reporting, but never bypasses profile activation for model-loading actions.

Committed configuration template: `local-image-benchmark/local-image-benchmark.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

Policy deployment is split deliberately:

- `policy_evaluators` defines reusable profile-owned evaluator resources, including the host reference, endpoint, model,
  credential-file binding, and runtime allocation;
- `workflow_policy_bindings` makes each workflow opt into an evaluator, policy profile, and input/output gates explicitly;
- an unlisted workflow inherits no policy binding from another workflow;
- the profile/platform adapter renders the selected binding into the evaluator and generation-service environments. The
  portable command supplies the contract and templates, but no deployment host, evaluator model, or policy default.

This permits two workflows in the same profile to reuse one evaluator while selecting different policy profiles and gate
settings. It also permits a workflow to remain unbound until its owner makes that choice explicitly.

The portable runtime uses `local-image-generator@.service`; the instance name selects a profile-owned environment file
under `~/.config/ai-fleas/image-generators/`. The unit has no host or model identity. Its launcher selects `nvidia`,
`rocm`, or `cpu` from `IMAGE_ACCELERATOR`, and the profile supplies the runtime image, model, mounts, output directory,
and policy binding. Files under `assets/env/presets/` are optional model examples, not services or automatic defaults.
Large-model conflicts and switch ordering remain responsibilities of the profile's managed model-mode controller.

## Supported Prompts

- “Explain the local image benchmark.”
- “List the image model candidates and what each one is for.”
- “Benchmark this image model after unloading the current model.”
- “Summarize these image benchmark results.”
- “Start the image service for diagnosis.”
- “Test whether image generation resumes after a dropped browser stream.”
- “Evaluate the semantic policy service against the adversarial and benign corpus.”

## Usage

```bash
${AI_COMMANDS_ROOT}/data/local-image-benchmark/local-image-benchmark.command.sh explain
${AI_COMMANDS_ROOT}/data/local-image-benchmark/local-image-benchmark.command.sh candidates
```

Run a controlled candidate after using the managed model-mode switch to unload the other large model:

```bash
${AI_COMMANDS_ROOT}/data/local-image-benchmark/local-image-benchmark.command.sh run \
  --candidate flux2-dev-bf16 \
  --output-root /data/image-benchmarks/runs \
  --repeat 3 \
  --machine-label example-image-host \
  --confirm-model-isolated
```

Create a Markdown comparison:

```bash
${AI_COMMANDS_ROOT}/data/local-image-benchmark/local-image-benchmark.command.sh summarize \
  /data/image-benchmarks/runs/*/results.jsonl
```

`serve` is an advanced foreground diagnostic. Normal model switching should use the managed model-mode command, which owns stop/start ordering, readiness checks, and the exactly-one-large-model invariant.

Repository models may be pinned with `--model-revision`. Guidance behavior is explicit and configurable through
`--guidance-parameter guidance_scale|true_cfg_scale|none`; pipelines such as Qwen-Image that use true CFG may also set
`--negative-prompt`. These values are passed to the generic service rather than inferred from a model name.

Interactive services may select a reusable generation policy with `--policy-preset ID` or
`IMAGE_POLICY_PRESET`; the default `unrestricted` preset preserves prior behavior. Policy files live beside the shared
runtime in `runtime/policies/` and may compose a prompt prefix/suffix, supply a non-overridable negative prompt, and
reject configured request-text patterns before inference. `education-child` is the first audience-oriented preset.
The deterministic layer is not guaranteed content-safety enforcement. Phase 2 can additionally enable semantic input
and output decisions with `--semantic-input true`, `--semantic-output true`, and `--moderation-url URL` (or the
equivalent `IMAGE_POLICY_*` environment variables). Both layers consume the same selected profile. A protected service
with an enabled semantic gate fails startup when its decision endpoint or semantic policy intent is missing, and fails
closed when a decision is unavailable, malformed, or uncertain. Candidate images remain in memory and are not saved or
returned until output moderation allows release. Model lifecycle remains owned by
`install-ai-local-provider`; the selected systemd mode supplies the policy environment at initialization.

Managed interactive services should configure `IMAGE_DEFAULT_SIZE`, request ceilings (`IMAGE_MAX_WIDTH`,
`IMAGE_MAX_HEIGHT`, `IMAGE_MAX_PIXELS`, and `IMAGE_MAX_STEPS`), and two host-memory thresholds. Requests are rejected
before generation below `IMAGE_MIN_AVAILABLE_BYTES`. While CUDA inference is running, the worker samples host
`MemAvailable`; below `IMAGE_EMERGENCY_AVAILABLE_BYTES` it exits so systemd can release GPU/unified memory and restart
the isolated worker instead of allowing the host to become unreachable. `IMAGE_EXIT_ON_MEMORY_EMERGENCY=false` is
available for diagnostics only. Completed and failed requests can run garbage collection and release unused CUDA
cache. Cache release is controlled by `IMAGE_RELEASE_CACHE_AFTER_GENERATION`; its default is `false` so existing service
modes keep their prior caching behavior unless they explicitly opt in.

`evaluate-policy --endpoint URL` runs `runtime/moderation-cases.json` against a configured semantic decision service.
For private local deployments, `runtime/ollama_policy_service.py` and the `ai-policy-evaluator.service` template provide
an authenticated narrow adapter around a loopback-only Ollama model. GPU-layer offload and model retention are explicit
operator settings; defaults remain CPU-only and unload-after-request so installation does not silently consume GPU
capacity.
The public corpus includes explicit requests, paraphrases, euphemisms, misspellings, obfuscation, prompt injection,
seven declared languages, benign prompts, and sensitive-but-allowed boundary cases. The JSON report contains case IDs,
decisions, bounded reason codes, and latency but never repeats prompt text. Treat it as input-gate evidence only; image
output evaluation still requires the live private-candidate matrix documented in `phase2-validation.md`.
