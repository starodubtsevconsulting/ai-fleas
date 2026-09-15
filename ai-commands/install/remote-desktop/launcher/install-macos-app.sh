#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Darwin ]] || { printf '%s\n' 'REMOTE_DESKTOP_LAUNCHER_PLATFORM_UNSUPPORTED: macOS only.' >&2; exit 3; }
[[ -n "${AI_COMMAND_CONFIG_PATH:-}" && -f "$AI_COMMAND_CONFIG_PATH" ]] || { printf '%s\n' 'REMOTE_DESKTOP_LAUNCHER_PROFILE_REQUIRED' >&2; exit 64; }

launcher_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
electron_bin="$launcher_dir/node_modules/.bin/electron"
[[ -x "$electron_bin" ]] || { printf '%s\n' 'REMOTE_DESKTOP_LAUNCHER_DEPENDENCIES_REQUIRED: run npm install in the launcher directory.' >&2; exit 2; }

app_dir="$HOME/Applications/AI Fleas Remote Desktop.app"
contents_dir="$app_dir/Contents"
macos_dir="$contents_dir/MacOS"
mkdir -p "$macos_dir"

cat >"$contents_dir/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>AI Fleas Remote Desktop</string>
  <key>CFBundleIdentifier</key><string>consulting.starodubtsev.ai-fleas.remote-desktop</string>
  <key>CFBundleName</key><string>AI Fleas Remote Desktop</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>
PLIST

{
  printf '#!/bin/zsh\n'
  printf 'export AI_COMMAND_CONFIG_PATH=%q\n' "$AI_COMMAND_CONFIG_PATH"
  printf 'exec %q %q\n' "$electron_bin" "$launcher_dir/electron/main.cjs"
} >"$macos_dir/AI Fleas Remote Desktop"
chmod 0755 "$macos_dir/AI Fleas Remote Desktop"
printf 'REMOTE_DESKTOP_LAUNCHER_INSTALLED: %s\n' "$app_dir"
