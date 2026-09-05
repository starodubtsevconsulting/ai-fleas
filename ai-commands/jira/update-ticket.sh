#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [[ $# -lt 1 || "$1" == --* ]]; then
  echo "Usage: update-ticket.sh ISSUE-KEY --description-file FILE [--summary TEXT] [--submit|--validate-only]" >&2
  exit 2
fi
ISSUE_KEY="$1"
shift
exec "$SCRIPT_DIR/jira-ticket-runner.sh" --update "$ISSUE_KEY" "$@"
