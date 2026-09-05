#!/usr/bin/env bash
set -euo pipefail

COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
mkdir -p "$TEMP_DIR/audio" "$TEMP_DIR/scene"
printf 'RIFF' > "$TEMP_DIR/audio/narration-v1.wav"
for number in 001 002 003; do printf 'png' > "$TEMP_DIR/scene/$number.png"; done
"$COMMAND_DIR/kdenlive.command.sh" scaffold --project-path "$TEMP_DIR" >/dev/null
"$COMMAND_DIR/kdenlive.command.sh" validate --project-path "$TEMP_DIR" >/dev/null
rg 'playlist id="main_bin"' "$TEMP_DIR/project.kdenlive" >/dev/null
if "$COMMAND_DIR/kdenlive.command.sh" scaffold --project-path "$TEMP_DIR" >/dev/null 2>&1; then
  echo 'expected scaffold to refuse overwrite' >&2
  exit 1
fi
rm "$TEMP_DIR/scene/003.png"
if "$COMMAND_DIR/kdenlive.command.sh" validate --project-path "$TEMP_DIR" | rg '"ready":false' >/dev/null; then
  :
else
  echo 'expected validation to report missing media' >&2
  exit 1
fi
echo 'kdenlive command tests passed'
