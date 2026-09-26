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
: "${ROOT:?ROOT is required}"
ACCESS="${ACCESS:-read-only}"
TRANSPORT="${TRANSPORT:-filesystem}"
INBOX_DIR="${INBOX_DIR:-Inbox}"
REFERENCES_DIR="${REFERENCES_DIR:-References}"
CONCEPTS_DIR="${CONCEPTS_DIR:-Concepts}"
DAILY_DIR="${DAILY_DIR:-Daily}"
OUTPUTS_DIR="${OUTPUTS_DIR:-Articles}"
IDENTITY_FILE="${IDENTITY_FILE:-}"

if [[ "$TRANSPORT" == "ssh" ]]; then
  : "${HOST:?HOST is required for ssh transport}"
  : "${USER:?USER is required for ssh transport}"
  PORT="${PORT:-22}"
  ssh_args=(-p "$PORT" -o BatchMode=yes -o ConnectTimeout=10)
  [[ -n "$IDENTITY_FILE" ]] && ssh_args+=(-i "${IDENTITY_FILE/#\~/$HOME}")
  remote="$USER@$HOST"
elif [[ "$TRANSPORT" != "filesystem" ]]; then
  echo "error=unsupported-transport:$TRANSPORT" >&2
  exit 2
fi

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

local_path() {
  local rel candidate root_real parent_real
  rel="$(safe_rel "${1:-}")"
  root_real="$(cd "$ROOT" 2>/dev/null && pwd -P)" || { echo "error=memory-root-unavailable" >&2; exit 3; }
  candidate="$root_real${rel:+/$rel}"
  if [[ -z "$rel" ]]; then printf '%s' "$root_real"; return; fi
  parent_real="$(cd "$(dirname "$candidate")" 2>/dev/null && pwd -P)" || parent_real="$root_real"
  [[ "$parent_real" == "$root_real" || "$parent_real" == "$root_real/"* ]] || {
    echo "error=path-outside-memory-root" >&2; exit 3;
  }
  printf '%s' "$candidate"
}

provider_test() {
  if [[ "$TRANSPORT" == "filesystem" ]]; then [[ -d "$ROOT" && -r "$ROOT" ]]; else ssh "${ssh_args[@]}" "$remote" "test -d '$ROOT' && test -r '$ROOT'"; fi
}

provider_writable() {
  if [[ "$TRANSPORT" == "filesystem" ]]; then [[ -w "$ROOT" ]]; else ssh "${ssh_args[@]}" "$remote" "test -w '$ROOT'"; fi
}

