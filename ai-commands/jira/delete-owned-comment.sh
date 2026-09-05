#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-${TMPDIR:-/tmp}/ai-config-jira-delete-comment}"

NEEDS_BROWSER=1
for arg in "$@"; do
  [[ "$arg" == --validate-only || "$arg" == --help || "$arg" == -h ]] && NEEDS_BROWSER=0
done
if [[ "$NEEDS_BROWSER" -eq 1 ]]; then
  "$SCRIPT_DIR/jira-browser-preflight.sh"
fi

export AI_FLOW_OUTPUT_DIR
export JIRA_BROWSE_BASE_URL="${JIRA_BROWSE_BASE_URL:-${JIRA_BASE_URL:-https://jira.example.invalid}/browse/}"
export JIRA_ISSUE_KEY_PATTERN="${JIRA_ISSUE_KEY_PATTERN:-^[A-Z][A-Z0-9_]*-[0-9]+$}"
export JIRA_ACTION_TIMEOUT_MS="${JIRA_ACTION_TIMEOUT_MS:-30000}"
exec node "$SCRIPT_DIR/jira-delete-owned-comment.mjs" --output-dir "$AI_FLOW_OUTPUT_DIR" "$@"
