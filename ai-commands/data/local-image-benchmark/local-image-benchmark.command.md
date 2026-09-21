# local-image-benchmark.command

## Purpose

Use `local-image-benchmark` as the human-facing interface for selecting, running, serving, validating, and summarizing local image-generation models. The Python files under the benchmark directory are implementation workers, not separate user commands.

The command exists to keep measurements reproducible, explain each model's purpose and license disposition, and prevent an operator from casually loading a second large model alongside the active one.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Action | Yes | User | `explain`, `candidates`, `run`, `summarize`, `serve`, or `test-stream`. |
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

## Supported Prompts

- “Explain the local image benchmark.”
- “List the image model candidates and what each one is for.”
- “Benchmark this image model after unloading the current model.”
- “Summarize these image benchmark results.”
- “Start the image service for diagnosis.”
- “Test whether image generation resumes after a dropped browser stream.”

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
  --machine-label gx10-128gb \
  --confirm-model-isolated
```

Create a Markdown comparison:

```bash
${AI_COMMANDS_ROOT}/data/local-image-benchmark/local-image-benchmark.command.sh summarize \
  /data/image-benchmarks/runs/*/results.jsonl
```

`serve` is an advanced foreground diagnostic. Normal model switching should use the managed model-mode command, which owns stop/start ordering, readiness checks, and the exactly-one-large-model invariant.
