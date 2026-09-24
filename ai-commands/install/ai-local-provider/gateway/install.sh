#!/usr/bin/env bash
set -euo pipefail

gateway_source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
user_data_root="${XDG_DATA_HOME:-${HOME:?HOME is required}/.local/share}"
gateway_target_dir="${1:-$user_data_root/ai-fleas/local-model-gateway}"

[[ "$gateway_target_dir" == /* ]] || {
  printf 'target directory must be absolute: %s\n' "$gateway_target_dir" >&2
  exit 2
}

install -d -m 0755 "$gateway_target_dir"
install -m 0755 "$gateway_source_dir/local-model-gateway.mjs" "$gateway_target_dir/local-model-gateway.mjs"
install -m 0644 "$gateway_source_dir/index.html" "$gateway_target_dir/index.html"
printf 'Installed local model gateway in %s\n' "$gateway_target_dir"
