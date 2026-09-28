#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
fixture_dir="$script_dir/fixtures/hermes-financial-recognizer-coding"

if [[ $# -ne 2 ]]; then
  printf 'usage: %s RUN_DIRECTORY HERMES_PROFILE\n' "$0" >&2
  exit 2
fi

run_dir="$1"
profile="$2"
hermes_bin="${HERMES_BIN:-hermes}"

if [[ -e "$run_dir" ]] && [[ -n "$(find "$run_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  printf 'run directory must be absent or empty: %s\n' "$run_dir" >&2
  exit 2
fi

mkdir -p "$run_dir/recognizers"
cp "$fixture_dir/TASK.md" "$run_dir/TASK.md"
cp "$fixture_dir/starter/recognizers/snow-removal-contract-recognizer.mjs"   "$run_dir/recognizers/snow-removal-contract-recognizer.mjs"

prompt="$(<"$run_dir/TASK.md")"
time_output="$(mktemp "${TMPDIR:-/tmp}/hermes-financial-recognizer-time.XXXXXX")"
trap 'rm -f -- "$time_output"' EXIT

/usr/bin/time   -p   -o "$time_output"   "$hermes_bin" -p "$profile" chat     --oneshot     -q "$prompt"     --usage-file "$run_dir/usage.json"     --in "$run_dir"   | tee "$run_dir/agent-output.txt"

awk '$1 == "real" { print $2; found=1 } END { if (!found) exit 1 }' "$time_output"   >"$run_dir/wall-time-seconds.txt"

node "$fixture_dir/verify.mjs" "$run_dir"

printf 'profile=%s\n' "$profile"
printf 'transport=cli-oneshot\n'
printf 'wall_time_seconds=%s\n' "$(<"$run_dir/wall-time-seconds.txt")"
cat "$run_dir/usage.json"
