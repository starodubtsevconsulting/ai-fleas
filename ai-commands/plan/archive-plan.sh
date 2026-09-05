#!/usr/bin/env bash
set -euo pipefail

API_URL_DEFAULT="http://127.0.0.1:4300/api/plan/clear"
API_URL="$API_URL_DEFAULT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POMODORO_PRELUDE_SH="$SCRIPT_DIR/../pomodoro/pomodoro.prelude.sh"
if [[ -x "$POMODORO_PRELUDE_SH" ]]; then
  "$POMODORO_PRELUDE_SH" || true
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --api-url)
      if [ $# -lt 2 ]; then
        echo "Missing value for --api-url" >&2
        exit 2
      fi
      API_URL="$2"
      shift 2
      ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  archive-plan.sh [--api-url <url>]

Options:
  --api-url <url>  Plan archive API endpoint (default: http://127.0.0.1:4300/api/plan/clear)
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

curl -sS -X POST "$API_URL" -H 'Content-Type: application/json' -d '{}'
