#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
REMOTE="origin"
BRANCH=""
SET_UPSTREAM="true"
BASE_BRANCH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      if [ $# -lt 2 ]; then echo "Missing value for --project-dir" >&2; exit 2; fi
      AI_FLOW_PROJECT_DIR="$2"; shift 2
      ;;
    --remote)
      if [ $# -lt 2 ]; then echo "Missing value for --remote" >&2; exit 2; fi
      REMOTE="$2"; shift 2
      ;;
    --branch)
      if [ $# -lt 2 ]; then echo "Missing value for --branch" >&2; exit 2; fi
      BRANCH="$2"; shift 2
      ;;
    --base)
      if [ $# -lt 2 ]; then echo "Missing value for --base" >&2; exit 2; fi
      BASE_BRANCH="$2"; shift 2
      ;;
    --no-upstream)
      SET_UPSTREAM="false"; shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="$SCRIPT_DIR/pr.command.conf"
BITBUCKET_USERNAME="${BITBUCKET_USERNAME:-}"
BITBUCKET_TOKEN="${BITBUCKET_TOKEN:-${BITBUCKET_PASSWORD:-}}"
if [ -f "$CONF_FILE" ]; then
  # shellcheck source=/dev/null
  source "$CONF_FILE"
fi

if [ -n "${AI_FLOW_PROJECT_DIR:-}" ]; then
  cd "$AI_FLOW_PROJECT_DIR"
fi

if [ -z "$BRANCH" ]; then
  BRANCH="$(git branch --show-current)"
fi
current_branch="$(git branch --show-current)"
if [ "$current_branch" != "$BRANCH" ]; then
  echo "BLOCKED_GIT_BRANCH_CONTEXT_MISMATCH: current branch $current_branch does not match requested branch $BRANCH" >&2
  exit 1
fi
if [ -z "$BRANCH" ]; then
  echo "Could not resolve current branch; pass --branch" >&2
  exit 2
fi

remote_url="$(git config --get "remote.${REMOTE}.url" 2>/dev/null || true)"
if [ -z "$remote_url" ]; then
  echo "Remote not found: $REMOTE" >&2
  exit 1
fi

if [ -z "$BASE_BRANCH" ]; then
  BASE_BRANCH="$(git symbolic-ref --quiet --short "refs/remotes/${REMOTE}/HEAD" 2>/dev/null | sed "s#^${REMOTE}/##" || true)"
fi
if [ -z "$BASE_BRANCH" ] && git show-ref --verify --quiet "refs/remotes/${REMOTE}/main"; then BASE_BRANCH="main"; fi
if [ -z "$BASE_BRANCH" ] && git show-ref --verify --quiet "refs/remotes/${REMOTE}/master"; then BASE_BRANCH="master"; fi
if [ -z "$BASE_BRANCH" ]; then
  echo "BLOCKED_GIT_BASE_BRANCH_UNAVAILABLE: pass --base after configuring or fetching the remote default branch" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "BLOCKED_GIT_REBASE_DIRTY_WORKTREE: commit or stash local changes before the mandatory base rebase" >&2
  exit 1
fi
if ! git fetch "$REMOTE" "$BASE_BRANCH"; then
  echo "BLOCKED_GIT_BASE_REFRESH_FAILED: $REMOTE/$BASE_BRANCH" >&2
  exit 1
fi
echo "GIT_BASE_REFRESHED: $REMOTE/$BASE_BRANCH" >&2
if [ "$BRANCH" != "$BASE_BRANCH" ]; then
  if ! git rebase "$REMOTE/$BASE_BRANCH"; then
    git rebase --abort >/dev/null 2>&1 || true
    echo "BLOCKED_GIT_BASE_REBASE_CONFLICT: $BRANCH onto $REMOTE/$BASE_BRANCH" >&2
    exit 1
  fi
  echo "GIT_BRANCH_REBASED: $BRANCH onto $REMOTE/$BASE_BRANCH" >&2
fi

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

push_args=(push)
if [ "$SET_UPSTREAM" = "true" ]; then
  push_args+=(-u)
fi
push_args+=("$REMOTE" "$BRANCH")

case "$remote_host" in
  scm.example.com)
    load_bitbucket_credentials_from_git
    if [ -z "${BITBUCKET_USERNAME:-}" ] || [ -z "${BITBUCKET_TOKEN:-}" ]; then
      echo "Missing Bitbucket credentials. Set BITBUCKET_USERNAME and BITBUCKET_TOKEN in commands/pr/pr.command.conf or the environment." >&2
      exit 1
    fi
    askpass="$(mktemp)"
    cleanup() { rm -f "$askpass"; }
    trap cleanup EXIT
    cat > "$askpass" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "$BITBUCKET_USERNAME" ;;
  *Password*) printf '%s\n' "$BITBUCKET_TOKEN" ;;
  *) printf '\n' ;;
esac
ASKPASS
    chmod 700 "$askpass"
    echo "Running: git push -u $REMOTE $BRANCH (Bitbucket credentials supplied via GIT_ASKPASS)" >&2
    GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 BITBUCKET_USERNAME="$BITBUCKET_USERNAME" BITBUCKET_TOKEN="$BITBUCKET_TOKEN" \
      git -c credential.helper= "${push_args[@]}"
    ;;
  *)
    echo "Running: git ${push_args[*]}" >&2
    git "${push_args[@]}"
    ;;
esac
