#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
command_path="${CLOUDFLARE_COMMAND_PATH:-$script_dir/cloudflare.command.sh}"
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
  local provider_id="$1" delay=1 result desired
  while true; do
    while true; do
      if ! desired="$(CLOUDFLARE_PROVIDER_ID="$provider_id" "$command_path" controller-state)"; then
        printf '[%s] desired state unavailable; refusing to start and retrying in 5s\n' "$provider_id" >&2
        sleep 5
        continue
      fi
      [[ "$desired" == *'desired: stopped'* ]] || break
      sleep 1
      delay=1
    done
    printf '[%s] starting Cloudflare connector\n' "$provider_id"
    set +e
    CLOUDFLARE_PROVIDER_ID="$provider_id" "$command_path" run-tunnel
    result=$?
    set -e
    if ! desired="$(CLOUDFLARE_PROVIDER_ID="$provider_id" "$command_path" controller-state)"; then
      printf '[%s] desired state unavailable after connector exit; refusing restart and retrying in 5s\n' "$provider_id" >&2
      sleep 5
      continue
    fi
    if [[ "$desired" == *'desired: stopped'* ]]; then
      printf '[%s] connector is intentionally stopped; waiting for Start\n' "$provider_id"
      delay=1
      continue
    fi
    printf '[%s] connector exited with status %s; restarting in %ss\n' "$provider_id" "$result" "$delay" >&2
    sleep "$delay"
    (( delay < 30 )) && delay=$((delay * 2))
    (( delay > 30 )) && delay=30
  done
}

targets_output="$($command_path list-targets)"
[[ -n "$targets_output" ]] || { printf 'No Cloudflare server targets are configured.\n' >&2; exit 2; }
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
