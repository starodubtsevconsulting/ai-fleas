#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
fixture_dir="$script_dir/fixtures/hermes-file-tools"

if [[ $# -ne 3 ]]; then
  printf 'usage: %s RUN_DIRECTORY MODEL PROVIDER\n' "$0" >&2
  exit 2
fi

run_dir="$1"
model="$2"
provider="$3"
hermes_bin="${HERMES_BIN:-hermes}"

mkdir -p "$run_dir"
cp "$fixture_dir/INPUT.txt" "$fixture_dir/TASK.md" "$run_dir/"
rm -f "$run_dir/NORMALIZED.txt" "$run_dir/REPORT.txt" "$run_dir/usage.json" "$run_dir/wall-time-seconds.txt"

prompt="$(<"$run_dir/TASK.md")"
time_output="$(mktemp "${TMPDIR:-/tmp}/hermes-file-tools-time.XXXXXX")"
trap 'rm -f -- "$time_output"' EXIT

/usr/bin/time \
  -p \
  -o "$time_output" \
  "$hermes_bin" \
    --oneshot "$prompt" \
    --usage-file "$run_dir/usage.json" \
    --model "$model" \
    --provider "$provider" \
    --in "$run_dir"

awk '$1 == "real" { print $2; found=1 } END { if (!found) exit 1 }' "$time_output" >"$run_dir/wall-time-seconds.txt"

"$fixture_dir/verify.sh" "$run_dir"

printf 'wall_time_seconds=%s\n' "$(<"$run_dir/wall-time-seconds.txt")"
cat "$run_dir/usage.json"
