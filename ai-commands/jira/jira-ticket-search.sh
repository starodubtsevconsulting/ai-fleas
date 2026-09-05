#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT="" ISSUE_TYPE="" SUMMARY="" LABEL="" OUTPUT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    --issue-type) ISSUE_TYPE="${2:-}"; shift 2 ;;
    --summary-exact) SUMMARY="${2:-}"; shift 2 ;;
    --label) LABEL="${2:-}"; shift 2 ;;
    --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
    *) echo "Unknown search argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$PROJECT" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "search requires a valid --project" >&2; exit 2; }
[[ -n "$ISSUE_TYPE" && -n "$SUMMARY" && -n "$LABEL" && -n "$OUTPUT_DIR" ]] || {
  echo "search requires --issue-type, --summary-exact, --label, and --output-dir" >&2
  exit 2
}
"$SCRIPT_DIR/jira-browser-preflight.sh"
mkdir -p "$OUTPUT_DIR"
exec node "$SCRIPT_DIR/jira-ticket-search.mjs" "$PROJECT" "$ISSUE_TYPE" "$SUMMARY" "$LABEL" "$OUTPUT_DIR"
