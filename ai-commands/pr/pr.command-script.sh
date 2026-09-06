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
CONF_FILE="${PR_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"

REVIEWERS="${REVIEWERS:-}"
BASE_BRANCH="${BASE_BRANCH:-}"
OPEN_PR_IN_BROWSER="${OPEN_PR_IN_BROWSER:-true}"
BITBUCKET_BASE_URL="${BITBUCKET_BASE_URL:-https://scm.example.com}"
BITBUCKET_USERNAME="${BITBUCKET_USERNAME:-}"
BITBUCKET_TOKEN="${BITBUCKET_TOKEN:-${BITBUCKET_PASSWORD:-}}"
BITBUCKET_REVIEWERS="${BITBUCKET_REVIEWERS:-}"

if [ -n "$CONF_FILE" ] && [ -f "$CONF_FILE" ]; then
  # shellcheck source=/dev/null
  source "$CONF_FILE"
fi

if [ -n "${AI_FLOW_PROJECT_DIR:-}" ]; then
  if [ ! -d "${AI_FLOW_PROJECT_DIR}" ]; then
    echo "AI_FLOW_PROJECT_DIR does not exist: ${AI_FLOW_PROJECT_DIR}" >&2
    exit 1
  fi
  cd "${AI_FLOW_PROJECT_DIR}"
fi

strip_ansi() {
  sed -E 's/\x1B\[[0-9;]*[A-Za-z]//g'
}

tmp_files=()
cleanup() {
  for f in "${tmp_files[@]:-}"; do
    [ -n "$f" ] && [ -f "$f" ] && rm -f "$f"
  done
}
trap cleanup EXIT

sanitized_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    -b|--body|--body=*)
      echo "Use --body-file instead of --body to avoid shell interpolation and unreadable PR content." >&2
      exit 2
      ;;
    --body-file)
      if [ $# -lt 2 ]; then
        echo "Missing value for --body-file" >&2
        exit 2
      fi
      body_file="$2"
      if [ ! -f "$body_file" ]; then
        echo "Body file not found: $body_file" >&2
        exit 1
      fi
      cleaned_body="$(mktemp)"
      strip_ansi < "$body_file" > "$cleaned_body"
      tmp_files+=("$cleaned_body")
      sanitized_args+=("--body-file" "$cleaned_body")
      shift 2
      ;;
    --body-file=*)
      body_file="${1#*=}"
      if [ ! -f "$body_file" ]; then
        echo "Body file not found: $body_file" >&2
        exit 1
      fi
      cleaned_body="$(mktemp)"
      strip_ansi < "$body_file" > "$cleaned_body"
      tmp_files+=("$cleaned_body")
      sanitized_args+=("--body-file=$cleaned_body")
      shift
      ;;
    *)
      sanitized_args+=("$1")
      shift
      ;;
  esac
done
set -- "${sanitized_args[@]}"

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
remote_host=""
case "$remote_url" in
  https://*)
    remote_host="$(printf '%s' "$remote_url" | sed -E 's#https://([^/@]+@)?([^/:]+).*#\2#')"
    ;;
  ssh://git@*)
    remote_host="$(printf '%s' "$remote_url" | sed -E 's#ssh://git@([^/:]+).*#\1#')"
    ;;
  git@*:*)
    remote_host="$(printf '%s' "$remote_url" | sed -E 's#git@([^:]+):.*#\1#')"
    ;;
esac

open_pr_url() {
  local pr_url="$1"
  if ! is_truthy "${OPEN_PR_IN_BROWSER:-true}"; then
    return 0
  fi

  browser_script="${SCRIPT_DIR}/../browser/browser.command.sh"
  if [ -n "$pr_url" ] && [ -x "$browser_script" ]; then
    browser_cmd=("$browser_script")
    if [ -n "${AI_FLOW_PROJECT_DIR:-}" ]; then
      browser_cmd+=(--project-dir "${AI_FLOW_PROJECT_DIR}")
    fi
    if [ -n "${AI_FLOW_OUTPUT_DIR:-}" ]; then
      browser_cmd+=(--output-dir "${AI_FLOW_OUTPUT_DIR}")
    fi
    browser_cmd+=("$pr_url")

    if ! "${browser_cmd[@]}" >/dev/null 2>&1; then
      echo "Warning: failed to open PR URL in browser: $pr_url" >&2
    fi
  fi
}

