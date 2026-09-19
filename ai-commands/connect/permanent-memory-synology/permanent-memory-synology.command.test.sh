#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(mktemp -d)"
config="$(mktemp)"
trap 'rm -rf "$root" "$config"' EXIT

mkdir -p "$root/memory" "$root/strategy" "$root/daily" "$root/decisions" "$root/references"
cat >"$config" <<EOF
TRANSPORT=filesystem
ROOT=$root
ACCESS=read-write
INBOX_DIR=memory
REFERENCES_DIR=references
CONCEPTS_DIR=strategy
OUTPUTS_DIR=decisions
EOF

AI_COMMAND_CONFIG="$config" "$command_dir/permanent-memory-synology.command.sh" check | grep -F 'reachable=true' >/dev/null
printf '%s' 'test memory' | AI_COMMAND_CONFIG="$config" \
  "$command_dir/permanent-memory-synology.command.sh" write memory/test.md >/dev/null
[[ "$(AI_COMMAND_CONFIG="$config" "$command_dir/permanent-memory-synology.command.sh" read memory/test.md)" == 'test memory' ]]
AI_COMMAND_CONFIG="$config" "$command_dir/permanent-memory-synology.command.sh" delete memory/test.md --confirm >/dev/null
[[ ! -e "$root/memory/test.md" ]]

echo 'permanent-memory-synology filesystem transport: PASS'
