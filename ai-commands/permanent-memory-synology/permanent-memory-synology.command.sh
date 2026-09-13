#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${PERMANENT_MEMORY_SYNOLOGY_CONFIG:-${AI_COMMAND_CONFIG:-}}"
if [[ -z "$CONFIG_FILE" || ! -f "$CONFIG_FILE" ]]; then
  echo "error=configuration-not-found" >&2
  echo "hint=set PERMANENT_MEMORY_SYNOLOGY_CONFIG or AI_COMMAND_CONFIG" >&2
  exit 2
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"
: "${HOST:?HOST is required}"
: "${USER:?USER is required}"
: "${ROOT:?ROOT is required}"
PORT="${PORT:-22}"
ACCESS="${ACCESS:-read-only}"
TRANSPORT="${TRANSPORT:-ssh}"
INBOX_DIR="${INBOX_DIR:-Inbox}"
REFERENCES_DIR="${REFERENCES_DIR:-References}"
CONCEPTS_DIR="${CONCEPTS_DIR:-Concepts}"
OUTPUTS_DIR="${OUTPUTS_DIR:-Articles}"
IDENTITY_FILE="${IDENTITY_FILE:-}"

ssh_args=(-p "$PORT" -o BatchMode=yes -o ConnectTimeout=10)
[[ -n "$IDENTITY_FILE" ]] && ssh_args+=(-i "${IDENTITY_FILE/#\~/$HOME}")
remote="$USER@$HOST"

ssh_run() { ssh "${ssh_args[@]}" "$remote" "$@"; }

safe_rel() {
  local p="${1:-}"
  [[ "$p" != /* ]] || { echo "error=absolute-path-rejected" >&2; exit 3; }
  [[ "$p" != *".."* ]] || { echo "error=path-traversal-rejected" >&2; exit 3; }
  printf '%s' "$p"
}

remote_path() {
  local rel
  rel="$(safe_rel "${1:-}")"
  if [[ -n "$rel" ]]; then printf '%s/%s' "$ROOT" "$rel"; else printf '%s' "$ROOT"; fi
}

require_write() {
  [[ "$ACCESS" == "read-write" ]] || { echo "error=memory-read-only" >&2; exit 4; }
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  check)
    echo "provider=synology"
    echo "transport=$TRANSPORT"
    if ssh_run "test -d '$ROOT' && test -r '$ROOT'"; then echo "reachable=true"; else echo "reachable=false"; exit 1; fi
    echo "access=$ACCESS"
    if [[ "$ACCESS" == "read-write" ]] && ssh_run "test -w '$ROOT'"; then echo "writable=true"; else echo "writable=false"; fi
    ;;
  info)
    echo "provider=synology"
    echo "transport=$TRANSPORT"
    echo "root=$ROOT"
    echo "access=$ACCESS"
    echo "inbox=$INBOX_DIR"
    echo "references=$REFERENCES_DIR"
    echo "concepts=$CONCEPTS_DIR"
    echo "outputs=$OUTPUTS_DIR"
    ;;
  list)
    p="$(remote_path "${1:-}")"
    ssh_run "cd '$ROOT' && find '${p#"$ROOT"/}' -maxdepth 1 -mindepth 1 -printf '%P\n' 2>/dev/null || find '$p' -maxdepth 1 -mindepth 1 -print"
    ;;
  read)
    [[ $# -ge 1 ]] || { echo "error=path-required" >&2; exit 2; }
    p="$(remote_path "$1")"
    ssh_run "test -f '$p' && cat '$p'"
    ;;
  recent)
    days="${1:-7}"
    [[ "$days" =~ ^[0-9]+$ ]] || { echo "error=days-must-be-integer" >&2; exit 2; }
    ssh_run "cd '$ROOT' && find . -type f -mtime -$days -printf '%T@ %P\n' | sort -nr | cut -d' ' -f2-"
    ;;
  inbox)
    p="$(remote_path "$INBOX_DIR")"
    ssh_run "test -d '$p' && find '$p' -maxdepth 1 -type f -printf '%f\n'"
    ;;
  write)
    require_write
    [[ $# -ge 1 ]] || { echo "error=path-required" >&2; exit 2; }
    rel="$1"; shift
    force=false; [[ "${1:-}" == "--force" ]] && force=true
    p="$(remote_path "$rel")"
    tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
    cat > "$tmp"
    if [[ "$force" != true ]] && ssh_run "test -e '$p'"; then echo "error=target-exists" >&2; exit 5; fi
    ssh_run "mkdir -p '$(dirname "$p")'"
    scp_args=(-P "$PORT" -q); [[ -n "$IDENTITY_FILE" ]] && scp_args+=(-i "${IDENTITY_FILE/#\~/$HOME}")
    scp "${scp_args[@]}" "$tmp" "$remote:$p"
    echo "written=$rel"
    ;;
  delete)
    require_write
    [[ $# -ge 2 && "$2" == "--confirm" ]] || { echo "error=delete-requires-confirm" >&2; exit 2; }
    rel="$1"; p="$(remote_path "$rel")"
    ssh_run "test -f '$p' && rm -- '$p'"
    echo "deleted=$rel"
    ;;
  help|-h|--help)
    echo "usage: $0 {check|info|list|read|recent|inbox|write|delete} ..."
    ;;
  *) echo "error=unknown-operation:$cmd" >&2; exit 2 ;;
esac
