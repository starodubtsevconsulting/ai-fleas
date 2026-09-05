#!/usr/bin/env bash

ai_runtime_paths_error() { printf '%s\n' "$*" >&2; return 1; }

ai_rules_root() {
  local root="${1:-}" candidate=""
  if [[ -n "${AI_PROFILE_BUNDLE_ROOT:-}" ]]; then candidate="$AI_PROFILE_BUNDLE_ROOT"
  elif [[ -n "${AI_CONFIG_BUNDLE_ROOT:-}" ]]; then candidate="$AI_CONFIG_BUNDLE_ROOT"
  elif [[ -n "${APP_ROOT:-}" ]]; then candidate="$APP_ROOT"
  elif [[ -n "$root" ]]; then
    root="$(cd "$root" 2>/dev/null && pwd -P)" || return 1
    if [[ -d "$root/ai-config" ]]; then candidate="$root/ai-config"
    elif [[ "$(basename "$root")" == "ai" && -d "$(dirname "$root")/ai-config" ]]; then candidate="$(dirname "$root")/ai-config"
    fi
  fi
  [[ -n "$candidate" && -d "$candidate" ]] || { ai_runtime_paths_error 'AI config bundle directory is required'; return 1; }
  cd "$candidate" && pwd -P
}

ai_sessions_root() { local bundle; bundle="$(ai_rules_root "${1:-}")" || return; printf '%s\n' "$bundle/.local/work-session-state/sessions"; }
ai_current_plan_pointer_path() { local bundle; bundle="$(ai_rules_root "${1:-}")" || return; printf '%s\n' "$bundle/.local/work-session-state/.current-plan-path"; }
ai_current_ui_mode_path() { local bundle; bundle="$(ai_rules_root "${1:-}")" || return; printf '%s\n' "$bundle/.local/work-session-state/.ui-mode"; }
ai_profile_file_path() { local bundle profile="${2:-}"; bundle="$(ai_rules_root "${1:-}")" || return; [[ "$profile" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { ai_runtime_paths_error 'Unsafe profile ID'; return 1; }; printf '%s\n' "$bundle/$profile-work-profile.yml"; }
