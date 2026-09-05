#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ROOT_DEFAULT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AI_ROOT="${AI_FLOW_PROJECT_DIR:-$AI_ROOT_DEFAULT}"

TITLE=""
ROLE=""
WANT=""
SO_THAT=""
PROJECT_ID=""
PROFILE_ID="${WORK_PROFILE_ID:-work}"
SLUG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title|--name)
      TITLE="${2:-}"; shift 2 ;;
    --role)
      ROLE="${2:-}"; shift 2 ;;
    --want)
      WANT="${2:-}"; shift 2 ;;
    --so-that|--so)
      SO_THAT="${2:-}"; shift 2 ;;
    --project)
      PROJECT_ID="${2:-}"; shift 2 ;;
    --profile|--profile-id)
      PROFILE_ID="${2:-}"; shift 2 ;;
    --slug)
      SLUG="${2:-}"; shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2 ;;
  esac
done

if [[ -z "$TITLE" ]]; then
  cat >&2 <<'USAGE'
Usage:
  ./commands/worklog/worklog.command.sh \
    --title "Story title" \
    [--role "dev"] \
    [--want "goal"] \
    [--so-that "benefit"] \
    [--project "project-id-or-path"] \
    [--profile "sc"] \
    [--slug "custom-slug"]
USAGE
  exit 2
fi

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -cs 'a-z0-9._-' '-' \
    | sed -e 's/^-\+//' -e 's/-\+$//'
}

if [[ -z "$SLUG" ]]; then
  SLUG="$(slugify "$TITLE")"
fi

if [[ -z "$SLUG" ]]; then
  echo "Unable to derive slug from title." >&2
  exit 2
fi

BACKLOG_DIR="${AI_BACKLOG_ROOT:-${AI_SESSIONS_ROOT:-$AI_ROOT/.local/work-session-state}}/$PROFILE_ID/backlog"
mkdir -p "$BACKLOG_DIR"

FILE_PATH="$BACKLOG_DIR/${SLUG}-story.md"

STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
WORKFLOW_NAME="${WORKFLOW_ID:-${AI_FLOW_WORKFLOW_ID:-dev}}"
ROLE_TEXT="${ROLE:-<role>}"
WANT_TEXT="${WANT:-<goal>}"
SO_THAT_TEXT="${SO_THAT:-<benefit>}"

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="${AI_FLOW_PROJECT_DIR:-ai}"
fi

PROJECT_NAME="$(basename "$PROJECT_ID")"

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

cat <<'EOT' > "$FILE_PATH"
# __TITLE__

- Status: todo
- Created: __STAMP__
- Profile: __PROFILE__
- Workflow: __WORKFLOW__
- Project: __PROJECT__
- Project Name: __PROJECT_NAME__
- Source: worklog

## Story
As a __ROLE__ I want __WANT__ so that __SO_THAT__.

## Plan
- [ ] #design
- [ ] #coding
- [ ] #test
- [ ] #docs

## Impl Details
-

## Notes
-

## Acceptance Criteria
-
EOT

sed -i \
  -e "s|__TITLE__|$(escape_sed "$TITLE")|" \
  -e "s|__STAMP__|$STAMP_UTC|" \
  -e "s|__PROFILE__|$(escape_sed "$PROFILE_ID")|" \
  -e "s|__WORKFLOW__|$(escape_sed "$WORKFLOW_NAME")|" \
  -e "s|__PROJECT__|$(escape_sed "$PROJECT_ID")|" \
  -e "s|__PROJECT_NAME__|$(escape_sed "$PROJECT_NAME")|" \
  -e "s|__ROLE__|$(escape_sed "$ROLE_TEXT")|" \
  -e "s|__WANT__|$(escape_sed "$WANT_TEXT")|" \
  -e "s|__SO_THAT__|$(escape_sed "$SO_THAT_TEXT")|" \
  "$FILE_PATH"

echo "Created worklog story: $FILE_PATH"