create_github_pr() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI is required for GitHub/GHE PR creation" >&2
    exit 1
  fi

  local has_base=0
  local has_reviewer=0
  local arg
  for arg in "$@"; do
    case "$arg" in
      -B|--base|--base=*)
        has_base=1
        ;;
      -r|--reviewer|--reviewer=*)
        has_reviewer=1
        ;;
    esac
  done

  cmd=(gh pr create "$@")
  if [ "$has_base" -eq 0 ] && [ -n "${BASE_BRANCH:-}" ]; then
    cmd+=(--base "$BASE_BRANCH")
  fi
  if [ "$has_reviewer" -eq 0 ] && [ -n "${REVIEWERS:-}" ]; then
    cmd+=(--reviewer "$REVIEWERS")
  fi

  echo "Running: ${cmd[*]}" >&2
  pr_create_output="$("${cmd[@]}")"
  printf '%s\n' "$pr_create_output"

  pr_url="$(printf '%s\n' "$pr_create_output" | grep -Eo 'https?://[^[:space:]]+' | head -n 1 || true)"
  if [ -z "$pr_url" ]; then
    pr_url="$(gh pr view --json url -q .url 2>/dev/null || true)"
  fi
  open_pr_url "$pr_url"
}

parse_bitbucket_repo() {
  local url="$1"
  local project=""
  local repo=""
  case "$url" in
    https://*/scm/*/*.git|https://*/scm/*/*)
      project="$(printf '%s' "$url" | sed -E 's#.*?/scm/([^/]+)/([^/]+)(\.git)?$#\1#' | tr '[:lower:]' '[:upper:]')"
      repo="$(printf '%s' "$url" | sed -E 's#.*?/scm/([^/]+)/([^/]+)(\.git)?$#\2#; s#\.git$##')"
      ;;
    ssh://git@*/*/*.git|ssh://git@*/*/*)
      project="$(printf '%s' "$url" | sed -E 's#ssh://git@[^/]+/([^/]+)/([^/]+)(\.git)?$#\1#' | tr '[:lower:]' '[:upper:]')"
      repo="$(printf '%s' "$url" | sed -E 's#ssh://git@[^/]+/([^/]+)/([^/]+)(\.git)?$#\2#; s#\.git$##')"
      ;;
    git@*:*.git|git@*:*)
      project="$(printf '%s' "$url" | sed -E 's#git@[^:]+:([^/]+)/([^/]+)(\.git)?$#\1#' | tr '[:lower:]' '[:upper:]')"
      repo="$(printf '%s' "$url" | sed -E 's#git@[^:]+:([^/]+)/([^/]+)(\.git)?$#\2#; s#\.git$##')"
      ;;
  esac
  if [ -z "$project" ] || [ -z "$repo" ]; then
    echo "Could not parse Bitbucket project/repo from remote.origin.url: $url" >&2
    exit 1
  fi
  printf '%s\n%s\n' "$project" "$repo"
}

load_bitbucket_credentials_from_git() {
  if [ -n "${BITBUCKET_USERNAME:-}" ] && [ -n "${BITBUCKET_TOKEN:-}" ]; then
    return 0
  fi
  credential_output="$(printf 'protocol=https\nhost=%s\n\n' "${remote_host:-scm.example.com}" | git credential fill 2>/dev/null || true)"
  if [ -z "${BITBUCKET_USERNAME:-}" ]; then
    BITBUCKET_USERNAME="$(printf '%s\n' "$credential_output" | sed -n 's/^username=//p' | head -n 1)"
  fi
  if [ -z "${BITBUCKET_TOKEN:-}" ]; then
    BITBUCKET_TOKEN="$(printf '%s\n' "$credential_output" | sed -n 's/^password=//p' | head -n 1)"
  fi
}

