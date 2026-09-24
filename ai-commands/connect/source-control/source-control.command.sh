#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "source-control" || exit $?
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
config_path="${AI_COMMAND_CONFIG_PATH:-}"
git_bin="$(command -v git || true)"
operation="${1:-}"
shift || true

fail() { printf 'BLOCKED_SOURCE_CONTROL: %s\n' "$1" >&2; exit 2; }
usage() {
  printf '%s\n' \
    'Usage: source-control.command.sh credential-check --repo ABSOLUTE_PATH' \
    '       source-control.command.sh fetch --repo ABSOLUTE_PATH' \
    '       source-control.command.sh pull-ff-only --repo ABSOLUTE_PATH'
}
scalar() {
  awk -F: -v wanted="$2" '$1 == wanted { sub(/^[^:]+:[[:space:]]*/, "", $0); gsub(/^['\''\"]|['\''\"]$/, "", $0); print; exit }' "$1"
}
allowed_patterns() {
  awk '
    /^allowed_remote_url_patterns:/ { inside=1; next }
    inside && /^[^[:space:]]/ { exit }
    inside && /^  -[[:space:]]*/ {
      value=$0; sub(/^  -[[:space:]]*/, "", value); gsub(/^['\''\"]|['\''\"]$/, "", value); print value
    }
  ' "$1"
}

[[ "$operation" =~ ^(credential-check|fetch|pull-ff-only)$ ]] || { usage >&2; exit 64; }
[[ "${1:-}" == '--repo' && $# -eq 2 ]] || { usage >&2; exit 64; }
repo="${2:-}"
[[ -n "$config_path" && -f "$config_path" ]] || fail 'profile-owned source-control config is required'
[[ "$repo" == /* && -d "$repo" ]] || fail 'repository must be an existing absolute directory'
[[ -x "$git_bin" ]] || fail 'git executable is unavailable'
[[ -x "$script_dir/source-control.askpass.sh" ]] || fail 'credential helper is unavailable'

[[ "$(scalar "$config_path" version)" == '1' ]] || fail 'unsupported configuration version'
[[ "$(scalar "$config_path" command)" == 'source-control' ]] || fail 'configuration command mismatch'
[[ "$(scalar "$config_path" capability)" == 'git' ]] || fail 'only the git capability is supported'
[[ "$(scalar "$config_path" registered_command)" == 'git' ]] || fail 'registered provider command must be git'
[[ "$(scalar "$config_path" credential_scope)" == 'remote_host' ]] || fail 'credential scope must be remote_host'

repo="$($git_bin -C "$repo" rev-parse --show-toplevel 2>/dev/null)" || fail 'repository is not a Git worktree'
[[ "$repo" == /* ]] || fail 'Git returned an unsafe repository path'
remote_url="$($git_bin -C "$repo" remote get-url origin 2>/dev/null)" || fail 'origin remote is required'
[[ "$remote_url" =~ ^https://[^/@]+/[^[:space:]]+$ ]] || fail 'secret-backed authentication requires an HTTPS origin'

credential_base="$(scalar "$config_path" credential_base_url)"
[[ "$credential_base" =~ ^https://[^/@]+$ ]] || fail 'credential_base_url must be a credential-free HTTPS host'
[[ "$remote_url" == "$credential_base"/* ]] || fail 'origin host does not match credential_base_url'

allowed=0
while IFS= read -r pattern; do
  [[ "$pattern" =~ ^https://[^/@]+/[A-Za-z0-9._*/-]+$ ]] || fail 'allowed remote pattern is invalid'
  if [[ "$remote_url" == $pattern ]]; then allowed=1; break; fi
done < <(allowed_patterns "$config_path")
[[ "$allowed" -eq 1 ]] || fail 'origin remote is outside the allowed profile scope'

[[ -n "${SOURCE_CONTROL_USERNAME:-}" ]] || fail 'SOURCE_CONTROL_USERNAME was not injected'
[[ -n "${SOURCE_CONTROL_TOKEN:-}" ]] || fail 'SOURCE_CONTROL_TOKEN was not injected'
[[ "$SOURCE_CONTROL_USERNAME" != *$'\n'* && "$SOURCE_CONTROL_TOKEN" != *$'\n'* ]] || fail 'injected credentials contain an unsafe newline'

run_authenticated_git() {
  GIT_ASKPASS="$script_dir/source-control.askpass.sh" \
    GIT_TERMINAL_PROMPT=0 \
    "$git_bin" -c credential.helper= -c credential.useHttpPath=true "$@"
}

case "$operation" in
  credential-check)
    run_authenticated_git -C "$repo" ls-remote --exit-code origin HEAD >/dev/null
    printf 'source-control credentials accepted: host=%s repository=%s\n' \
      "${credential_base#https://}" "$(basename "$repo")"
    ;;
  fetch)
    run_authenticated_git -C "$repo" fetch origin
    printf 'source-control fetch complete: repository=%s\n' "$(basename "$repo")"
    ;;
  pull-ff-only)
    [[ -z "$($git_bin -C "$repo" status --porcelain)" ]] || fail 'repository has local changes'
    branch="$($git_bin -C "$repo" symbolic-ref --quiet --short HEAD 2>/dev/null)" || fail 'repository is detached'
    run_authenticated_git -C "$repo" pull --ff-only origin "$branch"
    printf 'source-control fast-forward pull complete: repository=%s branch=%s\n' "$(basename "$repo")" "$branch"
    ;;
esac
