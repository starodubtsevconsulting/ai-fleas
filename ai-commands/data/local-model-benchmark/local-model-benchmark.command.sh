#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

usage() {
  cat <<'EOF'
Local model benchmark

Usage:
  local-model-benchmark.command.sh runtime --endpoint URL --model ID --output FILE \
  --machine-label LABEL [--repeat N] [--date YYYY-MM-DD]
  local-model-benchmark.command.sh file-tools --harness hermes|pi \
  --model-directory ID --model ID --deployment ID --endpoint URL [--provider ID] [--date YYYY-MM-DD]

Suites:
  runtime  Measure one fixed short text-completion protocol after warm-up.
  file-tools  Run the shared file-and-shell fixture through exactly one harness.

The runtime suite measures wall time plus server-reported prompt and generation
timings when the endpoint provides them. Tool-use, coding-quality, long-context,
and multimodal suites require their own controlled fixtures and are intentionally
not represented by a runtime score.

The endpoint must be an HTTP(S) URL. Use a localhost endpoint or an SSH tunnel
to the model gateway; never place credentials in this command or its output.
EOF
}

[[ $# -gt 0 ]] || { usage; exit 2; }
action="$1"; shift
case "$action" in help|-h|--help) usage; exit 0 ;; esac
if [[ "$action" == file-tools ]]; then
  harness="" model_directory="" model="" deployment="" provider="local-benchmark" endpoint="" benchmark_date=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --harness|--model-directory|--model|--deployment|--provider|--endpoint|--date)
        [[ $# -ge 2 ]] || { printf 'MISSING_VALUE: %s\n' "$1" >&2; exit 2; }
        case "$1" in
          --harness) harness="$2";; --model-directory) model_directory="$2";; --model) model="$2";; --deployment) deployment="$2";; --provider) provider="$2";; --endpoint) endpoint="$2";; --date) benchmark_date="$2";;
        esac
        shift 2 ;;
      *) printf 'UNKNOWN_OPTION: %s\n' "$1" >&2; exit 2 ;;
    esac
  done
  [[ "$harness" == hermes || "$harness" == pi ]] || { printf '%s\n' 'HARNESS_INVALID: use hermes or pi.' >&2; exit 2; }
  [[ "$model_directory" =~ ^[a-z0-9][a-z0-9._-]*$ && "$model" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ && "$deployment" =~ ^[a-z0-9][a-z0-9._-]*$ && "$provider" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { printf '%s\n' 'FILE_TOOLS_CONFIGURATION_INVALID' >&2; exit 2; }
  [[ "$endpoint" =~ ^https?://[A-Za-z0-9.:-]+(/v1)?/?$ ]] || { printf '%s\n' 'ENDPOINT_INVALID: use an HTTP(S) endpoint with no path or /v1.' >&2; exit 2; }
  [[ -z "$benchmark_date" || "$benchmark_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { printf '%s\n' 'DATE_INVALID: use YYYY-MM-DD.' >&2; exit 2; }
  benchmark_date="${benchmark_date:-$(date +%F)}"
  repository_root="$(cd "$command_dir/../../.." && pwd -P)"
  output="$repository_root/models/$model_directory/benchmarks/$deployment/file-tools-$harness-$benchmark_date.json"
  run_root="${LOCAL_MODEL_BENCHMARK_RUNS_ROOT:-$repository_root/notes/benchmarks/local-models/runs}"
  run_directory="$run_root/$model_directory/$deployment/file-tools-$harness-$benchmark_date"
  mkdir -p "$run_directory" "$(dirname "$output")"
  status="accepted" reason=""
  if [[ "$harness" == pi ]]; then
    if ! "$repository_root/notes/benchmarks/local-models/run-pi-file-tools.sh" "$run_directory" "$model" "$provider" "$endpoint" >"$run_directory/command-output.txt" 2>&1; then
      status="not-accepted"; reason="Pi exited before independent acceptance."
    fi
  else
    profile="benchmark-${model_directory//[^a-z0-9-]/-}-${deployment}-hermes"
    context="$(curl -fsS "${endpoint%/}/models" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const m=JSON.parse(s).data?.[0]?.meta?.n_ctx; process.stdout.write(Number.isInteger(m)?String(m):"8192")}catch{process.stdout.write("8192")}})')"
    if ! env HERMES_PROVIDER_ID="$provider" HERMES_PROVIDER_LABEL="Local benchmark gateway" HERMES_CONTEXT_LENGTH="$context" \
      "$repository_root/ai-commands/system/hermes-agents/setup-hermes-profile.sh" --profile "$profile" --workspace "$run_directory" --endpoint "$endpoint" --model "$model" >"$run_directory/harness-setup.txt" 2>&1; then
      status="blocked"; reason="Hermes benchmark profile setup did not complete."
    elif ! env HERMES_BIN="$HOME/.local/bin/$profile" "$repository_root/notes/benchmarks/local-models/run-hermes-file-tools.sh" "$run_directory" "$model" "$provider" >"$run_directory/command-output.txt" 2>&1; then
      status="blocked"
      if (( context < 64000 )); then
        reason="Hermes requires a served context of at least 64,000 tokens; this endpoint reported $context tokens."
      else
        reason="Hermes could not complete the fixture; inspect the private harness artifact."
      fi
    fi
  fi
  node "$command_dir/record-file-tools.mjs" --output "$output" --model-directory "$model_directory" --model "$model" --deployment "$deployment" --harness "$harness" --status "$status" --run-directory "$run_directory" --reason "$reason" --date "$benchmark_date"
  printf 'RESULT: %s\n' "$output"
  [[ "$status" == accepted ]] || exit 1
  exit 0
fi
[[ "$action" == runtime ]] || { usage; exit 2; }
endpoint="" model="" output="" machine_label="" repeat=5 benchmark_date=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --endpoint|--model|--output|--machine-label|--repeat|--date)
      [[ $# -ge 2 ]] || { printf 'MISSING_VALUE: %s\n' "$1" >&2; exit 2; }
      case "$1" in
        --endpoint) endpoint="$2";; --model) model="$2";; --output) output="$2";; --machine-label) machine_label="$2";; --repeat) repeat="$2";; --date) benchmark_date="$2";;
      esac
      shift 2 ;;
    -h|--help|help) usage; exit 0 ;;
    *) printf 'UNKNOWN_OPTION: %s\n' "$1" >&2; exit 2 ;;
  esac
done
[[ "$endpoint" =~ ^https?://[A-Za-z0-9.:-]+/?$ ]] || { printf '%s\n' 'ENDPOINT_INVALID: use an HTTP(S) endpoint without a path.' >&2; exit 2; }
[[ "$model" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { printf '%s\n' 'MODEL_INVALID' >&2; exit 2; }
[[ "$machine_label" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { printf '%s\n' 'MACHINE_LABEL_INVALID' >&2; exit 2; }
[[ "$repeat" =~ ^[1-9][0-9]*$ ]] && ((repeat <= 20)) || { printf '%s\n' 'REPEAT_INVALID: use 1..20.' >&2; exit 2; }
[[ -z "$benchmark_date" || "$benchmark_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { printf '%s\n' 'DATE_INVALID: use YYYY-MM-DD.' >&2; exit 2; }
[[ "$output" == /* ]] || { printf '%s\n' 'OUTPUT_INVALID: use an absolute output path.' >&2; exit 2; }
mkdir -p "$(dirname "$output")"
node "$command_dir/run.mjs" --endpoint "$endpoint" --model "$model" --output "$output" --machine-label "$machine_label" --repeat "$repeat" --date "${benchmark_date:-auto}"
