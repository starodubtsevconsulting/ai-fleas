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


# hurl-test-runner.sh
# Wrapper to run a single Hurl file with proper service context.
#
# Usage:
#   ./commands/hurl-test-runner/hurl-test-runner.sh \
#     --service-name <svc> \
#     --stage <stage> \
#     --region <region> \
#     --secret-id <secret> \
#     --hurl-file <path> \
#     [--host https://...] [--randomKey abc123] [--batchId BID] [--test-version 1.2.3] [--verbose]

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)

CONF_FILE="${SCRIPT_DIR}/hurl-test-runner.command.conf"
if [[ -f "$CONF_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi

SERVICE_NAME=""
STAGE="${DEFAULT_STAGE:-}"
REGION="${DEFAULT_REGION:-}"
SECRET_ID="${DEFAULT_SECRET_ID:-}"
HURL_FILE=""
HOST=""
EXTRA_ARGS=()

while [[ "${#}" -gt 0 ]]; do
  case "$1" in
    --service-name) SERVICE_NAME="$2"; shift 2;;
    --stage)        STAGE="$2"; shift 2;;
    --region)       REGION="$2"; shift 2;;
    --secret-id)    SECRET_ID="$2"; shift 2;;
    --hurl-file)    HURL_FILE="$2"; shift 2;;
    --host)         HOST="$2"; shift 2;;
    --randomKey|--batchId|--test-version|--output|--verbose|--resolve-only|--admin-groups|--user-groups)
      EXTRA_ARGS+=("$1" "$2"); shift 2;;
    *) echo "Unknown parameter: $1" >&2; exit 1;;
  esac
done

if [[ -z "$SERVICE_NAME" || -z "$STAGE" || -z "$REGION" || -z "$HURL_FILE" ]]; then
  echo "Missing required args: --service-name, --stage, --region, --hurl-file" >&2
  exit 1
fi

# Prefer per-repo hurl-api-caller.sh when available.
REPO_CALLER=""
SEARCH_DIR="${AI_FLOW_PROJECT_DIR:-$PWD}"
while [[ "$SEARCH_DIR" != "/" ]]; do
  if [[ -x "$SEARCH_DIR/smoke-tests/hurl-api-caller.sh" ]]; then
    REPO_CALLER="$SEARCH_DIR/smoke-tests/hurl-api-caller.sh"
    break
  fi
  SEARCH_DIR=$(dirname "$SEARCH_DIR")
done

if [[ -z "$REPO_CALLER" ]]; then
  REPO_CALLER="$ROOT_DIR/commands/smoke-tests/smoke-tests.command-hurl-api-caller.sh"
fi

CMD=("$REPO_CALLER"
  --service-name "$SERVICE_NAME"
  --stage "$STAGE"
  --region "$REGION"
  --hurl-file "$HURL_FILE"
)

if [[ -n "$SECRET_ID" ]]; then
  CMD+=(--secret-id "$SECRET_ID")
fi
if [[ -n "$HOST" ]]; then
  CMD+=(--host "$HOST")
fi
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  CMD+=("${EXTRA_ARGS[@]}")
fi

echo "▶ Running single Hurl test via: $REPO_CALLER"
printf '  %q \\\n' "${CMD[@]}"
echo "==============================================="

"${CMD[@]}"
