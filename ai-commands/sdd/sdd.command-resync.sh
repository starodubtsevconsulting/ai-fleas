#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(git -C "$CONFIG_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"

PROFILE_ID="${AI_WORK_PROFILE_ID:-sc}"
if [ -n "$REPO_ROOT" ] && [ -d "$REPO_ROOT/ai-profile/$PROFILE_ID" ]; then
  APP_ROOT="${AI_PROFILE_BUNDLE_ROOT:-$REPO_ROOT/ai-profile/$PROFILE_ID}"
else
  APP_ROOT="$CONFIG_ROOT"
fi

source "$SCRIPT_DIR/../runtime-paths.sh"
RULES_DIR="$CONFIG_ROOT"
CODEX_MEMORY_DIR="${CODEX_MEMORY_DIR:-$HOME/.codex/memories}"


if [ -z "$REPO_ROOT" ]; then
  echo "SDD resync: not inside a git repository." >&2
  exit 1
fi

CURRENT_PLAN_PTR="$(ai_current_plan_pointer_path "$APP_ROOT")"
if [ ! -f "$CURRENT_PLAN_PTR" ]; then
  echo "SDD resync: missing configured current-plan pointer." >&2
  exit 1
fi

PLAN_PATH="$(tr -d '\r' < "$CURRENT_PLAN_PTR" | head -n1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if [ -z "$PLAN_PATH" ] || [ ! -f "$PLAN_PATH" ]; then
  echo "SDD resync: active plan is not set or missing." >&2
  exit 1
fi

if grep -Eq '^- Session (closed|stopped):' "$PLAN_PATH"; then
  echo "SDD resync: active session is closed." >&2
  exit 1
fi

echo "=== SDD Resync ==="
echo "Plan: $PLAN_PATH"
echo "Task:"
grep -E '^Task:|^Task Scope:|^Project:' "$PLAN_PATH" || true
echo
echo "Top progress items:"
grep -E '^- \[[ x]\] ' "$PLAN_PATH" | tail -n 8 || true
echo
echo "Recent commits:"
git -C "$REPO_ROOT" log -n 5 --date=short --pretty=format:'%h %ad %s' || true
echo

mkdir -p "$CODEX_MEMORY_DIR"
REPO_KEY="$(printf '%s' "$REPO_ROOT" | sed 's#[/ ]#_#g')"
STATE_FILE="$CODEX_MEMORY_DIR/sdd-resync-${REPO_KEY}.state"
CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

{
  echo "resynced_at=$NOW_UTC"
  echo "plan_path=$PLAN_PATH"
  echo "head=$CURRENT_HEAD"
} > "$STATE_FILE"

echo "SDD resync: state updated at $STATE_FILE"
