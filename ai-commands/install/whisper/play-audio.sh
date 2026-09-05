#!/usr/bin/env bash
set -euo pipefail

audio_file="${1:-}"
if [ -z "$audio_file" ] || [ ! -f "$audio_file" ]; then
  echo "Usage: $0 <audio-file>"
  exit 1
fi

run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "${seconds}s" "$@"
  else
    "$@"
  fi
}

if command -v ffplay >/dev/null 2>&1; then
  ffplay -nodisp -autoexit -loglevel quiet "$audio_file" 2>/dev/null
  exit 0
fi

if command -v mpv >/dev/null 2>&1; then
  # Disable external scripts to avoid DBus/MPRIS noise in terminal environments.
  mpv --no-config --load-scripts=no --no-video --really-quiet "$audio_file" 2>/dev/null
  exit 0
fi

echo "No CLI audio player found (mpv/ffplay)."
exit 1
