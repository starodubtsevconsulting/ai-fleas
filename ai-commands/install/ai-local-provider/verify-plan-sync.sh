#!/usr/bin/env bash
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
documented="$(sed -n 's/.*PLAN_STEP: \(AI-LOCAL-[0-9][0-9]\).*/\1/p' "$dir/PLAN.md")"
implemented="$({
  sed -n 's/^[[:space:]]*plan_step \(AI-LOCAL-[0-9][0-9]\) .*/\1/p' "$dir/install-ai-local-provider.sh"
  sed -n 's/^[[:space:]]*plan_step \(AI-LOCAL-[0-9][0-9]\) .*/\1/p' "$dir/provision-ubuntu.sh"
})"
[[ "$documented" == "$implemented" ]] || {
  printf 'PLAN_OUT_OF_SYNC\nDocumented:\n%s\nImplemented:\n%s\n' "$documented" "$implemented" >&2
  exit 1
}
printf 'install plan sync: PASS\n'
