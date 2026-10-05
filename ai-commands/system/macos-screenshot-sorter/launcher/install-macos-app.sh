#!/usr/bin/env bash
# Purpose: install the profile-activated Screenshot Sorter as a Spotlight-launchable macOS app.
# Caller: macos-screenshot-sorter.command.sh `install-app --apply` after profile activation.
# Inputs: the selected profile environment and SCREENSHOT_SORTER_ELECTRON_BIN; writes a small
# wrapper at ~/Applications/Screenshot Sorter.app that reuses that exact authorized command setup.
# Effects: creates or refreshes only this app bundle; it neither installs a LaunchAgent nor changes
# screenshot folders or other profile settings.
set -euo pipefail

[[ "$(uname -s)" == Darwin ]] || { printf '%s\n' 'SCREENSHOT_SORTER_APP_PLATFORM_UNSUPPORTED: macOS only.' >&2; exit 3; }
: "${AI_CONFIG_PROJECT:?profile activation must set AI_CONFIG_PROJECT}"
: "${AI_WORK_PROFILE_ID:?profile activation must set AI_WORK_PROFILE_ID}"
: "${AI_FLOW_WORKFLOW:?profile activation must set AI_FLOW_WORKFLOW}"
: "${AI_AGENT_PLATFORM:?profile activation must set AI_AGENT_PLATFORM}"
: "${AI_COMMAND_CONFIG_PATH:?profile activation must set AI_COMMAND_CONFIG_PATH}"
: "${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN}"

[[ -f "$AI_COMMAND_CONFIG_PATH" ]] || { printf '%s\n' 'SCREENSHOT_SORTER_APP_PROFILE_CONFIG_MISSING' >&2; exit 2; }
[[ -x "$SCREENSHOT_SORTER_ELECTRON_BIN" ]] || { printf '%s\n' 'SCREENSHOT_SORTER_ELECTRON_REQUIRED: configured runtime is not executable.' >&2; exit 2; }

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
app_dir="$HOME/Applications/Screenshot Sorter.app"
contents_dir="$app_dir/Contents"
macos_dir="$contents_dir/MacOS"
executable="$macos_dir/Screenshot Sorter"
mkdir -p "$macos_dir"

cat >"$contents_dir/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Screenshot Sorter</string>
  <key>CFBundleIdentifier</key><string>org.example.ai-fleas.screenshot-sorter</string>
  <key>CFBundleName</key><string>Screenshot Sorter</string>
  <key>CFBundleDisplayName</key><string>Screenshot Sorter</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>
PLIST

{
  printf '#!/bin/zsh\n'
  printf 'export AI_CONFIG_PROJECT=%q\n' "$AI_CONFIG_PROJECT"
  printf 'export AI_WORK_PROFILE_ID=%q\n' "$AI_WORK_PROFILE_ID"
  printf 'export AI_FLOW_WORKFLOW=%q\n' "$AI_FLOW_WORKFLOW"
  printf 'export AI_AGENT_PLATFORM=%q\n' "$AI_AGENT_PLATFORM"
  printf 'export AI_COMMAND_CONFIG_PATH=%q\n' "$AI_COMMAND_CONFIG_PATH"
  printf 'export SCREENSHOT_SORTER_ELECTRON_BIN=%q\n' "$SCREENSHOT_SORTER_ELECTRON_BIN"
  printf 'export SCREENSHOT_SORTER_COMMAND_DIR=%q\n' "$command_dir"
  printf 'exec %q %q\n' "$SCREENSHOT_SORTER_ELECTRON_BIN" "$command_dir/launcher/electron/main.cjs"
} >"$executable"
chmod 0755 "$executable"
/usr/bin/open "$app_dir"
printf 'SCREENSHOT_SORTER_APP_INSTALLED: %s\n' "$app_dir"
