#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/application-lifecycle-test.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin" "$test_root/ChatGPT.app/Contents/MacOS"

cat >"$test_root/bin/uname" <<'SH'
#!/usr/bin/env bash
case "$1" in -s) printf '%s\n' "${TEST_UNAME_S:-Darwin}" ;; -m) printf '%s\n' "${TEST_UNAME_M:-arm64}" ;; *) exit 2 ;; esac
SH
cat >"$test_root/bin/defaults" <<'SH'
#!/usr/bin/env bash
case "${3:-}" in
  CFBundleShortVersionString) printf '%s\n' '1.2.3' ;;
  CFBundleVersion) printf '%s\n' '456' ;;
  CFBundleExecutable) printf '%s\n' 'ChatGPT' ;;
  *) exit 1 ;;
esac
SH
cat >"$test_root/bin/codesign" <<'SH'
#!/usr/bin/env bash
exit 0
SH
cat >"$test_root/bin/hermes" <<'SH'
#!/usr/bin/env bash
case "${1:-}" in
  --version) printf '%s\n' 'Hermes Agent v0.21.0 (2026.9.5) · test' ;;
  --help) printf '%s\n' 'Hermes help' ;;
  *) exit 2 ;;
esac
SH
touch "$test_root/ChatGPT.app/Contents/MacOS/ChatGPT"
chmod +x "$test_root/bin/"* "$test_root/ChatGPT.app/Contents/MacOS/ChatGPT"
touch "$test_root/ChatGPT.app/Contents/Info.plist"

export PATH="$test_root/bin:$PATH"
export GPT_APP_TEST_PATH="$test_root/ChatGPT.app"
export HERMES_BIN="$test_root/bin/hermes"
gpt_lifecycle="$command_dir/chatgpt/lifecycle.sh"
hermes_lifecycle="$command_dir/hermes/lifecycle.sh"

set +e
profile_guard="$($command_dir/install.sh GPT status 2>&1)"
profile_guard_exit=$?
set -e
[[ $profile_guard_exit -eq 64 ]]
grep -F 'PROFILE_REQUIRED' <<<"$profile_guard" >/dev/null

gpt_status="$($gpt_lifecycle status)"
grep -F 'GPT_APP_INSTALLED' <<<"$gpt_status" >/dev/null
grep -F 'version=1.2.3' <<<"$gpt_status" >/dev/null
grep -F 'GPT_APP_SMOKE_PASS' < <($gpt_lifecycle smoke-test) >/dev/null

hermes_status="$($hermes_lifecycle status)"
grep -F 'Hermes Agent v0.21.0' <<<"$hermes_status" >/dev/null
grep -F 'HERMES_APP_SMOKE_PASS' < <($hermes_lifecycle smoke-test) >/dev/null

set +e
unsupported="$(TEST_UNAME_M=x86_64 $gpt_lifecycle status 2>&1)"
unsupported_exit=$?
install_unavailable="$($gpt_lifecycle install 2>&1)"
install_exit=$?
direct_hermes_unsupported="$(TEST_UNAME_M=x86_64 "$command_dir/../hermes-app/install-hermes.sh" --dry-run 2>&1)"
direct_hermes_exit=$?
chatgpt_component="$($gpt_lifecycle status --component backend 2>&1)"
chatgpt_component_exit=$?
hermes_component="$($hermes_lifecycle status --component backend 2>&1)"
hermes_component_exit=$?
set -e
[[ $unsupported_exit -eq 4 ]]
grep -F 'LOCAL_INSTALL_PLATFORM_UNSUPPORTED' <<<"$unsupported" >/dev/null
[[ $install_exit -eq 3 ]]
grep -F 'GPT_APP_INSTALL_UNAVAILABLE' <<<"$install_unavailable" >/dev/null
[[ $direct_hermes_exit -eq 4 ]]
grep -F 'LOCAL_INSTALL_PLATFORM_UNSUPPORTED' <<<"$direct_hermes_unsupported" >/dev/null
[[ $chatgpt_component_exit -eq 3 ]]
grep -F 'CHATGPT_COMPONENT_UNSUPPORTED: backend' <<<"$chatgpt_component" >/dev/null
[[ $hermes_component_exit -eq 3 ]]
grep -F 'HERMES_COMPONENT_UNSUPPORTED: backend' <<<"$hermes_component" >/dev/null

printf '%s\n' 'application lifecycle test: PASS'
