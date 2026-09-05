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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
CONF_FILE="${SCRIPT_DIR}/data-dog.command.conf"
if [ -f "$CONF_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi

SERVICE=""
ENVIRONMENT="${DEFAULT_ENV:-dev}"
OPEN_URLS=0
API_LIST=0
QUEUES=()
ENV_EXPLICIT=0
PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"

infer_env() {
  local candidate="${AWS_PROFILE:-${AWS_DEFAULT_PROFILE:-}}"
  case "${candidate,,}" in
    *prod*) echo "prod" ;;
    *test*|*qa*) echo "test" ;;
    *dev*) echo "dev" ;;
    *) echo "${DEFAULT_ENV:-dev}" ;;
  esac
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --env)
      ENVIRONMENT="${2:-}"
      ENV_EXPLICIT=1
      shift 2
      ;;
    --queue)
      QUEUES+=("${2:-}")
      shift 2
      ;;
    --open)
      OPEN_URLS=1
      shift
      ;;
    --api-list)
      API_LIST=1
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Usage:
  ./commands/data-dog/data-dog-monitors.sh --service <service> [--project-dir <path>] [--env <env>] [--queue <queue-name>] [--open] [--api-list]
EOF
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$SERVICE" ]; then
  echo "Missing required --service <service>" >&2
  exit 1
fi

if [ "$ENV_EXPLICIT" -eq 0 ]; then
  ENVIRONMENT="$(infer_env)"
fi

url_encode() {
  if command_python_bootstrap >/dev/null 2>&1; then
    command_python - "$1" <<'PY'
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
  else
    echo "$1" | sed -e 's/%/%25/g' -e 's/:/%3A/g' -e 's/ /%20/g'
  fi
}

open_url() {
  local u="$1"
  if [[ -x "${SCRIPT_DIR}/../browser/browser.command.sh" ]]; then
    "${SCRIPT_DIR}/../browser/browser.command.sh" "$u" >/dev/null 2>&1 || true
  fi
}

support_links() {
  local project_dir="$1"
  local yaml_path

  if [[ -z "$project_dir" ]]; then
    return 0
  fi

  yaml_path="${project_dir}/service.datadog.yaml"
  if [[ ! -f "$yaml_path" ]]; then
    return 0
  fi

  command_python - "$yaml_path" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
slack = ""
opsgenie = ""
in_contacts = False
current_type = None
current_contact = None
in_integrations = False
in_opsgenie = False

def flush_contact():
    global slack, current_type, current_contact
    if current_type == "slack" and current_contact and not slack:
        slack = current_contact
    current_type = None
    current_contact = None

for raw in lines:
    stripped = raw.strip()
    if not stripped or stripped.startswith("#"):
        continue

    indent = len(raw) - len(raw.lstrip(" "))

    if indent == 0:
        if in_contacts:
            flush_contact()
        in_contacts = stripped == "contacts:"
        in_integrations = stripped == "integrations:"
        in_opsgenie = False
        continue

    if in_contacts:
        if indent == 2 and stripped.startswith("- "):
            flush_contact()
            payload = stripped[2:]
            if payload.startswith("type:"):
                current_type = payload.split(":", 1)[1].strip()
            elif payload.startswith("contact:"):
                current_contact = payload.split(":", 1)[1].strip()
            continue
        if indent >= 4 and stripped.startswith("type:"):
            current_type = stripped.split(":", 1)[1].strip()
            continue
        if indent >= 4 and stripped.startswith("contact:"):
            current_contact = stripped.split(":", 1)[1].strip()
            continue

    if in_integrations:
        if indent == 2 and stripped == "opsgenie:":
            in_opsgenie = True
            continue
        if indent == 2 and stripped.endswith(":") and stripped != "opsgenie:":
            in_opsgenie = False
            continue
        if in_opsgenie and indent >= 4 and stripped.startswith("service-url:"):
            opsgenie = stripped.split(":", 1)[1].strip()

flush_contact()

if slack:
    print(f"SLACK={slack}")
if opsgenie:
    print(f"OPSGENIE={opsgenie}")
PY
}

