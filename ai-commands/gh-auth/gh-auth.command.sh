#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "gh-auth" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
CREDS_FILE="${CREDS_FILE:-$SCRIPT_DIR/../../../ai-config/.creds/creds.json}"
PROFILE="${WORK_PROFILE_ID:-${AI_FLOW_PROFILE:-}}"

while [ $# -gt 0 ]; do
  case "$1" in
    --profile)
      if [ $# -lt 2 ]; then
        echo "Missing value for --profile" >&2
        exit 2
      fi
      PROFILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$PROFILE" ]; then
  echo "Missing work profile. Set WORK_PROFILE_ID / AI_FLOW_PROFILE or pass --profile." >&2
  exit 1
fi

if [ ! -f "$CREDS_FILE" ]; then
  echo "Creds file not found: $CREDS_FILE" >&2
  exit 1
fi

TOKEN="$(command_python - <<PY2
import json
from pathlib import Path
p = Path(${CREDS_FILE@Q})
profile = ${PROFILE@Q}
data = json.loads(p.read_text())
entry = data.get('profiles', {}).get(profile, {})
print(entry.get('gihubToken') or entry.get('codex', {}).get('gihubToken', ''))
PY2
)"

if [ -z "$TOKEN" ]; then
  echo "Missing profiles.$PROFILE.gihubToken in $CREDS_FILE" >&2
  exit 1
fi

printf '%s' "$TOKEN" | gh auth login -h github.com --with-token >/dev/null
gh auth status -h github.com
