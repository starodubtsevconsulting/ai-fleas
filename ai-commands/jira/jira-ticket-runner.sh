#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
CONF_FILE="${JIRA_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"
source "$SCRIPT_DIR/jira-load-config.sh"

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"
FORWARD_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
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

jira_load_machine_config "$CONF_FILE"

if [[ -z "$AI_FLOW_OUTPUT_DIR" ]]; then
  if [[ -n "$AI_FLOW_PROJECT_DIR" ]]; then
    AI_FLOW_OUTPUT_DIR="$AI_FLOW_PROJECT_DIR/.ai/jira"
  else
    AI_FLOW_OUTPUT_DIR="$SCRIPT_DIR/reports"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Jira UI automation requires Node.js. Run ai-commands/install/node/node.sh first." >&2
  exit 1
fi

NEEDS_BROWSER=1
for arg in "${FORWARD_ARGS[@]}"; do
  case "$arg" in
    --validate-only|--help|-h) NEEDS_BROWSER=0 ;;
  esac
done
JIRA_BROWSER_MODE="${JIRA_BROWSER_MODE:-existing-chrome}"
if [[ "$NEEDS_BROWSER" -eq 1 && "$JIRA_BROWSER_MODE" != "existing-chrome" && ! -d "$REPO_DIR/node_modules/@playwright/test" ]]; then
  echo "Jira UI automation requires ai-config dependencies. Run npm install in $REPO_DIR." >&2
  exit 1
fi
if [[ "$NEEDS_BROWSER" -eq 1 && "$JIRA_BROWSER_MODE" == "existing-chrome" ]]; then
  "$SCRIPT_DIR/jira-browser-preflight.sh"
fi

mkdir -p "$AI_FLOW_OUTPUT_DIR"

export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR
export JIRA_BASE_URL="${JIRA_BASE_URL:-https://jira.example.invalid}"
export JIRA_BROWSE_BASE_URL="${JIRA_BROWSE_BASE_URL:-${JIRA_BASE_URL%/}/browse/}"
export JIRA_ISSUE_KEY_PATTERN="${JIRA_ISSUE_KEY_PATTERN:-^[A-Z][A-Z0-9_]*-[0-9]+$}"
export JIRA_STORY_POINTS_FIELD_ID="${JIRA_STORY_POINTS_FIELD_ID:-customfield_10004}"
export JIRA_BROWSER_MODE
export JIRA_BROWSER_USER_DATA_DIR="${JIRA_BROWSER_USER_DATA_DIR:-$HOME/.jira/playwright-profile}"
export JIRA_BROWSER_CHANNEL="${JIRA_BROWSER_CHANNEL:-chrome}"
export JIRA_HEADLESS="${JIRA_HEADLESS:-false}"
export JIRA_AUTH_WAIT_MS="${JIRA_AUTH_WAIT_MS:-180000}"
export JIRA_ACTION_TIMEOUT_MS="${JIRA_ACTION_TIMEOUT_MS:-30000}"
export JIRA_REVIEW_WAIT_MS="${JIRA_REVIEW_WAIT_MS:-5000}"

exec node "$SCRIPT_DIR/jira-ui-e2e.mjs" --output-dir "$AI_FLOW_OUTPUT_DIR" "${FORWARD_ARGS[@]}"
