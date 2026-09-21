#!/usr/bin/env bash
set -euo pipefail

action="${1:-}"; requested_mode="${2:-}"; encoded_config="${3:-}"
case "$action" in model-status|switch|unload) ;; *) printf 'INVALID_ACTION: %s\n' "$action" >&2; exit 2 ;; esac
[[ -n "$encoded_config" ]] || { printf '%s\n' 'CONFIGURATION_REQUIRED: encoded model-mode configuration.' >&2; exit 2; }
config_file="$(mktemp /tmp/ai-local-provider-modes.XXXXXX.json)"
trap 'rm -f -- "$config_file"' EXIT
printf '%s' "$encoded_config" | base64 --decode >"$config_file"

records=()
while IFS= read -r record; do records+=("$record"); done < <(python3 - "$config_file" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
for mode, item in data.get("modes", {}).items():
    values = (mode, item.get("manager", ""), item.get("service", ""), item.get("health_url", ""), str(item.get("health_timeout_seconds", "")))
    if any("\t" in value or "\n" in value for value in values):
        raise SystemExit("CONFIGURATION_INVALID: control character in model mode")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", mode):
        raise SystemExit("CONFIGURATION_INVALID: invalid mode")
    print("\t".join(values))
PY
)
((${#records[@]} > 0)) || { printf '%s\n' 'MODEL_MODES_NOT_CONFIGURED' >&2; exit 2; }

systemctl_for() { local manager="$1"; shift; if [[ "$manager" == user ]]; then systemctl --user "$@"; else sudo -n systemctl "$@"; fi; }
health_ready() {
  local health="$1"
  [[ -z "$health" ]] || curl --fail --silent --max-time 5 "$health" >/dev/null 2>&1
}
mode_field() {
  local wanted="$1" field="$2" record mode manager service health timeout
  for record in "${records[@]}"; do
    IFS=$'\t' read -r mode manager service health timeout <<<"$record"
    if [[ "$mode" == "$wanted" ]]; then
      case "$field" in manager) printf '%s' "$manager";; service) printf '%s' "$service";; health) printf '%s' "$health";; timeout) printf '%s' "$timeout";; esac
      return 0
    fi
  done
  return 1
}

active_modes=(); unhealthy_modes=()
status_report() {
  local record mode manager service health timeout state readiness
  active_modes=(); unhealthy_modes=()
  for record in "${records[@]}"; do
    IFS=$'\t' read -r mode manager service health timeout <<<"$record"
    state="$(systemctl_for "$manager" is-active "$service" 2>/dev/null || true)"
    readiness="-"
    if [[ "$state" == active ]]; then
      active_modes+=("$mode")
      if health_ready "$health"; then readiness="ready"; else readiness="not-ready"; unhealthy_modes+=("$mode"); fi
    fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$mode" "$state" "$readiness" "$manager" "$service"
  done
}