base_query="service:${SERVICE} env:${ENVIRONMENT}"
monitor_query_url="https://app.datadoghq.com/monitors/manage?q=$(url_encode "$base_query")&order=desc"
slo_query="service:${SERVICE}"
slo_query_url="https://app.datadoghq.com/slo/manage?query=$(url_encode "$slo_query")"
SUPPORT_LINKS="$(support_links "$PROJECT_DIR")"
SLACK_URL="$(printf '%s\n' "$SUPPORT_LINKS" | sed -n 's/^SLACK=//p' | head -n1)"
OPSGENIE_URL="$(printf '%s\n' "$SUPPORT_LINKS" | sed -n 's/^OPSGENIE=//p' | head -n1)"

echo "Datadog Monitor Validation"
echo "service: $SERVICE"
echo "env: $ENVIRONMENT"
echo
echo "SLO URL:"
echo "$slo_query_url"
echo
echo "Monitor URL:"
echo "$monitor_query_url"
if [[ -n "$SLACK_URL" || -n "$OPSGENIE_URL" ]]; then
  echo
  echo "Support Links:"
  if [[ -n "$SLACK_URL" ]]; then
    echo "Slack:"
    echo "$SLACK_URL"
  fi
  if [[ -n "$OPSGENIE_URL" ]]; then
    echo
    echo "Opsgenie:"
    echo "$OPSGENIE_URL"
  fi
fi
echo
echo "Checklist:"
echo "- [ ] SLOs present for service and include env=${ENVIRONMENT} entries where expected"
echo "- [ ] ECS/Fargate monitors present and scoped to env=$ENVIRONMENT"
echo "- [ ] Netty monitors present (error-rate, p90 latency)"
echo "- [ ] DynamoDB monitors present for service table"
if [ "${#QUEUES[@]}" -eq 0 ]; then
  echo "- [ ] SQS monitors present (provide --queue for queue-specific links)"
else
  echo "- [ ] SQS monitors present for provided queues"
fi

if [ "${#QUEUES[@]}" -gt 0 ]; then
  echo
  echo "Queue-specific monitor URLs:"
  for q in "${QUEUES[@]}"; do
    q_query="env:${ENVIRONMENT} queue:${q}"
    q_url="https://app.datadoghq.com/monitors/manage?q=$(url_encode "$q_query")&order=desc"
    echo "- $q"
    echo "  $q_url"
    if [ "$OPEN_URLS" -eq 1 ]; then
      open_url "$q_url"
    fi
  done
fi

if [ "$OPEN_URLS" -eq 1 ]; then
  open_url "$slo_query_url"
  open_url "$monitor_query_url"
  if [[ -n "$SLACK_URL" ]]; then
    open_url "$SLACK_URL"
  fi
  if [[ -n "$OPSGENIE_URL" ]]; then
    open_url "$OPSGENIE_URL"
  fi
fi

if [ "$API_LIST" -eq 1 ]; then
  DD_SITE="${DD_SITE:-datadoghq.com}"
  DD_API_KEY="${DD_API_KEY:-}"
  DD_APP_KEY="${DD_APP_KEY:-}"

  if [ -z "$DD_API_KEY" ] || [ -z "$DD_APP_KEY" ]; then
    echo
    echo "Datadog API listing skipped: missing DD_API_KEY and/or DD_APP_KEY."
    exit 0
  fi

  if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    echo
    echo "Datadog API listing skipped: curl and jq are required."
    exit 0
  fi

  api_query="$(url_encode "$base_query")"
  api_url="https://api.${DD_SITE}/api/v1/monitor/search?query=${api_query}"

  echo
  echo "Datadog API monitor list:"
  curl -fsSL \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    "$api_url" \
    | jq -r '
      .monitors[]? | "- [\(.overall_state // "UNKNOWN")] #\(.id) \(.name)"
    '
fi
