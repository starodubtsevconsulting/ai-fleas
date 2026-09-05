#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ISSUE_KEY="${1:-}"
shift || true
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
    *) echo "Unknown get argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$OUTPUT_DIR" ]] || { echo "get requires --output-dir DIR" >&2; exit 2; }
"$SCRIPT_DIR/jira-browser-preflight.sh"
mkdir -p "$OUTPUT_DIR"
exec node "$SCRIPT_DIR/jira-ticket-read.mjs" "$ISSUE_KEY" "$OUTPUT_DIR"
