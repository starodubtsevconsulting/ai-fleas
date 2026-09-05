#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
AI_CONFIG_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(dirname "$AI_CONFIG_DIR")"
REGISTRY_FILE="$AI_CONFIG_DIR/commands/projects/projects-registry.yml"

PROJECT_LABEL=""
CURRENT_VERSION=""
CANDIDATE_VERSION=""
REPO_DIR=""
REPORT_FILE=""
OUTPUT_FILE=""
ENVIRONMENT="prod"

usage() {
  cat <<'EOF'
Usage:
  ./commands/prod-deploy/prod-deploy.command.sh \
    --project <label> \
    --current-version <ver> \
    --candidate-version <ver> \
    [--repo-dir <path>] \
    [--report-file <path>] \
    [--output-file <path>] \
    [--env prod]
EOF
}

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

strip_wrapping_quotes() {
  local value="${1:-}"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s\n' "$value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_LABEL="${2:-}"
      shift 2
      ;;
    --current-version)
      CURRENT_VERSION="${2:-}"
      shift 2
      ;;
    --candidate-version)
      CANDIDATE_VERSION="${2:-}"
      shift 2
      ;;
    --repo-dir)
      REPO_DIR="${2:-}"
      shift 2
      ;;
    --report-file)
      REPORT_FILE="${2:-}"
      shift 2
      ;;
    --output-file)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    --env)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$PROJECT_LABEL" || -z "$CURRENT_VERSION" || -z "$CANDIDATE_VERSION" ]]; then
  usage >&2
  exit 2
fi

case "$ENVIRONMENT" in
  prod) ;;
  *)
    echo "prod-deploy currently supports --env prod only" >&2
    exit 2
    ;;
esac

mapfile -t resolved < <(command_python - "$REGISTRY_FILE" "$PROJECT_LABEL" <<'PY'
import sys
from pathlib import Path

registry = Path(sys.argv[1]).read_text().splitlines()
label = sys.argv[2]
current = {}

fields = (
    "app_name",
    "repo_path",
    "repo_url",
    "runbook_url",
    "alerts_slack_url",
    "datadog_service_dashboard_url",
    "datadog_canary_dashboard_url",
    "datadog_version_logs_saved_view_id",
)

def emit(entry):
    if entry.get("label") == label:
        for key in fields:
            if entry.get(key):
                print(f"{key.upper()}={entry[key]}")

for line in registry:
    if line.startswith("  - label: "):
        if current.get("label") == label:
            emit(current)
            sys.exit(0)
        current = {"label": line.split(": ", 1)[1].strip()}
        continue
    if not current:
        continue
    for field in fields:
        prefix = f"    {field}: "
        if line.startswith(prefix):
            current[field] = line.split(": ", 1)[1].strip()

emit(current)
PY
)

APP_NAME=""
REPO_PATH=""
REPO_URL=""
RUNBOOK_URL=""
ALERTS_SLACK_URL=""
DATADOG_SERVICE_DASHBOARD_URL=""
DATADOG_CANARY_DASHBOARD_URL=""
DATADOG_VERSION_LOGS_SAVED_VIEW_ID=""
for item in "${resolved[@]}"; do
  case "$item" in
    APP_NAME=*) APP_NAME="${item#APP_NAME=}" ;;
    REPO_PATH=*) REPO_PATH="${item#REPO_PATH=}" ;;
    REPO_URL=*) REPO_URL="${item#REPO_URL=}" ;;
    RUNBOOK_URL=*) RUNBOOK_URL="${item#RUNBOOK_URL=}" ;;
    ALERTS_SLACK_URL=*) ALERTS_SLACK_URL="${item#ALERTS_SLACK_URL=}" ;;
    DATADOG_SERVICE_DASHBOARD_URL=*) DATADOG_SERVICE_DASHBOARD_URL="${item#DATADOG_SERVICE_DASHBOARD_URL=}" ;;
    DATADOG_CANARY_DASHBOARD_URL=*) DATADOG_CANARY_DASHBOARD_URL="${item#DATADOG_CANARY_DASHBOARD_URL=}" ;;
    DATADOG_VERSION_LOGS_SAVED_VIEW_ID=*) DATADOG_VERSION_LOGS_SAVED_VIEW_ID="${item#DATADOG_VERSION_LOGS_SAVED_VIEW_ID=}" ;;
  esac
done

DATADOG_VERSION_LOGS_SAVED_VIEW_ID="$(strip_wrapping_quotes "$DATADOG_VERSION_LOGS_SAVED_VIEW_ID")"

if [[ -z "$APP_NAME" ]]; then
  echo "No app_name found for project '$PROJECT_LABEL'." >&2
  exit 1
fi

if [[ -z "$REPO_DIR" ]]; then
  if [[ -z "$REPO_PATH" ]]; then
    echo "No repo_path found for project '$PROJECT_LABEL'." >&2
    exit 1
  fi
  REPO_DIR="$ROOT_DIR/$REPO_PATH"
