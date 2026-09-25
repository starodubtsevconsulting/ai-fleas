#!/bin/zsh
set -euo pipefail

gpt_agents_root="$(cd "$(dirname "$0")" && pwd -P)"
launcher="$gpt_agents_root/launcher.mjs"

node "$launcher" setup --migrate "$@"
node "$launcher" doctor
exec node "$launcher" launch
