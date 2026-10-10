# local-model-benchmark.command

`local-model-benchmark` contains independent suites for evaluating an already-active local model. The runtime suite measures
runtime behavior through a text-completion endpoint. It sends one
warm-up request followed by repeated fixed short completions, then records wall time and the endpoint's own timing
fields. It does not load, switch, or install models.

## Result format and extraction

The JSON result follows the repository's established model-benchmark record pattern: `schema_version`, `date`, `status`,
`deployment`, `model`, `configuration`, `workload`, `observations`, `invalidating_conditions`, `conclusion`, and
`references`. An Expertise Extractor update must reference this result through `evidence.paths` and retain the result's
narrow scope in `interpretation.does_not_prove`.

## Scope

The `runtime` suite measures short text inference only. It does not establish tool-use reliability, coding quality,
long-context capacity, multimodal capability, or general model quality. Those need separately defined suites and
independent fixtures.

The `file-tools` suite measures one frozen file-and-shell task through one
named harness. Use the same fixture for each harness, then retain each run's
events, wall time, and independent verifier output. Hermes and Pi results are
separate evidence: neither may be used to claim the other harness's behavior.

## Usage

```bash
local-model-benchmark.command.sh runtime \
  --endpoint http://127.0.0.1:8000 \
  --model qwen3.8-flash-next-iq4-nl \
  --machine-label gx10 \
  --date 2026-10-09 \
  --repeat 5 \
  --output /absolute/path/to/result.json
```

Use a loopback endpoint on the machine hosting the gateway, or an SSH tunnel. The result keeps only an endpoint scope
(`loopback` or `network`), never the endpoint address itself.

## Harnessed file-tools usage

The command creates its own ignored run directory and configures the selected
harness for that run. Pi receives an isolated local configuration. Hermes
receives a dedicated `benchmark-<model>-<deployment>-hermes` profile with the
served context reported by the endpoint. The command then writes the sanitized
result itself.

These are neutral benchmark identities only. The command does not select a
workflow, create a Coder or Analyst, join a roster, or alter an existing worker
binding.

Its output name is fixed:

`models/<model-directory>/benchmarks/<deployment>/file-tools-<harness>-<date>.json`

The ignored raw artifacts use the matching path below
`notes/benchmarks/local-models/runs/`. Set `LOCAL_MODEL_BENCHMARK_RUNS_ROOT`
only when the private benchmark-artifact root must live elsewhere.

```bash
local-model-benchmark.command.sh file-tools \
  --harness hermes \
  --model-directory qwen3.8-flash-next \
  --model qwen3.8-flash-next-iq4-nl \
  --deployment gx10 \
  --provider gx10-benchmark \
  --endpoint http://127.0.0.1:8000/v1

local-model-benchmark.command.sh file-tools \
  --harness pi \
  --model-directory qwen3.8-flash-next \
  --model qwen3.8-flash-next-iq4-nl \
  --provider gx10-benchmark \
  --deployment gx10 \
  --endpoint http://127.0.0.1:8000/v1
```

Each result records its exact `harness`. A Pi result does not establish Hermes
behavior, and vice versa.
