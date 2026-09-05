#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POMODORO_PRELUDE_SH="$SCRIPT_DIR/../pomodoro/pomodoro.prelude.sh"
if [[ -x "$POMODORO_PRELUDE_SH" ]]; then
  "$POMODORO_PRELUDE_SH" || true
fi

PROJECT=""
PROJECT_PATH=""
TASK=""
QUESTION=""
ANSWER=""
SESSION=""
ROLE=""
DOC_PATH=""
FINALIZE="false"
GUIDANCE_THRESHOLD="${DIALOG_GUIDANCE_THRESHOLD:-6}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:-}"; shift 2 ;;
    --task)
      TASK="${2:-}"; shift 2 ;;
    --project-path)
      PROJECT_PATH="${2:-}"; shift 2 ;;
    --q|--question)
      QUESTION="${2:-}"; shift 2 ;;
    --a|--answer)
      ANSWER="${2:-}"; shift 2 ;;
    --session)
      SESSION="${2:-}"; shift 2 ;;
    --role)
      ROLE="${2:-}"; shift 2 ;;
    --doc|--doc-path)
      DOC_PATH="${2:-}"; shift 2 ;;
    --finalize|--close)
      FINALIZE="true"; shift 1 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2 ;;
  esac
done

if [[ -z "$PROJECT" || -z "$TASK" || -z "$QUESTION" || -z "$ANSWER" ]]; then
  cat >&2 <<'USAGE'
Usage:
  ./commands/dialog/dialog.command.sh \
    --project "<project>" \
    --project-path "<project-path>" \
    --task "<task>" \
    --q "<question>" \
    --a "<answer>" \
    [--role "<role>"] \
    [--doc-path "<doc-path>"] \
    [--finalize] \
    [--session "<session-id>"]
USAGE
  exit 2
fi

if [[ -z "$SESSION" ]]; then
  SESSION="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
fi

if [[ -z "$ROLE" ]]; then
  LOWER_CONTEXT="$(printf '%s %s' "$QUESTION" "$ANSWER" | tr '[:upper:]' '[:lower:]')"
  if [[ "$LOWER_CONTEXT" =~ (^|[[:space:][:punct:]])architect([[:space:][:punct:]]|$) ]]; then
    ROLE="architect"
  elif [[ "$LOWER_CONTEXT" =~ (^|[[:space:][:punct:]])dev(eloper)?([[:space:][:punct:]]|$) ]]; then
    ROLE="dev"
  else
    ROLE="unspecified"
  fi
fi

PROJECT_DIR_NAME="$(printf '%s' "$PROJECT" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
TASK_DIR_NAME="$(printf '%s' "$TASK" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"

if [[ -n "$PROJECT_PATH" ]]; then
  LOG_BASE="${PROJECT_PATH%/}/.ai/dialog/log"
else
  LOG_BASE="rules/commands/dialog/log"
fi

LOG_DIR="${LOG_BASE}/${PROJECT_DIR_NAME}/${TASK_DIR_NAME}"
LOG_FILE="$LOG_DIR/${SESSION}-dialog.md"
mkdir -p "$LOG_DIR"

if [[ ! -f "$LOG_FILE" ]]; then
  {
    echo "# Dialog Log"
    echo
    echo "- Project: $PROJECT"
    echo "- Task: $TASK"
    echo "- Session: $SESSION"
    echo
    echo "## Dialog"
  } > "$LOG_FILE"
fi

ENTRY_NO="$(grep -E '^[0-9]+\. Q:' "$LOG_FILE" | wc -l | tr -d '[:space:]' || true)"
if [[ -z "$ENTRY_NO" ]]; then
  ENTRY_NO=0
fi
ENTRY_NO=$((ENTRY_NO + 1))

{
  echo "$ENTRY_NO. Q: $QUESTION"
  echo "   A: $ANSWER"
  echo "   Role: #role $ROLE"
} >> "$LOG_FILE"

if (( ENTRY_NO >= GUIDANCE_THRESHOLD )); then
  if ! grep -q '<!-- dialog-guidance-emitted -->' "$LOG_FILE"; then
    {
      echo
      echo "<!-- dialog-guidance-emitted -->"
      echo "## Dialog Guidance"
      echo "- This session has ${ENTRY_NO} Q/A entries."
      echo "- Consider stepping back and writing or refining a specification before continuing the dialog."
      echo "- If the exchange is exploratory and long, consider using a GPT web session to avoid burning local task tokens."
    } >> "$LOG_FILE"
  fi
  echo "Dialog guidance: this session already has ${ENTRY_NO} Q/A entries. Consider moving to a spec update or GPT web session." >&2
fi

if [[ "$FINALIZE" == "true" ]]; then
  if ! grep -q "^## Documentation Sync Proposal$" "$LOG_FILE"; then
    {
      echo
      echo "## Documentation Sync Proposal"
    } >> "$LOG_FILE"
  fi

  {
    echo "- Triggered: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    if [[ -n "$DOC_PATH" ]]; then
      echo "- Target doc: $DOC_PATH"
    else
      echo "- Target doc: [set with --doc-path]"
    fi
    echo "- Suggested update:"
    echo "  - Add or refresh a short FAQ/decisions subsection using the Q/A entries from this dialog session."
    echo "  - Keep the feature doc aligned with the latest constraints, assumptions, and accepted tradeoffs."
  } >> "$LOG_FILE"
fi

echo "Logged dialog entry to: $LOG_FILE"
