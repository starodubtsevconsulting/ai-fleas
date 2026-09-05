#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
REGISTRY_FILE="${SCRIPT_DIR}/../projects/projects-registry.yml"
BROWSER_CMD="${SCRIPT_DIR}/../browser/browser.command.sh"

PROJECT_LABEL=""
TARGET="slack"

usage() {
  cat <<'EOF'
Usage:
  ./commands/slack/slack.command.sh --project <label> [--target slack|alerts|opsgenie|both]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_LABEL="${2:-}"
      shift 2
      ;;
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --project-dir)
      AI_FLOW_PROJECT_DIR="${2:-}"
      shift 2
      ;;
    --output-dir)
      AI_FLOW_OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_LABEL" ]]; then
  echo "Missing required --project <label>" >&2
  exit 1
fi

case "$TARGET" in
  slack|alerts|opsgenie|both) ;;
  *)
    echo "Unsupported --target '$TARGET' (use slack|alerts|opsgenie|both)" >&2
    exit 1
    ;;
esac

if [[ ! -f "$REGISTRY_FILE" ]]; then
  echo "Project registry not found: $REGISTRY_FILE" >&2
  exit 1
fi

mapfile -t resolved < <(command_python - "$REGISTRY_FILE" "$PROJECT_LABEL" <<'PY'
import sys
from pathlib import Path

registry = Path(sys.argv[1]).read_text().splitlines()
label = sys.argv[2]
in_target = False
current = {}

def emit(entry):
    if entry.get("label") == label:
        if entry.get("slack_url"):
            print(f"SLACK={entry['slack_url']}")
        if entry.get("alerts_slack_url"):
            print(f"ALERTS={entry['alerts_slack_url']}")
        if entry.get("opsgenie_url"):
            print(f"OPSGENIE={entry['opsgenie_url']}")

for line in registry:
    if line.startswith("  - label: "):
        if in_target:
            emit(current)
            break
        current = {"label": line.split(": ", 1)[1].strip()}
        in_target = current["label"] == label
        continue
    if not current:
        continue
    if line.startswith("    slack_url: "):
        current["slack_url"] = line.split(": ", 1)[1].strip()
    elif line.startswith("    alerts_slack_url: "):
        current["alerts_slack_url"] = line.split(": ", 1)[1].strip()
    elif line.startswith("    opsgenie_url: "):
        current["opsgenie_url"] = line.split(": ", 1)[1].strip()

if in_target:
    emit(current)
PY
)

SLACK_URL=""
ALERTS_SLACK_URL=""
OPSGENIE_URL=""
for item in "${resolved[@]}"; do
  case "$item" in
    SLACK=*) SLACK_URL="${item#SLACK=}" ;;
    ALERTS=*) ALERTS_SLACK_URL="${item#ALERTS=}" ;;
    OPSGENIE=*) OPSGENIE_URL="${item#OPSGENIE=}" ;;
  esac
done

if [[ -z "$SLACK_URL" && -z "$ALERTS_SLACK_URL" && -z "$OPSGENIE_URL" ]]; then
  echo "Project '$PROJECT_LABEL' not found in registry or no support links are configured." >&2
  exit 1
fi

urls=()
case "$TARGET" in
  slack)
    if [[ -z "$SLACK_URL" ]]; then
      echo "No slack_url configured for project '$PROJECT_LABEL'." >&2
      exit 1
    fi
    urls+=("$SLACK_URL")
    ;;
  alerts)
    if [[ -z "$ALERTS_SLACK_URL" ]]; then
      echo "No alerts_slack_url configured for project '$PROJECT_LABEL'." >&2
      exit 1
    fi
    urls+=("$ALERTS_SLACK_URL")
    ;;
  opsgenie)
    if [[ -z "$OPSGENIE_URL" ]]; then
      echo "No opsgenie_url configured for project '$PROJECT_LABEL'." >&2
      exit 1
    fi
    urls+=("$OPSGENIE_URL")
    ;;
  both)
    if [[ -z "$SLACK_URL" || -z "$OPSGENIE_URL" ]]; then
      echo "Project '$PROJECT_LABEL' must have both slack_url and opsgenie_url configured for --target both." >&2
      exit 1
    fi
    urls+=("$SLACK_URL" "$OPSGENIE_URL")
    ;;
esac

for url in "${urls[@]}"; do
  echo "$url"
done

if [[ -x "$BROWSER_CMD" ]]; then
  "$BROWSER_CMD" "${urls[@]}" >/dev/null 2>&1 || true
fi