fi

if ! git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repo: $REPO_DIR" >&2
  exit 1
fi

candidate_commit="$("$AI_CONFIG_DIR/commands/support/release-delta-resolve.command.sh" \
  --repo-dir "$REPO_DIR" \
  --candidate "$CANDIDATE_VERSION" \
  --current-prod "$CURRENT_VERSION" | awk -F= '/^candidate_commit=/{print $2}')"

if [[ -z "$candidate_commit" ]]; then
  echo "Unable to resolve candidate commit for $CANDIDATE_VERSION" >&2
  exit 1
fi

if [[ -n "$DATADOG_CANARY_DASHBOARD_URL" ]]; then
  DATADOG_CANARY_DASHBOARD_URL="${DATADOG_CANARY_DASHBOARD_URL//__ENV__/$ENVIRONMENT}"
fi

build_version_logs_url() {
  local version="$1"
  local url="https://app.datadoghq.com/logs?query=$(url_encode "service:${APP_NAME} env:${ENVIRONMENT} version:${version}")&refresh_mode=sliding&stream_sort=desc&viz=stream&live=true"
  if [[ -n "$DATADOG_VERSION_LOGS_SAVED_VIEW_ID" ]]; then
    url="${url}&saved-view-id=${DATADOG_VERSION_LOGS_SAVED_VIEW_ID}"
  fi
  printf '%s\n' "$url"
}

ROLLBACK_WORKFLOW_URL=""
if [[ -n "$REPO_URL" ]]; then
  ROLLBACK_WORKFLOW_URL="${REPO_URL%/}/actions/workflows/rollback.yml"
fi

CURRENT_VERSION_LOGS_URL="$(build_version_logs_url "$CURRENT_VERSION")"
CANDIDATE_VERSION_LOGS_URL="$(build_version_logs_url "$CANDIDATE_VERSION")"

normalize_subject() {
  local sha="$1"
  local subject="$2"

  if [[ "$subject" =~ ^Merge\ pull\ request\ #([0-9]+)\ from\ .*/(.+)$ ]]; then
    local branch="${BASH_REMATCH[2]}"
    branch="${branch//-/ }"
    printf '%s\n' "$branch"
    return 0
  fi

  printf '%s\n' "${subject% (#*}"
}

build_bullets() {
  git -C "$REPO_DIR" log --reverse --first-parent --format='%H|%an|%s' "${CURRENT_VERSION}..${candidate_commit}" | while IFS='|' read -r sha author subject; do
    local pr=""
    if [[ "$subject" =~ \(#([0-9]+)\)$ ]]; then
      pr="${BASH_REMATCH[1]}"
    elif [[ "$subject" =~ ^Merge\ pull\ request\ #([0-9]+)\ from ]]; then
      pr="${BASH_REMATCH[1]}"
    fi
    local title
    title="$(normalize_subject "$sha" "$subject")"
    if [[ -n "$pr" ]]; then
      printf '* %s by %s in %s\n' \
        "$title" \
        "$author" \
        "${REPO_URL%/}/pull/${pr}"
    else
      printf '* %s by %s in %s\n' \
        "$title" \
        "$author" \
        "${REPO_URL%/}/commit/${sha}"
    fi
  done
}

{
  printf 'APP:release: Releasing %s of %s to prod.\n\n' "$CANDIDATE_VERSION" "$PROJECT_LABEL"
  printf '## What'\''s Changed\n'
  build_bullets
  printf '\n'
  [[ -n "$ALERTS_SLACK_URL" ]] && printf 'Release Alerts Channel - %s\n' "$ALERTS_SLACK_URL"
  [[ -n "$ROLLBACK_WORKFLOW_URL" ]] && printf 'Rollback workflow - %s - Rollback version %s\n' "$ROLLBACK_WORKFLOW_URL" "$CURRENT_VERSION"
  [[ -n "$DATADOG_CANARY_DASHBOARD_URL" ]] && printf 'Canary Dashboard - %s\n' "$DATADOG_CANARY_DASHBOARD_URL"
  [[ -n "$DATADOG_SERVICE_DASHBOARD_URL" ]] && printf 'Service Dashboard - %s\n' "$DATADOG_SERVICE_DASHBOARD_URL"
  printf 'Current Version Logs - %s\n' "$CURRENT_VERSION_LOGS_URL"
  printf 'Candidate Version Logs - %s\n' "$CANDIDATE_VERSION_LOGS_URL"
  [[ -n "$RUNBOOK_URL" ]] && printf 'Runbook - %s\n' "$RUNBOOK_URL"
  [[ -n "$REPORT_FILE" ]] && printf 'Deploy Risk Report - %s\n' "$REPORT_FILE"
} > "${OUTPUT_FILE:-/dev/stdout}"
