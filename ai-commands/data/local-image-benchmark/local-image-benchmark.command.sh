#!/usr/bin/env bash
set -euo pipefail

COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$COMMAND_DIR/../../.." && pwd -P)"
BENCHMARK_DIR="${LOCAL_IMAGE_BENCHMARK_CATALOG_DIR:-$REPOSITORY_ROOT/notes/benchmarks/local-image-generation}"
RUNTIME_DIR="$COMMAND_DIR/runtime"
PYTHON_BIN="${LOCAL_IMAGE_BENCHMARK_PYTHON:-python3}"

usage() {
  cat <<'EOF'
Local image benchmark

What it is:
  One user-facing command for the local image-generation benchmark. The Python
  files are internal workers; you should not need to invoke them directly.

Why it exists:
  It keeps candidate selection, evidence collection, summaries, service startup,
  and regression testing consistent and prevents accidental dual-model loading.

Usage:
  local-image-benchmark.command.sh explain
  local-image-benchmark.command.sh candidates
  local-image-benchmark.command.sh run --candidate ID --output-root DIR \
    --confirm-model-isolated [--repeat N] [--case ID] [--seed N] \
    [--machine-label GENERIC_LABEL]
  local-image-benchmark.command.sh summarize RESULTS.jsonl [RESULTS.jsonl ...]
  local-image-benchmark.command.sh serve --confirm-model-isolated \
    [--model MODEL_ID] [--model-revision REVISION] [--dtype TYPE] [--steps N] [--guidance N] \
    [--guidance-parameter guidance_scale|true_cfg_scale|none] [--negative-prompt TEXT] \
    [--policy-preset ID] \
    [--port N] [--output-dir DIR]
  local-image-benchmark.command.sh test-stream
  local-image-benchmark.command.sh help

Actions:
  explain      Describe the workflow and which action to use.
  candidates   List candidate IDs, purpose, capabilities, and license status.
  run          Load one candidate and execute the fixed benchmark corpus.
  summarize    Turn one or more completed results.jsonl files into Markdown.
  serve        Start the OpenAI-compatible image service in the foreground.
  test-stream  Test disconnect/resume behavior without loading model weights.

Safety:
  run and serve load a large model. They require a verified profile/workflow and
  --confirm-model-isolated. Prefer the managed model-mode switch for normal use.
  Never use a hostname, account name, IP address, or personal path as a public
  machine label or in committed benchmark results.
EOF
}

