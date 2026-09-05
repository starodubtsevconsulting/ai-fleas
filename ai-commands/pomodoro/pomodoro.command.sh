#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ROOT_DEFAULT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AI_ROOT="${AI_FLOW_PROJECT_DIR:-$AI_ROOT_DEFAULT}"
CURRENT_PLAN_POINTER_PATH="$AI_ROOT/session-root/.current-plan-path"
if [[ -f "$CURRENT_PLAN_POINTER_PATH" ]]; then
  CURRENT_PLAN_PATH="$(tr -d '\r' < "$CURRENT_PLAN_POINTER_PATH" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
else
  CURRENT_PLAN_PATH=""
fi
if [[ -n "$CURRENT_PLAN_PATH" ]]; then
  SESSION_DIR="$(cd -- "$(dirname -- "$CURRENT_PLAN_PATH")" && pwd)"
  POMODORO_STATE_PATH="$SESSION_DIR/pomodoro/pomodoro.state.json"
else
  POMODORO_STATE_PATH=""
fi
if [[ $# -gt 0 && "$1" != "--status" ]]; then
  echo "Pomodoro command is read-only; use --status to read state." >&2
  exit 2
fi

if [[ -z "$POMODORO_STATE_PATH" || ! -f "$POMODORO_STATE_PATH" ]]; then
  echo "{}"
  exit 0
fi

cat "$POMODORO_STATE_PATH"
