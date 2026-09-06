#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "worktree-bash" || exit $?
set -euo pipefail

readonly INVALID_INPUT=64 BLOCKED=69 PAYLOAD_FAILURE=70
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == --self-test && $# -eq 1 ]]; then
  exec /bin/bash "$script_dir/worktree-bash.command.test.sh"
fi
dry_run=false
allow_destructive=false
project_root=''
while (($#)); do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --allow-destructive) allow_destructive=true; shift ;;
    --project-root)
      (($# >= 2)) || { echo 'worktree-bash: missing project root' >&2; exit "$INVALID_INPUT"; }
      project_root="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo 'worktree-bash: invalid input' >&2; exit "$INVALID_INPUT" ;;
  esac
done
(( $# > 0 )) || { echo 'worktree-bash: missing payload' >&2; exit "$INVALID_INPUT"; }
command -v /usr/bin/sandbox-exec >/dev/null || { echo 'worktree-bash: BLOCKED sandbox backend unavailable' >&2; exit "$BLOCKED"; }
worktree="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$worktree" && "$worktree" != / && "$worktree" != "$HOME" ]] || { echo 'worktree-bash: invalid worktree' >&2; exit "$INVALID_INPUT"; }
node_path="$(command -v node 2>/dev/null || true)"
node_bin=''
if [[ -n "$node_path" ]]; then
  node_bin="$(cd "$(dirname "$node_path")" && pwd -P)"
  case "$node_bin" in /opt/homebrew/bin|/usr/local/bin|/usr/bin) ;; *) node_bin='' ;; esac
fi
project_state_root=''
if [[ -n "$project_root" ]]; then
  [[ -d "$project_root" ]] || { echo 'worktree-bash: invalid project root' >&2; exit "$INVALID_INPUT"; }
  project_root="$(cd "$project_root" && pwd -P)"
  [[ "$project_root" != / && "$project_root" != "$HOME" ]] || { echo 'worktree-bash: unsafe project root' >&2; exit "$INVALID_INPUT"; }
  project_state_root="$project_root/.ai-workflow-suite"
fi
payload=("$@")
joined="${payload[*]}"
if ! "$allow_destructive" && [[ "$joined" =~ (^|[[:space:];|&])(rm[[:space:]]|rmdir[[:space:]]|unlink[[:space:]]|git[[:space:]]+(reset|clean|checkout[[:space:]]+--)|find[^;|&]*[[:space:]]-delete([[:space:];|&]|$)) ]]; then
  echo 'worktree-bash: destructive payload requires --allow-destructive and caller authorization' >&2; exit "$INVALID_INPUT"
fi
printf 'worktree=%q' "$worktree"
[[ -z "$project_state_root" ]] || printf ' project_state_root=%q' "$project_state_root"
printf ' payload='; printf '%q ' "${payload[@]}"; printf '\n'
"$dry_run" && exit 0
runtime_base=/tmp
[[ "${WORKTREE_BASH_ACTIVE:-}" == 1 ]] && runtime_base="${TMPDIR:-/tmp}"
runtime_dir="$(mktemp -d "$runtime_base/worktree-bash.XXXXXX")"
runtime_dir="$(cd "$runtime_dir" && pwd -P)"
mkdir -p "$runtime_dir/home" "$runtime_dir/tmp" "$runtime_dir/cache"
cleanup() { rm -rf "$runtime_dir"; }
trap cleanup EXIT
write_rules="(literal \"/dev/null\") (subpath \"$worktree\") (subpath \"$runtime_dir\")"
[[ -z "$project_state_root" ]] || write_rules+=" (subpath \"$project_state_root\")"
profile="(version 1) (deny default) (allow process*) (allow sysctl-read) (allow file-read*) (allow file-write* $write_rules) (deny network*) (allow network-bind (local unix-socket (subpath \"$runtime_dir/tmp\")))"
managed_path="/usr/bin:/bin:/usr/sbin:/sbin"
[[ -z "$node_bin" ]] || managed_path="$node_bin:$managed_path"
env -i PATH="$managed_path" HOME="$runtime_dir/home" TMPDIR="$runtime_dir/tmp" XDG_CACHE_HOME="$runtime_dir/cache" WORKTREE_BASH_ACTIVE=1 /usr/bin/sandbox-exec -p "$profile" /bin/bash --noprofile --norc -c 'cd "$1"; shift; "$@"' bash "$worktree" "${payload[@]}" || exit "$PAYLOAD_FAILURE"