explain() {
  cat <<'EOF'
Use this command for two different jobs:

1. Controlled benchmark: choose a candidate with `candidates`, unload every
   other large model through the managed model-mode switch, then use `run`.
   The runner retains the generated PNGs and machine-readable measurements.

2. Interactive image service: normally use the profile's managed `model-mode`
   switch. Use `serve` only when deliberately running the service in the
   foreground for diagnosis or development.

After one or more runs, use `summarize` to produce a comparison table. Use
`test-stream` after changing browser streaming or resume behavior.

Examples:
  local-image-benchmark.command.sh candidates
  local-image-benchmark.command.sh run --candidate flux2-dev-bf16 \
    --output-root /data/image-benchmarks/runs --repeat 3 \
    --machine-label gx10-128gb --confirm-model-isolated
  local-image-benchmark.command.sh summarize /data/image-benchmarks/runs/*/results.jsonl
EOF
}

require_python() {
  command -v "$PYTHON_BIN" >/dev/null 2>&1 || {
    printf 'ERROR: Python executable not found: %s\n' "$PYTHON_BIN" >&2
    printf 'Set LOCAL_IMAGE_BENCHMARK_PYTHON to the benchmark environment Python.\n' >&2
    exit 69
  }
}

require_catalog() {
  [[ "$BENCHMARK_DIR" == /* && -r "$BENCHMARK_DIR/candidates.json" && -r "$BENCHMARK_DIR/cases.json" ]] || {
    printf 'ERROR: benchmark catalog must be an absolute directory containing candidates.json and cases.json.\n' >&2
    exit 66
  }
}

require_profile() {
  # Read-only help and reporting do not need operational authority. Loading a
  # model does, so only run/serve activate this guard.
  source "$REPOSITORY_ROOT/ai-commands/_runtime/profile/command-profile.guard.sh"
  ai_command_require_profile "local-image-benchmark" || exit $?
}

consume_isolation_confirmation() {
  local confirmed=false item
  FORWARDED_ARGS=()
  for item in "$@"; do
    if [[ "$item" == "--confirm-model-isolated" ]]; then
      confirmed=true
    else
      FORWARDED_ARGS+=("$item")
    fi
  done
  if [[ "$confirmed" != true ]]; then
    cat >&2 <<'EOF'
MODEL_ISOLATION_CONFIRMATION_REQUIRED
This action loads a large image model. First use the managed model-mode command
to unload the currently active large model, verify that only the intended image
model may be resident, then repeat with --confirm-model-isolated.
EOF
    exit 64
  fi
}

list_candidates() {
  require_python
  require_catalog
  "$PYTHON_BIN" - "$BENCHMARK_DIR/candidates.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    candidates = sorted(json.load(handle), key=lambda item: item["priority"])

for item in candidates:
    capabilities = ", ".join(item["capabilities"])
    eligibility = "production eligible" if item["production_eligible"] else "evaluation only"
    print(f'{item["id"]}')
    print(f'  model: {item["model"]}')
    print(f'  purpose: {item["benchmark_role"]}')
    print(f'  capabilities: {capabilities}')
    print(f'  license: {eligibility}; {item["license_disposition"]}')
PY
}

action="${1:-help}"
if [[ $# -gt 0 ]]; then shift; fi

case "$action" in
  help|-h|--help)
    usage
    ;;
  explain)
    explain
    ;;
  candidates)
    [[ $# -eq 0 ]] || { printf 'ERROR: candidates accepts no arguments.\n' >&2; exit 64; }
    list_candidates
    ;;
  run)
    consume_isolation_confirmation "$@"
    require_profile
    require_python
    require_catalog
    exec "$PYTHON_BIN" "$RUNTIME_DIR/run.py" --catalog-root "$BENCHMARK_DIR" ${FORWARDED_ARGS[@]+"${FORWARDED_ARGS[@]}"}
    ;;
  summarize)
    [[ $# -gt 0 ]] || { printf 'ERROR: summarize requires at least one results.jsonl path.\n' >&2; exit 64; }
    require_python
    exec "$PYTHON_BIN" "$RUNTIME_DIR/summarize.py" "$@"
    ;;
  serve)
    consume_isolation_confirmation "$@"
    require_profile
    require_python
    model="black-forest-labs/FLUX.2-dev"
    model_revision=""
    dtype="bfloat16"
    steps="50"
    guidance="4.0"
    guidance_parameter="guidance_scale"
    negative_prompt=""
    policy_preset="unrestricted"
    port="8000"
    output_dir="/outputs"
    set -- ${FORWARDED_ARGS[@]+"${FORWARDED_ARGS[@]}"}
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --model) model="${2:-}"; shift 2 ;;
        --model-revision) model_revision="${2:-}"; shift 2 ;;
        --dtype) dtype="${2:-}"; shift 2 ;;
        --steps) steps="${2:-}"; shift 2 ;;
        --guidance) guidance="${2:-}"; shift 2 ;;
        --guidance-parameter) guidance_parameter="${2:-}"; shift 2 ;;
        --negative-prompt) negative_prompt="${2:-}"; shift 2 ;;
        --policy-preset) policy_preset="${2:-}"; shift 2 ;;
        --port) port="${2:-}"; shift 2 ;;
        --output-dir) output_dir="${2:-}"; shift 2 ;;
        *) printf 'ERROR: unknown serve argument: %s\n' "$1" >&2; exit 64 ;;
      esac
    done
    [[ "$steps" =~ ^[1-9][0-9]*$ ]] || { printf 'ERROR: --steps must be a positive integer.\n' >&2; exit 64; }
    [[ "$port" =~ ^[1-9][0-9]*$ ]] && (( port <= 65535 )) || { printf 'ERROR: --port must be 1..65535.\n' >&2; exit 64; }
    [[ "$guidance_parameter" =~ ^(guidance_scale|true_cfg_scale|none)$ ]] || { printf 'ERROR: --guidance-parameter is invalid.\n' >&2; exit 64; }
    [[ "$policy_preset" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { printf 'ERROR: --policy-preset is invalid.\n' >&2; exit 64; }
    "$PYTHON_BIN" -c 'import uvicorn' >/dev/null 2>&1 || { printf 'ERROR: uvicorn is not installed in the benchmark environment.\n' >&2; exit 69; }
    export IMAGE_MODEL_ID="$model" IMAGE_MODEL_REVISION="$model_revision" IMAGE_DTYPE="$dtype" IMAGE_DEFAULT_STEPS="$steps"
    export IMAGE_DEFAULT_GUIDANCE="$guidance" IMAGE_GUIDANCE_PARAMETER="$guidance_parameter"
    export IMAGE_DEFAULT_NEGATIVE_PROMPT="$negative_prompt" IMAGE_OUTPUT_DIR="$output_dir"
    export IMAGE_POLICY_PRESET="$policy_preset"
    cd "$RUNTIME_DIR"
    exec "$PYTHON_BIN" -m uvicorn serve:app --host 0.0.0.0 --port "$port"
    ;;
  test-stream)
    [[ $# -eq 0 ]] || { printf 'ERROR: test-stream accepts no arguments.\n' >&2; exit 64; }
    require_python
    exec "$PYTHON_BIN" "$RUNTIME_DIR/test_resumable_stream.py"
    ;;
  *)
    printf 'ERROR: unknown action: %s\n\n' "$action" >&2
    usage >&2
    exit 64
    ;;
esac
