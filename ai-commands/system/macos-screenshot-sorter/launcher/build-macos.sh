#!/usr/bin/env bash
# Purpose: package Screenshot Sorter into a signed macOS .app with its Electron runtime and UI assets.
# Caller: macos-screenshot-sorter.command.sh `build-app --apply`, or a human who supplies a selected
# profile environment plus `--output <absolute-app-path>`.
# Inputs: SCREENSHOT_SORTER_ELECTRON_BIN and the active profile variables; output is a named .app bundle.
# Effects: creates or replaces only the requested .app path. The bundle remains profile-bound at runtime:
# it verifies and reads the selected profile's private configuration rather than embedding that configuration.
set -euo pipefail

usage() { printf '%s\n' 'Usage: build-macos.sh --output <absolute-path-to-Screenshot-Sorter.app> [--replace]'; }
[[ "$(uname -s)" == Darwin ]] || { printf '%s\n' 'SCREENSHOT_SORTER_BUILD_PLATFORM_UNSUPPORTED: macOS only.' >&2; exit 3; }
: "${AI_CONFIG_PROJECT:?profile activation must set AI_CONFIG_PROJECT}"
: "${AI_WORK_PROFILE_ID:?profile activation must set AI_WORK_PROFILE_ID}"
: "${AI_FLOW_WORKFLOW:?profile activation must set AI_FLOW_WORKFLOW}"
: "${AI_AGENT_PLATFORM:?profile activation must set AI_AGENT_PLATFORM}"
: "${AI_COMMAND_CONFIG_PATH:?profile activation must set AI_COMMAND_CONFIG_PATH}"
: "${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN}"

output=''
replace=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; output="$2"; shift 2 ;;
    --replace) replace=true; shift ;;
    *) usage >&2; exit 2 ;;
  esac
done
[[ "$output" == /* && "$output" == *.app ]] || { printf '%s\n' 'SCREENSHOT_SORTER_BUILD_OUTPUT_REQUIRED: use an absolute .app output path.' >&2; exit 2; }
[[ -f "$AI_COMMAND_CONFIG_PATH" ]] || { printf '%s\n' 'SCREENSHOT_SORTER_BUILD_PROFILE_CONFIG_MISSING' >&2; exit 2; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
command_dir="$(cd "$script_dir/.." && pwd -P)"
commands_root="$(cd "$command_dir/../.." && pwd -P)"
repository_root="$(cd "$commands_root/.." && pwd -P)"
electron_entry="$(node -e 'process.stdout.write(require("fs").realpathSync(process.argv[1]))' "$SCREENSHOT_SORTER_ELECTRON_BIN")"
case "$electron_entry" in
  */Electron.app/Contents/MacOS/Electron) electron_app="${electron_entry%/Contents/MacOS/Electron}" ;;
  */electron/cli.js) electron_app="$(dirname "$electron_entry")/dist/Electron.app" ;;
  *) printf '%s\n' "SCREENSHOT_SORTER_BUILD_ELECTRON_UNSUPPORTED: cannot locate Electron.app from $electron_entry" >&2; exit 2 ;;
esac
[[ -d "$electron_app" ]] || { printf '%s\n' "SCREENSHOT_SORTER_BUILD_ELECTRON_APP_MISSING: $electron_app" >&2; exit 2; }

if [[ -e "$output" ]]; then
  [[ "$replace" == true ]] || { printf '%s\n' "SCREENSHOT_SORTER_BUILD_OUTPUT_EXISTS: $output (rerun with --replace)" >&2; exit 2; }
  existing_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$output/Contents/Info.plist" 2>/dev/null || true)"
  [[ "$existing_id" == org.example.ai-fleas.screenshot-sorter ]] || { printf '%s\n' "SCREENSHOT_SORTER_BUILD_REFUSES_UNOWNED_APP: $output" >&2; exit 2; }
  rm -rf "$output"
fi

mkdir -p "$(dirname "$output")"
cp -R "$electron_app" "$output"
resources="$output/Contents/Resources"
payload="$resources/app"
packaged_commands="$payload/ai-commands"
mkdir -p "$packaged_commands/system" "$packaged_commands/_runtime"
cp -R "$command_dir" "$packaged_commands/system/macos-screenshot-sorter"
cp -R "$commands_root/_runtime/profile" "$packaged_commands/_runtime/profile"
mkdir -p "$payload/platforms" "$payload/node_modules"
cp "$repository_root/platforms/dispatch-plan.mjs" "$payload/platforms/dispatch-plan.mjs"
cp -R "$repository_root/node_modules/yaml" "$payload/node_modules/yaml"

# The development renderer refers to a repository article asset. Package a local copy instead.
mkdir -p "$packaged_commands/system/macos-screenshot-sorter/launcher/renderer/assets"
cp "$commands_root/../notes/articles/assets/2026-09-18-ai-fleas-human-led-demo-header.png" "$packaged_commands/system/macos-screenshot-sorter/launcher/renderer/assets/hero.png"
sed -i '' 's#../../../../../notes/articles/assets/2026-09-18-ai-fleas-human-led-demo-header.png#assets/hero.png#' "$packaged_commands/system/macos-screenshot-sorter/launcher/renderer/index.html"

cat >"$payload/package.json" <<'JSON'
{"name":"screenshot-sorter","version":"1.0.0","private":true,"main":"main.cjs"}
JSON
cat >"$payload/main.cjs" <<'JS'
require('./ai-commands/system/macos-screenshot-sorter/launcher/electron/main.cjs');
JS

iconset="$payload/screenshot-sorter.iconset"
mkdir -p "$iconset"
for size in 16 32 128 256 512; do
  /usr/bin/sips -s format png -z "$size" "$size" "$script_dir/assets/screenshot-sorter-icon.svg" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  /usr/bin/sips -s format png -z "$double" "$double" "$script_dir/assets/screenshot-sorter-icon.svg" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
/usr/bin/iconutil --convert icns --output "$resources/ScreenshotSorter.icns" "$iconset"
rm -rf "$iconset"

/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier org.example.ai-fleas.screenshot-sorter' "$output/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleName Screenshot Sorter' "$output/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Add :CFBundleDisplayName string Screenshot Sorter' "$output/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName Screenshot Sorter' "$output/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIconFile ScreenshotSorter.icns' "$output/Contents/Info.plist"

launcher="$output/Contents/MacOS/Electron"
runtime="$output/Contents/MacOS/ScreenshotSorterElectron"
mv "$launcher" "$runtime"
{
  printf '#!/bin/zsh\n'
  printf 'export AI_CONFIG_PROJECT=%q\n' "$AI_CONFIG_PROJECT"
  printf 'export AI_WORK_PROFILE_ID=%q\n' "$AI_WORK_PROFILE_ID"
  printf 'export AI_FLOW_WORKFLOW=%q\n' "$AI_FLOW_WORKFLOW"
  printf 'export AI_AGENT_PLATFORM=%q\n' "$AI_AGENT_PLATFORM"
  printf 'export AI_COMMAND_CONFIG_PATH=%q\n' "$AI_COMMAND_CONFIG_PATH"
  printf 'export SCREENSHOT_SORTER_COMMAND_DIR=%q\n' "$packaged_commands/system/macos-screenshot-sorter"
  printf 'exec %q "$@"\n' "$runtime"
} >"$launcher.wrapper"
mv "$launcher.wrapper" "$launcher"
chmod 0755 "$launcher"
/usr/bin/codesign --force --deep --sign - "$output" >/dev/null
printf 'SCREENSHOT_SORTER_APP_BUILT: %s\n' "$output"
