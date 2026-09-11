#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
commands_root="$(cd "$command_dir/.." && pwd -P)"

case "${1:---local}" in
  --local)
    [[ $# -eq 0 || $# -eq 1 ]] || { echo 'LOCAL_OPTIONS_UNSUPPORTED' >&2; exit 2; }
    exec node "$command_dir/local-machine-profile.mjs"
    ;;
  --box)
    [[ $# -ge 2 ]] || { echo 'CONFIGURATION_REQUIRED: --box requires a logical machine ID.' >&2; exit 2; }
    box="$2"; shift 2
    exec "$commands_root/install/ai-local-provider/install-ai-local-provider.sh" inspect --box "$box" "$@"
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: machine-profile.command.sh [--local | --box ID [--save-profile]]'
    ;;
  *)
    echo 'INVALID_TARGET: use --local or --box ID.' >&2; exit 2
    ;;
esac