require_write() {
  [[ "$ACCESS" == "read-write" ]] || { echo "error=memory-read-only" >&2; exit 4; }
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  init)
    require_write
    [[ "$TRANSPORT" == "filesystem" ]] || { echo "error=init-requires-filesystem-projection" >&2; exit 4; }
    [[ -d "$ROOT" ]] || { echo "error=memory-root-unavailable" >&2; exit 3; }
    for area in "$INBOX_DIR" "$REFERENCES_DIR" "$CONCEPTS_DIR" "$DAILY_DIR" "$OUTPUTS_DIR"; do
      p="$(local_path "$area")"
      [[ ! -e "$p" || -d "$p" ]] || { echo "error=memory-area-conflict:$area" >&2; exit 5; }
      mkdir -p "$p"
    done
    echo "initialized=true"
    ;;
  check)
    echo "provider=synology"
    echo "transport=$TRANSPORT"
    if provider_test; then echo "reachable=true"; else echo "reachable=false"; exit 1; fi
    echo "access=$ACCESS"
    if [[ "$ACCESS" == "read-write" ]] && provider_writable; then echo "writable=true"; else echo "writable=false"; fi
    ;;
  info)
    echo "provider=synology"
    echo "transport=$TRANSPORT"
    echo "root=$ROOT"
    echo "access=$ACCESS"
    echo "inbox=$INBOX_DIR"
    echo "references=$REFERENCES_DIR"
    echo "concepts=$CONCEPTS_DIR"
    echo "daily=$DAILY_DIR"
    echo "outputs=$OUTPUTS_DIR"
    ;;
  list)
    if [[ "$TRANSPORT" == "filesystem" ]]; then
      p="$(local_path "${1:-}")"; find "$p" -maxdepth 1 -mindepth 1 -exec basename {} \; | sort
    else
      p="$(remote_path "${1:-}")"; ssh "${ssh_args[@]}" "$remote" "cd '$ROOT' && find '${p#"$ROOT"/}' -maxdepth 1 -mindepth 1 -printf '%P\n' 2>/dev/null || find '$p' -maxdepth 1 -mindepth 1 -print"
    fi
    ;;
  read)
    [[ $# -ge 1 ]] || { echo "error=path-required" >&2; exit 2; }
    if [[ "$TRANSPORT" == "filesystem" ]]; then p="$(local_path "$1")"; [[ -f "$p" ]] && cat "$p";
    else p="$(remote_path "$1")"; ssh "${ssh_args[@]}" "$remote" "test -f '$p' && cat '$p'"; fi
    ;;
  recent)
    days="${1:-7}"
    [[ "$days" =~ ^[0-9]+$ ]] || { echo "error=days-must-be-integer" >&2; exit 2; }
    if [[ "$TRANSPORT" == "filesystem" ]]; then find "$ROOT" -type f -mtime -"$days" -print | sed "s#^$ROOT/##" | sort;
    else ssh "${ssh_args[@]}" "$remote" "cd '$ROOT' && find . -type f -mtime -$days -printf '%T@ %P\n' | sort -nr | cut -d' ' -f2-"; fi
    ;;
  inbox)
    if [[ "$TRANSPORT" == "filesystem" ]]; then p="$(local_path "$INBOX_DIR")"; [[ -d "$p" ]] && find "$p" -maxdepth 1 -type f -exec basename {} \; | sort;
    else p="$(remote_path "$INBOX_DIR")"; ssh "${ssh_args[@]}" "$remote" "test -d '$p' && find '$p' -maxdepth 1 -type f -printf '%f\n'"; fi
    ;;
  write)
    require_write
    [[ $# -ge 1 ]] || { echo "error=path-required" >&2; exit 2; }
    rel="$1"; shift
    force=false; [[ "${1:-}" == "--force" ]] && force=true
    tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT; cat > "$tmp"
    if [[ "$TRANSPORT" == "filesystem" ]]; then
      p="$(local_path "$rel")"; [[ "$force" == true || ! -e "$p" ]] || { echo "error=target-exists" >&2; exit 5; }
      mkdir -p "$(dirname "$p")"; cp "$tmp" "$p"
    else
      p="$(remote_path "$rel")"
      if [[ "$force" != true ]] && ssh "${ssh_args[@]}" "$remote" "test -e '$p'"; then echo "error=target-exists" >&2; exit 5; fi
      ssh "${ssh_args[@]}" "$remote" "mkdir -p '$(dirname "$p")'"
      scp_args=(-P "$PORT" -q); [[ -n "$IDENTITY_FILE" ]] && scp_args+=(-i "${IDENTITY_FILE/#\~/$HOME}")
      scp "${scp_args[@]}" "$tmp" "$remote:$p"
    fi
    echo "written=$rel"
    ;;
  delete)
    require_write
    [[ $# -ge 2 && "$2" == "--confirm" ]] || { echo "error=delete-requires-confirm" >&2; exit 2; }
    rel="$1"
    if [[ "$TRANSPORT" == "filesystem" ]]; then p="$(local_path "$rel")"; [[ -f "$p" ]] && rm -- "$p";
    else p="$(remote_path "$rel")"; ssh "${ssh_args[@]}" "$remote" "test -f '$p' && rm -- '$p'"; fi
    echo "deleted=$rel"
    ;;
  help|-h|--help)
    echo "usage: $0 {init|check|info|list|read|recent|inbox|write|delete} ..."
    ;;
  *) echo "error=unknown-operation:$cmd" >&2; exit 2 ;;
esac
