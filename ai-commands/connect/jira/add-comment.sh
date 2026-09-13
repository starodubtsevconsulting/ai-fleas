#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONF_FILE="${JIRA_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"
source "$SCRIPT_DIR/jira-load-config.sh"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"
FORWARD_ARGS=()

jira_load_machine_config "$CONF_FILE"

if [[ $# -gt 0 && "$1" != --* ]]; then
  FORWARD_ARGS+=(--issue "$1")
  shift
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      FORWARD_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$AI_FLOW_OUTPUT_DIR" ]]; then
  AI_FLOW_OUTPUT_DIR="${TMPDIR:-/tmp}/ai-config-jira-comment"
fi

NEEDS_BROWSER=1
for arg in "${FORWARD_ARGS[@]}"; do
  case "$arg" in
    --validate-only|--help|-h) NEEDS_BROWSER=0 ;;
  esac
done
if [[ "$NEEDS_BROWSER" -eq 1 ]]; then
  "$SCRIPT_DIR/jira-browser-preflight.sh"
fi

export AI_FLOW_OUTPUT_DIR
export JIRA_BROWSE_BASE_URL="${JIRA_BROWSE_BASE_URL:-${JIRA_BASE_URL:-https://jira.example.invalid}/browse/}"
export JIRA_ISSUE_KEY_PATTERN="${JIRA_ISSUE_KEY_PATTERN:-^[A-Z][A-Z0-9_]*-[0-9]+$}"
export JIRA_ACTION_TIMEOUT_MS="${JIRA_ACTION_TIMEOUT_MS:-30000}"

exec node "$SCRIPT_DIR/jira-comment.mjs" --output-dir "$AI_FLOW_OUTPUT_DIR" "${FORWARD_ARGS[@]}"
