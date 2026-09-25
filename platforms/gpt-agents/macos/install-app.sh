#!/bin/zsh
set -euo pipefail

macos_root="$(cd "$(dirname "$0")" && pwd -P)"
repository_root="$(cd "$macos_root/../../.." && pwd -P)"
launcher="$macos_root/AI Fleas GPT.command"
applications_dir="${AI_FLEAS_APPLICATIONS_DIR:-$HOME/Applications}"
app_path="$applications_dir/AI Fleas GPT.app"
osacompile_bin="${AI_FLEAS_OSACOMPILE_BIN:-osacompile}"
defaults_bin="${AI_FLEAS_DEFAULTS_BIN:-defaults}"
open_bin="${AI_FLEAS_OPEN_BIN:-open}"
killall_bin="${AI_FLEAS_KILLALL_BIN:-killall}"

mkdir -p "$applications_dir"

"$osacompile_bin" -o "$app_path" \
  -e 'on run' \
  -e "set launcher to \"$launcher\"" \
  -e 'try' \
  -e 'do shell script "/bin/zsh -lic " & quoted form of (quoted form of launcher)' \
  -e 'on error errorMessage' \
  -e 'display dialog "AI Fleas GPT could not start:" & return & return & errorMessage buttons {"OK"} default button "OK" with icon stop' \
  -e 'end try' \
  -e 'end run'

if [[ "${AI_FLEAS_SKIP_APP_ICON:-0}" != "1" ]]; then
  icon_source="$repository_root/img/ai-flea-logo.png"
  icon_workspace="$(mktemp -d /private/tmp/ai-fleas-gpt-icon.XXXXXX)"
  trap 'rm -rf "$icon_workspace"' EXIT
  iconset="$icon_workspace/AI Fleas GPT.iconset"
  mkdir -p "$iconset"
  for specification in \
    '16 icon_16x16.png' \
    '32 icon_16x16@2x.png' \
    '32 icon_32x32.png' \
    '64 icon_32x32@2x.png' \
    '128 icon_128x128.png' \
    '256 icon_128x128@2x.png' \
    '256 icon_256x256.png' \
    '512 icon_256x256@2x.png' \
    '512 icon_512x512.png' \
    '1024 icon_512x512@2x.png'; do
    size="${specification%% *}"
    filename="${specification#* }"
    sips -z "$size" "$size" "$icon_source" --out "$iconset/$filename" >/dev/null
  done
  iconutil -c icns "$iconset" -o "$icon_workspace/AI Fleas GPT.icns"
  cp "$icon_workspace/AI Fleas GPT.icns" "$app_path/Contents/Resources/applet.icns"
  codesign --force --deep --sign - "$app_path" >/dev/null
fi

app_url="file://${app_path// /%20}/"
if ! "$defaults_bin" read com.apple.dock persistent-apps 2>/dev/null | grep -q 'AI Fleas GPT.app'; then
  "$defaults_bin" write com.apple.dock persistent-apps -array-add \
    "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>$app_url</string><key>_CFURLStringType</key><integer>15</integer></dict><key>file-label</key><string>AI Fleas GPT</string></dict><key>tile-type</key><string>file-tile</string></dict>"
  "$killall_bin" Dock
fi

"$open_bin" "$app_path"
print "AI Fleas GPT is installed in Applications and pinned to the Dock."
