#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT="" STATUS="" OUTPUT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    --status) STATUS="${2:-}"; shift 2 ;;
    --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
    *) echo "Unknown list-by-status argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$PROJECT" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "list-by-status requires a valid --project" >&2; exit 2; }
[[ -n "$STATUS" && -n "$OUTPUT_DIR" ]] || { echo "list-by-status requires --status and --output-dir" >&2; exit 2; }
"$SCRIPT_DIR/jira-browser-preflight.sh"
mkdir -p "$OUTPUT_DIR"
exec node "$SCRIPT_DIR/jira-list-by-status.mjs" "$PROJECT" "$STATUS" "$OUTPUT_DIR"
