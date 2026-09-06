#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_file="${AI_COMMAND_CONFIG_PATH:-}"
[[ -n "$config_file" && -f "$config_file" ]] || { echo 'Profile-owned Whisper config required.' >&2; exit 2; }
if [ -f "$config_file" ]; then
  # shellcheck disable=SC1090
  source "$config_file"
fi

feature_install_edge_tts="${WHISPER_FEATURE_INSTALL_EDGE_TTS:-1}"
feature_install_espeak="${WHISPER_FEATURE_INSTALL_ESPEAK_NG:-1}"
feature_install_player="${WHISPER_FEATURE_INSTALL_PLAYER:-1}"

if ! command -v whisper >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  exit 1
fi

if [ "$feature_install_edge_tts" = "1" ] && ! command -v edge-tts >/dev/null 2>&1; then
  exit 1
fi

if [ "$feature_install_edge_tts" != "1" ] && [ "$feature_install_espeak" = "1" ] && ! command -v espeak-ng >/dev/null 2>&1; then
  exit 1
fi

if [ "$feature_install_player" = "1" ] && ! command -v mpv >/dev/null 2>&1; then
  exit 1
fi

if [ "$feature_install_player" != "1" ] && ! command -v ffplay >/dev/null 2>&1 && ! command -v mpv >/dev/null 2>&1; then
  exit 1
fi

if command -v whisper >/dev/null 2>&1; then
  exit 0
fi

exit 1
