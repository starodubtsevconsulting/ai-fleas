#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
fixture_dir="$script_dir/fixtures/hermes-financial-recognizer-coding"
workspace_root="$(git -C "$script_dir" rev-parse --show-toplevel)"

if [[ $# -ne 2 ]]; then
  printf 'usage: %s RUN_DIRECTORY HERMES_PROFILE\n' "$0" >&2
  exit 2
fi

run_dir="$1"
profile="$2"
hermes_bin="${HERMES_BIN:-hermes}"
target_rel='recognizers/snow-removal-contract-recognizer.mjs'
target="$workspace_root/$target_rel"
starter="$fixture_dir/starter/$target_rel"

if [[ -e "$run_dir" ]] && [[ -n "$(find "$run_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  printf 'run directory must be absent or empty: %s\n' "$run_dir" >&2
  exit 2
fi

if [[ ! -f "$target" ]] || ! cmp -s "$starter" "$target"; then
  printf 'stage the unchanged fixture starter at %s before running\n' "$target" >&2
  exit 2
fi
configured_cwd="$("$hermes_bin" -p "$profile" config get terminal.cwd)"
case "$configured_cwd" in
  ''|'.'|'./'|'auto'|'cwd') ;;
  *)
    if [[ "$(cd "$configured_cwd" 2>/dev/null && pwd -P)" != "$workspace_root" ]]; then
      printf 'Hermes profile terminal.cwd must be the workspace root: %s\n' "$configured_cwd" >&2
      exit 2
    fi
    ;;
esac
mkdir -p "$run_dir/recognizers"
run_dir="$(cd "$run_dir" && pwd -P)"
cp "$fixture_dir/TASK.md" "$run_dir/TASK.md"

prompt="$(<"$run_dir/TASK.md")"
time_output="$run_dir/time-output.txt"
cleanup() {
  if [[ -f "$time_output" ]]; then
    unlink "$time_output"
  fi
}
trap cleanup EXIT

(
  cd "$workspace_root"
  /usr/bin/time -p -o "$time_output" \
    "$hermes_bin" -p "$profile" -t file \
    chat --oneshot --in "$workspace_root" -q "$prompt"
) | tee "$run_dir/agent-output.txt"

cp "$target" "$run_dir/$target_rel"
awk '$1 == "real" { print $2; found=1 } END { if (!found) exit 1 }' "$time_output"   >"$run_dir/wall-time-seconds.txt"
unlink "$time_output"

node "$fixture_dir/verify.mjs" "$run_dir"

printf 'profile=%s\n' "$profile"
printf 'transport=cli-oneshot\n'
printf 'wall_time_seconds=%s\n' "$(<"$run_dir/wall-time-seconds.txt")"
if [[ -f "$run_dir/usage.json" ]]; then
  cat "$run_dir/usage.json"
else
  printf 'usage_file=unavailable (inspect Hermes session logs)\n'
fi
