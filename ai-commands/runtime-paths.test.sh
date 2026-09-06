#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bundle="$(mktemp -d)"
other="$(mktemp -d)"
bundle="$(cd "$bundle" && pwd -P)"
other="$(cd "$other" && pwd -P)"
trap 'rm -rf "$bundle" "$other"' EXIT
source "$SCRIPT_DIR/runtime-paths.sh"
profile_root="$bundle/ai-profile/example"
mkdir -p "$profile_root"
export AI_PROFILE_BUNDLE_ROOT="$profile_root"
test "$(ai_rules_root /tmp)" = "$profile_root"
unset AI_PROFILE_BUNDLE_ROOT
export AI_CONFIG_BUNDLE_ROOT="$bundle" APP_ROOT="$other"
test "$(ai_rules_root /tmp)" = "$bundle"
unset AI_CONFIG_BUNDLE_ROOT
export APP_ROOT="$other"
test "$(ai_rules_root /tmp)" = "$other"
export AI_CONFIG_BUNDLE_ROOT="$bundle"
test "$(ai_sessions_root /tmp)" = "$bundle/.local/work-session-state/sessions"
test "$(ai_current_plan_pointer_path /tmp)" = "$bundle/.local/work-session-state/.current-plan-path"
test "$(ai_current_ui_mode_path /tmp)" = "$bundle/.local/work-session-state/.ui-mode"
test "$(ai_profile_file_path /tmp example)" = "$bundle/example-work-profile.yml"
out="$bundle/runtime-paths-test.out"
err="$bundle/runtime-paths-test.err"
if ai_profile_file_path /tmp ../bad >"$out" 2>"$err"; then exit 1; fi
test ! -s "$out"
echo 'runtime paths: PASS'
