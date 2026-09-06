#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(git -C "$CONFIG_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"

PROFILE_ID="${AI_WORK_PROFILE_ID:-example}"
if [ -n "$REPO_ROOT" ] && [ -d "$REPO_ROOT/ai-profile/$PROFILE_ID" ]; then
  APP_ROOT="${AI_PROFILE_BUNDLE_ROOT:-$REPO_ROOT/ai-profile/$PROFILE_ID}"
else
  APP_ROOT="$CONFIG_ROOT"
fi

source "$SCRIPT_DIR/../runtime-paths.sh"
RULES_DIR="$CONFIG_ROOT"
COMMANDS_ROOT="${AI_COMMANDS_ROOT:-$SCRIPT_DIR/..}"
CODEX_MEMORY_DIR="${CODEX_MEMORY_DIR:-$HOME/.codex/memories}"


if [ -z "$REPO_ROOT" ]; then
  echo "SDD guard: not inside a git repository." >&2
  exit 1
fi

STAGED_ONLY="off"
SPEC_PATH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --staged-only)
      STAGED_ONLY="on"
      shift
      ;;
    --spec)
      if [ $# -lt 2 ]; then
        echo "SDD guard: missing value for --spec." >&2
        exit 2
      fi
      SPEC_PATH="$2"
      shift 2
      ;;
    *)
      echo "SDD guard: unknown argument '$1'." >&2
      exit 2
      ;;
  esac
done

CURRENT_PLAN_PTR="$(ai_current_plan_pointer_path "$APP_ROOT")"
if [ ! -f "$CURRENT_PLAN_PTR" ]; then
  echo "SDD guard: missing configured current-plan pointer." >&2
  exit 1
fi

PLAN_PATH="$(tr -d '\r' < "$CURRENT_PLAN_PTR" | head -n1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if [ -z "$PLAN_PATH" ] || [ ! -f "$PLAN_PATH" ]; then
  echo "SDD guard: active session plan is not set or does not exist." >&2
  exit 1
fi

if grep -Eq '^- Session (closed|stopped):' "$PLAN_PATH"; then
  echo "SDD guard: active session is closed. Open/create a session before commit/push." >&2
  exit 1
fi

REPO_KEY="$(printf '%s' "$REPO_ROOT" | sed 's#[/ ]#_#g')"
STATE_FILE="$CODEX_MEMORY_DIR/sdd-resync-${REPO_KEY}.state"
if [ ! -f "$STATE_FILE" ]; then
  echo "SDD guard: missing resync state. Run: $COMMANDS_ROOT/sdd/sdd.command-resync.sh" >&2
  exit 1
fi

STATE_PLAN_PATH="$(grep -E '^plan_path=' "$STATE_FILE" | head -n1 | sed 's/^plan_path=//')"
STATE_HEAD="$(grep -E '^head=' "$STATE_FILE" | head -n1 | sed 's/^head=//')"
STATE_RESYNC_AT="$(grep -E '^resynced_at=' "$STATE_FILE" | head -n1 | sed 's/^resynced_at=//')"
CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"

if [ -z "$STATE_PLAN_PATH" ] || [ "$STATE_PLAN_PATH" != "$PLAN_PATH" ]; then
  echo "SDD guard: plan changed since last resync. Run: $COMMANDS_ROOT/sdd/sdd.command-resync.sh" >&2
  exit 1
fi

if [ -n "$STATE_HEAD" ] && [ "$STATE_HEAD" != "$CURRENT_HEAD" ]; then
  echo "SDD guard: git HEAD changed since last resync. Run: $COMMANDS_ROOT/sdd/sdd.command-resync.sh" >&2
  exit 1
fi

if [ -n "$STATE_RESYNC_AT" ]; then
  RESYNC_EPOCH="$(date -u -d "$STATE_RESYNC_AT" +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$STATE_RESYNC_AT" +%s 2>/dev/null || echo 0)"
  NOW_EPOCH="$(date -u +%s)"
  AGE_SECONDS="$((NOW_EPOCH - RESYNC_EPOCH))"
  if [ "$RESYNC_EPOCH" -eq 0 ] || [ "$AGE_SECONDS" -gt 3600 ]; then
    echo "SDD guard: resync is stale (>60m). Run: $COMMANDS_ROOT/sdd/sdd.command-resync.sh" >&2
    exit 1
  fi
