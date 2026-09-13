#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

ai_flow_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project-dir" >&2
        exit 2
      fi
      AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
    --output-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --output-dir" >&2
        exit 2
      fi
      AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      ai_flow_args+=("$1")
      shift
      ;;
  esac
done
if [ $# -gt 0 ]; then
  ai_flow_args+=("$@")
fi
set -- "${ai_flow_args[@]}"
export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR


if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required" >&2
  exit 1
fi

PR_REF="${1:-}"
NOTE_INPUT="${2:-}"

if [ -z "$PR_REF" ] || [ -z "$NOTE_INPUT" ]; then
  echo "Usage: $0 <PR_URL_OR_NUMBER> <NOTE_OR_PATH>" >&2
  exit 1
fi

if [ -f "$NOTE_INPUT" ]; then
  NOTE="$(cat "$NOTE_INPUT")"
else
  NOTE="$NOTE_INPUT"
fi

if [ -z "$NOTE" ]; then
  echo "Note content is empty" >&2
  exit 1
fi

BODY="$(gh pr view "$PR_REF" --json body --jq .body)"
UPDATED="${BODY}"$'\n'"${NOTE}"

gh pr edit "$PR_REF" --body "$UPDATED"
