#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
profile="$root/models/qwen3-coder-next/expertise-profile.yml"
out="$(node "$(dirname "${BASH_SOURCE[0]}")/compile-model-guidance.mjs" "$profile" coder)"
grep -Fq 'Model family: Qwen3-Coder-Next' <<<"$out"
grep -Fq '### Debugging' <<<"$out"
grep -Fq '### Verification' <<<"$out"
grep -Fq 'Observed recurring limits' <<<"$out"
if node "$(dirname "${BASH_SOURCE[0]}")/compile-model-guidance.mjs" /tmp/does-not-exist coder >/dev/null 2>&1; then
  echo 'expected missing-profile failure' >&2; exit 1
fi
echo 'model guidance compiler: PASS'