fi

TASK_SCOPE="$(grep -E '^Task Scope:' "$PLAN_PATH" | head -n1 | sed 's/^Task Scope:[[:space:]]*//')"
if [ -z "$TASK_SCOPE" ]; then
  echo "SDD guard: missing 'Task Scope' in active plan. Update plan before commit/push." >&2
  exit 1
fi

PROJECT_SCOPE="$(grep -E '^Project:' "$PLAN_PATH" | head -n1 | sed 's/^Project:[[:space:]]*//')"
if [ -z "$PROJECT_SCOPE" ]; then
  echo "SDD guard: missing 'Project' in active plan. Update plan before commit/push." >&2
  exit 1
fi

if ! grep -Eqi '^- \[x\].*(spec|sdd|contract).*#(docs|design|coding|test)' "$PLAN_PATH"; then
  echo "SDD guard: no checked checklist item proving spec/SDD progress in active plan." >&2
  echo "Add a completed checklist item under '## Progress' with spec evidence before commit/push." >&2
  exit 1
fi

if [ -n "$SPEC_PATH" ]; then
  if [[ "$SPEC_PATH" != /* ]]; then
    SPEC_ABS="$REPO_ROOT/$SPEC_PATH"
  else
    SPEC_ABS="$SPEC_PATH"
    SPEC_PATH="${SPEC_PATH#"$REPO_ROOT"/}"
  fi
  if [ ! -f "$SPEC_ABS" ]; then
    echo "SDD guard: --spec file does not exist: $SPEC_PATH" >&2
    exit 1
  fi
  if ! grep -Fq "$SPEC_PATH" "$PLAN_PATH"; then
    echo "SDD guard: active plan does not reference spec path '$SPEC_PATH'." >&2
    exit 1
  fi
fi

if [ "$STAGED_ONLY" = "on" ]; then
  CHANGED_FILES="$(git -C "$REPO_ROOT" diff --name-only --cached)"
else
  CHANGED_FILES="$(git -C "$REPO_ROOT" status --porcelain | awk '{print $2}')"
fi

if [ -z "$CHANGED_FILES" ]; then
  echo "SDD guard: no changed files; check passed."
  exit 0
fi

PROJECT_SCOPE_CLEAN="${PROJECT_SCOPE%/}"
HAS_SPEC_CHANGE="off"
HAS_SPEC_BACKLINK="off"
HAS_CODE_CHANGE="off"

while IFS= read -r file; do
  [ -z "$file" ] && continue

  if [[ "$file" == docs/specs/*.spec.md ]]; then
    HAS_SPEC_CHANGE="on"
  fi

  if [[ "$file" =~ ^(apps|libs)/.*\.(ts|tsx|js|jsx|html|scss)$ ]]; then
    HAS_CODE_CHANGE="on"
    if [ -f "$REPO_ROOT/$file" ] && grep -Eq 'Spec:[[:space:]]+docs/specs/.+\.spec\.md' "$REPO_ROOT/$file"; then
      HAS_SPEC_BACKLINK="on"
    fi
  fi

  case "$file" in
    ""/*|*.md|.ai-workflow-suite/project.yml|libs/*|docs/specs/*|ai-profile/*|ai-commands/*|ai-workflows/*|scripts/runtime-paths.sh)
      ;;
    *)
      echo "SDD guard: potential drift detected: '$file' is outside allowed scope for current session project '$PROJECT_SCOPE_CLEAN'." >&2
      exit 1
      ;;
  esac
done <<< "$CHANGED_FILES"

if [ "$HAS_CODE_CHANGE" = "on" ] && [ "$HAS_SPEC_CHANGE" = "off" ] && [ "$HAS_SPEC_BACKLINK" = "off" ]; then
  echo "SDD guard: code changed without spec update/backlink evidence." >&2
  echo "Either update docs/specs/*.spec.md or ensure changed primary code contains a 'Spec: docs/specs/...*.spec.md' backlink." >&2
  exit 1
fi

echo "SDD guard: passed (scope + spec + drift checks)."
