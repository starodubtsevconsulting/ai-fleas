#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
command_path="$script_dir/cloudflare.command.sh"
declare -a children=()

stop_children() {
  local pid
  for pid in "${children[@]:-}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap stop_children INT TERM EXIT

run_provider() {
  local provider_id="$1" delay=1 result
  while true; do
    printf '[%s] starting Cloudflare connector\n' "$provider_id"
    set +e
    CLOUDFLARE_PROVIDER_ID="$provider_id" "$command_path" run-tunnel
    result=$?
    set -e
    printf '[%s] connector exited with status %s; restarting in %ss\n' "$provider_id" "$result" "$delay" >&2
    sleep "$delay"
    (( delay < 30 )) && delay=$((delay * 2))
    (( delay > 30 )) && delay=30
  done
}

targets_output="$($command_path list-targets)"
[[ -n "$targets_output" ]] || { printf 'No Cloudflare provider targets are configured.\n' >&2; exit 2; }
autostart="${CLOUDFLARE_UI_AUTOSTART:-all}"
while IFS= read -r provider_id; do
  [[ -n "$provider_id" ]] || continue
  if [[ "$autostart" != all ]]; then
    case ",$autostart," in
      *",$provider_id,"*) ;;
      *) continue ;;
    esac
  fi
  run_provider "$provider_id" &
  children+=("$!")
done <<<"$targets_output"

((${#children[@]} > 0)) || { printf 'No configured providers matched CLOUDFLARE_UI_AUTOSTART.\n' >&2; exit 2; }

wait
