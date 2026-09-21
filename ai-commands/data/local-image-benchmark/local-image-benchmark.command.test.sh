#!/usr/bin/env bash
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
command="$dir/local-image-benchmark.command.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/local-image-benchmark-test.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT

out="$(bash "$command" help)"
grep -Fq 'files are internal workers' <<<"$out"
grep -Fq -- '--confirm-model-isolated' <<<"$out"

out="$(bash "$command" candidates)"
grep -Fq 'flux2-dev-bf16' <<<"$out"
grep -Fq 'evaluation only' <<<"$out"

cat >"$test_root/results.jsonl" <<'EOF'
{"candidate_id":"example","case_id":"sample","generation_seconds":2.0,"generation_peak_system_used_bytes":1073741824,"torch_peak_reserved_bytes":536870912}
{"candidate_id":"example","case_id":"sample","generation_seconds":4.0,"generation_peak_system_used_bytes":2147483648,"torch_peak_reserved_bytes":1073741824}
EOF
out="$(bash "$command" summarize "$test_root/results.jsonl")"
grep -Fq '| example | sample | 2 | 3.00 s | 2.0 GiB | 1.0 GiB |' <<<"$out"

set +e
out="$(bash "$command" run --candidate flux2-dev-bf16 --output-root "$test_root" 2>&1)"
code=$?
set -e
[[ $code -eq 64 ]]
grep -Fq 'MODEL_ISOLATION_CONFIRMATION_REQUIRED' <<<"$out"

set +e
out="$(bash "$command" unknown 2>&1)"
code=$?
set -e
[[ $code -eq 64 ]]
grep -Fq 'unknown action' <<<"$out"

printf '%s\n' 'local-image-benchmark command tests: PASS'
