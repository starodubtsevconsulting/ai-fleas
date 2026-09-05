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


# data-dog.sh
# Usage:
#   ./commands/data-dog/data-dog.sh --service <service> [--env dev] [--range 15m|1h|1d|1w] [--mode logs|livetail] [--errors-only] [--print-only]

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/../command-python.setup.sh"
CONF_FILE="${SCRIPT_DIR}/data-dog.command.conf"
if [[ -f "$CONF_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi

SERVICE=""
ENVIRONMENT="${DEFAULT_ENV:-dev}"
RANGE="${DEFAULT_RANGE:-15m}"
MODE="${DEFAULT_MODE:-livetail}"
PRINT_ONLY=0
ERRORS_ONLY=0
ENV_EXPLICIT=0

infer_env() {
  local candidate="${AWS_PROFILE:-${AWS_DEFAULT_PROFILE:-}}"
  case "${candidate,,}" in
    *prod*) echo "prod" ;;
    *test*|*qa*) echo "test" ;;
    *dev*) echo "dev" ;;
    *) echo "${DEFAULT_ENV:-dev}" ;;
  esac
}

while [[ "${#}" -gt 0 ]]; do
  case "$1" in
    --service) SERVICE="$2"; shift 2;;
    --env) ENVIRONMENT="$2"; ENV_EXPLICIT=1; shift 2;;
    --range) RANGE="$2"; shift 2;;
    --mode) MODE="$2"; shift 2;;
    --errors-only) ERRORS_ONLY=1; shift 1;;
    --print-only) PRINT_ONLY=1; shift 1;;
    *) echo "Unknown parameter: $1" >&2; exit 1;;
  esac
done

if [[ -z "$SERVICE" ]]; then
  echo "Missing required --service <service>" >&2
  exit 1
fi

if [[ "$ENV_EXPLICIT" -eq 0 ]]; then
  ENVIRONMENT="$(infer_env)"
fi

QUERY="env:${ENVIRONMENT} AND service:${SERVICE}"
if [[ "$ERRORS_ONLY" -eq 1 ]]; then
  QUERY="${QUERY} -status:(warn OR info)"
fi

range_to_ms() {
  case "$1" in
    15m) echo $((15*60*1000));;
    1h)  echo $((60*60*1000));;
    1d)  echo $((24*60*60*1000));;
    1w)  echo $((7*24*60*60*1000));;
    *) echo "";;
  esac
}

RANGE_MS="$(range_to_ms "$RANGE")"
if [[ -z "$RANGE_MS" ]]; then
  echo "Unsupported --range '$RANGE' (use 15m|1h|1d|1w)" >&2
  exit 1
fi

NOW_MS=$(( $(date +%s) * 1000 ))
FROM_TS=$(( NOW_MS - RANGE_MS ))
TO_TS="$NOW_MS"

encode() {
  if command_python_bootstrap >/dev/null 2>&1; then
    command_python - <<'PY' "$1"
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
  else
    echo "$1" | sed -e 's/%/%25/g' -e 's/:/%3A/g' -e 's/ /%20/g'
  fi
}

ENCODED_QUERY="$(encode "$QUERY")"
if [[ "$MODE" == "livetail" ]]; then
  BASE_URL="https://app.datadoghq.com/logs/livetail"
  STORAGE="driveline"
else
  BASE_URL="https://app.datadoghq.com/logs"
  STORAGE="hot"
fi

URL="${BASE_URL}?query=${ENCODED_QUERY}&agg_m=count&agg_m_source=base&agg_t=count&cols=host%2Cservice&messageDisplay=inline&refresh_mode=sliding&storage=${STORAGE}&stream_sort=desc&viz=stream&from_ts=${FROM_TS}&to_ts=${TO_TS}&live=true"

echo "$URL"

if [[ "$PRINT_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ -x "${SCRIPT_DIR}/../browser/browser.command.sh" ]]; then
  "${SCRIPT_DIR}/../browser/browser.command.sh" "$URL" >/dev/null 2>&1 || true
else
  echo "Browser command not found: ${SCRIPT_DIR}/../browser/browser.command.sh"
  echo "$URL"
fi