if [[ "$action" == model-status ]]; then
  status_report
  if ((${#active_modes[@]} > 1)); then printf 'MODEL_EXCLUSIVITY_VIOLATION: %s\n' "${active_modes[*]}" >&2; exit 12; fi
  if ((${#unhealthy_modes[@]} > 0)); then printf 'MODEL_MODE_NOT_READY: %s\n' "${unhealthy_modes[*]}" >&2; exit 16; fi
  printf 'SUCCESS: active model modes=%s\n' "${active_modes[*]:-none}"
  exit 0
fi

previous_mode=""; status_report >/dev/null
if ((${#active_modes[@]} == 1)); then previous_mode="${active_modes[0]}"; fi
if [[ "$action" == switch ]]; then
  target_manager="$(mode_field "$requested_mode" manager)" || { printf 'MODEL_MODE_NOT_FOUND: %s\n' "$requested_mode" >&2; exit 2; }
  target_service="$(mode_field "$requested_mode" service)"; target_health="$(mode_field "$requested_mode" health)"; target_timeout="$(mode_field "$requested_mode" timeout)"
  target_load_state="$(systemctl_for "$target_manager" show "$target_service" -p LoadState --value 2>/dev/null || true)"
  [[ "$target_load_state" == loaded ]] || { printf 'MODEL_SERVICE_NOT_FOUND: mode %s service %s is not loaded by the %s service manager.\n' "$requested_mode" "$target_service" "$target_manager" >&2; exit 17; }
  if ((${#active_modes[@]} == 1)) && [[ "${active_modes[0]}" == "$requested_mode" ]] && health_ready "$target_health"; then
    printf 'SUCCESS: model mode %s was already active and ready; no reload was needed.\n' "$requested_mode"
    exit 0
  fi
fi
stop_all() {
  local record mode manager service health timeout
  for record in "${records[@]}"; do
    IFS=$'\t' read -r mode manager service health timeout <<<"$record"
    if systemctl_for "$manager" is-active --quiet "$service" 2>/dev/null; then printf 'UNLOADING: model mode %s (%s).\n' "$mode" "$service"; fi
    systemctl_for "$manager" stop "$service" >/dev/null 2>&1 || true
    systemctl_for "$manager" reset-failed "$service" >/dev/null 2>&1 || true
  done
}
stop_all; status_report >/dev/null
((${#active_modes[@]} == 0)) || { printf '%s\n' 'MODEL_UNLOAD_FAILED: a configured model service remains active.' >&2; exit 13; }
if [[ "$action" == unload ]]; then printf '%s\n' 'SUCCESS: all configured model modes are unloaded; installed model artifacts were preserved.'; exit 0; fi

rollback() {
  systemctl_for "$target_manager" stop "$target_service" >/dev/null 2>&1 || true
  systemctl_for "$target_manager" reset-failed "$target_service" >/dev/null 2>&1 || true
  if [[ -n "$previous_mode" && "$previous_mode" != "$requested_mode" ]]; then
    local manager service; manager="$(mode_field "$previous_mode" manager)"; service="$(mode_field "$previous_mode" service)"
    systemctl_for "$manager" start "$service" >/dev/null 2>&1 || true
    printf 'ROLLBACK_ATTEMPTED: restored mode %s\n' "$previous_mode" >&2
  fi
}
printf 'LOADING: model mode %s (%s); readiness timeout %ss.\n' "$requested_mode" "$target_service" "$target_timeout"
if ! systemctl_for "$target_manager" start "$target_service"; then rollback; printf 'MODEL_START_FAILED: %s\n' "$requested_mode" >&2; exit 14; fi
deadline=$((SECONDS + target_timeout))
started_at=$SECONDS; next_progress=$((SECONDS + 15))
while ((SECONDS < deadline)); do
  if systemctl_for "$target_manager" is-active --quiet "$target_service"; then
    if health_ready "$target_health"; then
      status_report >/dev/null
      if ((${#active_modes[@]} == 1)) && [[ "${active_modes[0]}" == "$requested_mode" ]]; then printf 'SUCCESS: model mode %s is active and verified after %ss.\n' "$requested_mode" "$((SECONDS - started_at))"; exit 0; fi
    fi
  elif systemctl_for "$target_manager" is-failed --quiet "$target_service"; then
    rollback
    printf 'MODEL_START_FAILED: mode %s entered the failed state before health verification.\n' "$requested_mode" >&2
    exit 14
  fi
  if ((SECONDS >= next_progress)); then
    printf 'WAITING: model mode %s is loading; elapsed=%ss remaining=%ss.\n' "$requested_mode" "$((SECONDS - started_at))" "$((deadline - SECONDS))"
    next_progress=$((SECONDS + 15))
  fi
  sleep 2
done
rollback; printf 'MODEL_NOT_READY: mode %s failed health verification after %ss.\n' "$requested_mode" "$target_timeout" >&2; exit 15
