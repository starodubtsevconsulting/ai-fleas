#!/usr/bin/env bash
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/ai-local-model-mode-test.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin"
state="$test_root/state"
printf 'qwen.service\n' >"$state"

cat >"$test_root/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == --user ]] && shift
action="$1"; service="${3:-${2:-}}"
case "$action" in
  is-active)
    if grep -Fxq "$service" "$MODEL_MODE_TEST_STATE"; then [[ "${2:-}" == --quiet ]] || printf 'active\n'; exit 0; fi
    [[ "${2:-}" == --quiet ]] || printf 'inactive\n'; exit 3 ;;
  start)
    [[ "$service" != broken.service ]] || exit 1
    grep -Fxq "$service" "$MODEL_MODE_TEST_STATE" || printf '%s\n' "$service" >>"$MODEL_MODE_TEST_STATE" ;;
  stop)
    temp="${MODEL_MODE_TEST_STATE}.tmp"; grep -Fxv "$service" "$MODEL_MODE_TEST_STATE" >"$temp" || true; mv "$temp" "$MODEL_MODE_TEST_STATE" ;;
  show)
    service="${2:-}"
    [[ "$service" != missing.service ]] && printf 'loaded\n' || printf 'not-found\n' ;;
  reset-failed) ;;
  *) exit 2 ;;
esac
EOF
cat >"$test_root/bin/curl" <<'EOF'
#!/usr/bin/env bash
[[ "$*" != *broken* ]]
EOF
chmod +x "$test_root/bin/systemctl" "$test_root/bin/curl"
export PATH="$test_root/bin:$PATH" MODEL_MODE_TEST_STATE="$state"

config='{"modes":{"coding":{"manager":"user","service":"qwen.service","health_url":"http://127.0.0.1:8000/v1/models","health_timeout_seconds":2},"image":{"manager":"user","service":"image.service","health_url":"http://127.0.0.1:8188/health","health_timeout_seconds":2},"broken":{"manager":"user","service":"broken.service","health_url":"http://127.0.0.1:9999/broken","health_timeout_seconds":1}}}'
encoded="$(printf '%s' "$config" | base64)"
out="$(bash "$dir/model-mode-remote.sh" model-status '' "$encoded")"
grep -Fq $'coding\tactive' <<<"$out"
out="$(bash "$dir/model-mode-remote.sh" switch image "$encoded")"
grep -Fq 'SUCCESS: model mode image is active and passed health, public-endpoint, and inference verification after' <<<"$out"
grep -Fxq image.service "$state"; ! grep -Fxq qwen.service "$state"

before="$(cat "$state")"
out="$(bash "$dir/model-mode-remote.sh" switch image "$encoded")"
grep -Fq 'already active and passed health, public-endpoint, and inference verification; no reload was needed' <<<"$out"
[[ "$(cat "$state")" == "$before" ]]

if bash "$dir/model-mode-remote.sh" switch broken "$encoded" >"$test_root/broken.out" 2>&1; then
  printf '%s\n' 'expected broken mode switch to fail' >&2
  exit 1
fi
grep -Fq 'MODEL_START_FAILED: broken' "$test_root/broken.out"
grep -Fq 'ROLLBACK_ATTEMPTED: restored mode image' "$test_root/broken.out"
grep -Fxq image.service "$state"; ! grep -Fxq broken.service "$state"

printf 'qwen.service\n' >>"$state"
if bash "$dir/model-mode-remote.sh" model-status '' "$encoded" >"$test_root/exclusive.out" 2>&1; then
  printf '%s\n' 'expected simultaneous model services to fail status' >&2
  exit 1
fi
grep -Fq 'MODEL_EXCLUSIVITY_VIOLATION:' "$test_root/exclusive.out"
grep -Fxv qwen.service "$state" >"$state.tmp"
mv "$state.tmp" "$state"

out="$(bash "$dir/model-mode-remote.sh" unload '' "$encoded")"
grep -Fq 'SUCCESS: all configured model modes are unloaded; installed model artifacts were preserved.' <<<"$out"
[[ ! -s "$state" ]]

missing_config='{"modes":{"missing":{"manager":"user","service":"missing.service","health_url":"http://127.0.0.1:9998/health","health_timeout_seconds":1}}}'
missing_encoded="$(printf '%s' "$missing_config" | base64)"
if bash "$dir/model-mode-remote.sh" switch missing "$missing_encoded" >"$test_root/missing.out" 2>&1; then
  printf '%s\n' 'expected missing service switch to fail' >&2
  exit 1
fi
grep -Fq 'MODEL_SERVICE_NOT_FOUND:' "$test_root/missing.out"

printf '%s\n' 'model-mode tests: PASS'
