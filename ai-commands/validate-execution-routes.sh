#!/usr/bin/env bash
set -euo pipefail

DEFAULT_COMMANDS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUESTED_COMMANDS_ROOT="${1-${DEFAULT_COMMANDS_ROOT}}"

if [[ -z "$REQUESTED_COMMANDS_ROOT" || ! -d "$REQUESTED_COMMANDS_ROOT" ]]; then
  echo "execution route error: command root must exist and be a directory: ${REQUESTED_COMMANDS_ROOT:-<empty>}" >&2
  exit 1
fi

if ! COMMANDS_ROOT="$(cd "$REQUESTED_COMMANDS_ROOT" 2>/dev/null && pwd -P)"; then
  echo "execution route error: command root could not be resolved: $REQUESTED_COMMANDS_ROOT" >&2
  exit 1
fi
case "$COMMANDS_ROOT" in
  ''|/|*$'\t'*|*$'\r'*|*$'\n'*) unsafe_root=true ;;
  *) unsafe_root=false ;;
esac
if [[ "$unsafe_root" == true ]]; then
  echo "execution route error: unsafe command root resolution: ${COMMANDS_ROOT:-<empty>}" >&2
  exit 1
fi

REGISTRY="${2:-${COMMANDS_ROOT}/execution-routes.tsv}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

inventory="${TMP_DIR}/inventory"
registered="${TMP_DIR}/registered"
links_nul="${TMP_DIR}/links.nul"
definitions_nul="${TMP_DIR}/definitions.nul"

is_unsafe_path() {
  case "$1" in
    *$'\t'*|*$'\r'*|*$'\n'*) return 0 ;;
    *) return 1 ;;
  esac
}

find_pruned() {
  local root="$1"
  shift
  find "$root" \
    \( -type d \( -name .agent-runtime -o -name .local -o \
      -name session-root -o -name sessions -o -name node_modules -o -name .venv -o \
      -name dist -o -name log -o -name logs \) -prune \) -o "$@"
}

if ! find_pruned "${COMMANDS_ROOT}" -type l -print0 > "${links_nul}"; then
  echo "execution route error: failed to inspect command root: $COMMANDS_ROOT" >&2
  exit 1
fi
while IFS= read -r -d '' link; do
  echo "execution route error: symlinks are forbidden in the managed command root: $link" >&2
  exit 1
done < "${links_nul}"

if ! find_pruned "${COMMANDS_ROOT}" -type f -name '*.command.md' \
  ! -name 'rollout-*.jsonl' ! -name '*.sqlite*' -print0 > "${definitions_nul}"; then
  echo "execution route error: failed to inventory command root: $COMMANDS_ROOT" >&2
  exit 1
fi
while IFS= read -r -d '' definition; do
  relative="${definition#"${COMMANDS_ROOT}"/}"
  if is_unsafe_path "$relative"; then
    echo 'execution route error: managed command paths may not contain tab, CR, or newline' >&2
    exit 1
  fi
  printf '%s\n' "$relative"
done < "${definitions_nul}" | LC_ALL=C sort > "${inventory}"

while IFS= read -r registry_line || [[ -n "$registry_line" ]]; do
  case "$registry_line" in
    *$'\r'*)
      echo 'execution route error: registry paths and values may not contain CR' >&2
      exit 1
      ;;
  esac
done < "${REGISTRY}"

awk -F '\t' '
  /^#/ || NF == 0 { next }
  {
    if (NF != 6) fail("expected 6 tab-separated fields; registry paths may not contain tab or newline", $1)
    if (seen[$1]++) fail("duplicate path", $1)
    if (!valid_route($2)) fail("invalid execution_route " $2, $1)
    if ($2 != "mixed") {
      if ($3 != "-" || $4 != "-" || $5 != "-" || $6 != "-")
        fail("non-mixed route must not define portion mappings", $1)
    } else {
      if ($3 != "-" && $3 != "designer-reviewer") fail("invalid reasoning mapping", $1)
      if ($4 != "-" && $4 != "coder") fail("invalid implementation mapping", $1)
      if ($5 != "-" && $5 != "command-runner" && $5 != "judge") fail("invalid execution mapping", $1)
      if ($6 != "-" && $6 != "ui-acceptance-tester") fail("invalid ui_acceptance mapping", $1)
      portions = ($3 != "-") + ($4 != "-") + ($5 != "-") + ($6 != "-")
      if (portions < 2) fail("mixed route requires at least two explicit portions", $1)
    }
    print $1
  }
  function fail(message, path) {
    print "execution route error: " message ": " path > "/dev/stderr"
    exit 1
  }
  function valid_route(value) {
    return value == "mixed" || value == "coder" || value == "command-runner" ||
      value == "designer-reviewer" || value == "judge" || value == "manager" ||
      value == "ui-acceptance-tester" || value == "workflow-agent-initializer"
  }
' "${REGISTRY}" | LC_ALL=C sort > "${registered}"

if ! diff -u "${inventory}" "${registered}"; then
  echo 'execution route error: registry must cover every command definition exactly once' >&2
  exit 1
fi

count="$(wc -l < "${inventory}" | tr -d ' ')"
echo "command execution routes: PASS (${count}/${count} definitions mapped)"
