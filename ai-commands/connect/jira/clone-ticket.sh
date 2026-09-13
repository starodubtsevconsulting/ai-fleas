#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [[ $# -lt 1 || "$1" == --* ]]; then
  echo "Usage: clone-ticket.sh ISSUE-KEY [ticket options]" >&2
  exit 2
fi
ISSUE_KEY="$1"
shift
exec "$SCRIPT_DIR/jira-ticket-runner.sh" --clone "$ISSUE_KEY" "$@"