create_bitbucket_pr() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for Bitbucket PR creation" >&2
    exit 1
  fi
  if ! command_python_bootstrap >/dev/null 2>&1; then
    echo "command Python environment is required for Bitbucket PR payload construction" >&2
    exit 1
  fi

  local title=""
  local body_file=""
  local base="${BASE_BRANCH:-}"
  local head=""
  local reviewers="${BITBUCKET_REVIEWERS:-${REVIEWERS:-}}"

  while [ $# -gt 0 ]; do
    case "$1" in
      -t|--title)
        if [ $# -lt 2 ]; then echo "Missing value for $1" >&2; exit 2; fi
        title="$2"; shift 2
        ;;
      --title=*)
        title="${1#*=}"; shift
        ;;
      -B|--base)
        if [ $# -lt 2 ]; then echo "Missing value for $1" >&2; exit 2; fi
        base="$2"; shift 2
        ;;
      --base=*)
        base="${1#*=}"; shift
        ;;
      -H|--head|--source-branch|--from)
        if [ $# -lt 2 ]; then echo "Missing value for $1" >&2; exit 2; fi
        head="$2"; shift 2
        ;;
      --head=*|--source-branch=*|--from=*)
        head="${1#*=}"; shift
        ;;
      --body-file)
        if [ $# -lt 2 ]; then echo "Missing value for --body-file" >&2; exit 2; fi
        body_file="$2"; shift 2
        ;;
      --body-file=*)
        body_file="${1#*=}"; shift
        ;;
      -r|--reviewer)
        if [ $# -lt 2 ]; then echo "Missing value for $1" >&2; exit 2; fi
        reviewers="$2"; shift 2
        ;;
      --reviewer=*)
        reviewers="${1#*=}"; shift
        ;;
      *)
        echo "Unsupported Bitbucket PR option: $1" >&2
        exit 2
        ;;
    esac
  done

  if [ -z "$head" ]; then
    head="$(git branch --show-current)"
  fi
  if [ -z "$base" ]; then
    base="master"
  fi
  if [ -z "$title" ]; then
    title="$head"
  fi
  local description=""
  if [ -n "$body_file" ]; then
    description="$(cat "$body_file")"
  fi

  load_bitbucket_credentials_from_git
  if [ -z "${BITBUCKET_USERNAME:-}" ] || [ -z "${BITBUCKET_TOKEN:-}" ]; then
    echo "Missing Bitbucket credentials. Set them in the selected profile or environment." >&2
    exit 1
  fi

  mapfile -t repo_parts < <(parse_bitbucket_repo "$remote_url")
  project_key="${repo_parts[0]}"
  repo_slug="${repo_parts[1]}"

  payload_file="$(mktemp)"
  tmp_files+=("$payload_file")
  command_python - "$title" "$description" "$head" "$base" "$project_key" "$repo_slug" "$reviewers" > "$payload_file" <<'BTPY'
import json
import sys

title, description, head, base, project_key, repo_slug, reviewers = sys.argv[1:]
repo = {"slug": repo_slug, "project": {"key": project_key}}
payload = {
    "title": title,
    "description": description,
    "state": "OPEN",
    "open": True,
    "closed": False,
    "fromRef": {"id": f"refs/heads/{head}", "repository": repo},
    "toRef": {"id": f"refs/heads/{base}", "repository": repo},
}
reviewer_values = [r.strip() for r in reviewers.split(",") if r.strip()]
if reviewer_values:
    payload["reviewers"] = [{"user": {"name": reviewer}} for reviewer in reviewer_values]
print(json.dumps(payload))
BTPY

  api_url="${BITBUCKET_BASE_URL%/}/rest/api/1.0/projects/${project_key}/repos/${repo_slug}/pull-requests"
  echo "Running: curl -fsS -u ${BITBUCKET_USERNAME}:*** -H Content-Type: application/json -X POST ${api_url}" >&2
  response_file="$(mktemp)"
  tmp_files+=("$response_file")
  if ! curl -fsS -u "${BITBUCKET_USERNAME}:${BITBUCKET_TOKEN}" -H 'Content-Type: application/json' -X POST --data @"$payload_file" "$api_url" > "$response_file"; then
    echo "Bitbucket PR creation failed." >&2
    exit 1
  fi

  pr_url="$(command_python - "$response_file" <<'BTPY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as fh:
    data = json.load(fh)
for link in data.get('links', {}).get('self', []):
    href = link.get('href')
    if href:
        print(href)
        break
BTPY
)"
  if [ -n "$pr_url" ]; then
    printf '%s\n' "$pr_url"
  else
    cat "$response_file"
  fi
  open_pr_url "$pr_url"
}

case "$remote_host" in
  scm.example.com)
    create_bitbucket_pr "$@"
    ;;
  *)
    create_github_pr "$@"
    ;;
esac
