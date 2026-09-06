#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "voice-report" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
WHISPER_DIR="$(cd "$SCRIPT_DIR/../install/whisper" && pwd)"
WHISPER_TTS_CMD="$WHISPER_DIR/text-to-audio.sh"
VOICE_PROFILE_DEFAULT="$WHISPER_DIR/voice-report-fast.json"
BROWSER_CMD_SCRIPT="$(cd "$SCRIPT_DIR/../browser" && pwd)/browser.command.sh"
BROWSER_ASSETS_DIR="$SCRIPT_DIR/browser"
BROWSER_RENDERER="$BROWSER_ASSETS_DIR/render-voice-report.py"
VOICE_REPORT_APP="$SCRIPT_DIR/app.sh"

text=""
text_file=""
autoplay="1"
keep_temp="0"
voice_profile_file="$VOICE_PROFILE_DEFAULT"

usage() {
  cat <<'USAGE'
Usage:
  ${AI_COMMANDS_ROOT}/voice-report/voice-report.command.sh --text "Spoken report text"
  ${AI_COMMANDS_ROOT}/voice-report/voice-report.command.sh --text-file /tmp/report.txt
  printf 'Spoken report text\n' | ${AI_COMMANDS_ROOT}/voice-report/voice-report.command.sh
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --text) text="${2:-}"; shift 2 ;;
    --text-file) text_file="${2:-}"; shift 2 ;;
    --voice-profile-file) voice_profile_file="${2:-}"; shift 2 ;;
    --no-autoplay) autoplay="0"; shift ;;
    --keep-temp) keep_temp="1"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -n "$text" ] && [ -n "$text_file" ]; then
  echo "Use either --text or --text-file, not both." >&2
  exit 2
fi

if [ -n "$text_file" ]; then
  if [ ! -f "$text_file" ]; then
    echo "Missing text file: $text_file" >&2
    exit 1
  fi
  raw_text="$(cat "$text_file")"
elif [ -n "$text" ]; then
  raw_text="$text"
elif [ ! -t 0 ]; then
  raw_text="$(cat)"
else
  echo "Missing summary text. Use --text, --text-file, or stdin." >&2
  exit 2
fi

sanitize_text() {
  command_python - "$1" <<'PYTEXT'
import re
import sys

text = sys.argv[1]
patterns = [
    (re.compile(r'(?i)\b(password|passwd|api[_ -]?key|token|secret|private[_ -]?key)\b\s*[:=]\s*\S+'), r'\1: [redacted]'),
    (re.compile(r'(?i)bearer\s+[A-Za-z0-9._\-]+'), 'Bearer [redacted]'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), '[redacted-aws-key]'),
    (re.compile(r'sk-[A-Za-z0-9]{10,}'), '[redacted-openai-key]'),
]
for pattern, repl in patterns:
    text = pattern.sub(repl, text)
text = re.sub(r'\s+', ' ', text).strip()
print(text)
PYTEXT
}

safe_text="$(sanitize_text "$raw_text")"
if [ -z "$safe_text" ]; then
  echo "Summary text is empty after sanitization." >&2
  exit 1
fi

if [ ! -f "$voice_profile_file" ]; then
  echo "Missing voice profile file: $voice_profile_file" >&2
  exit 1
fi
if [ ! -x "$WHISPER_TTS_CMD" ]; then
  echo "Missing Whisper TTS runtime: $WHISPER_TTS_CMD" >&2
  exit 1
fi
if [ ! -x "$BROWSER_RENDERER" ]; then
  echo "Missing voice report browser renderer: $BROWSER_RENDERER" >&2
  exit 1
fi

work_dir="$(mktemp -d /tmp/voice-report.XXXXXX)"
text_tmp="$work_dir/voice-report.txt"
audio_tmp="$work_dir/voice-report.wav"
directive_tmp="$work_dir/voice-report.directives.log"
html_tmp="$work_dir/voice-report.html"
launcher_opened="0"

cleanup() {
  if [ "$keep_temp" != "1" ] && [ "$launcher_opened" != "1" ]; then
    rm -f "$text_tmp" "$audio_tmp" "$directive_tmp" "$audio_tmp.directives.log" "$html_tmp"
    rm -f "$work_dir/voice-report.css" "$work_dir/voice-report.js"
    rmdir "$work_dir/browser-profile" 2>/dev/null || true
    rmdir "$work_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT

render_browser_report() {
  "$BROWSER_RENDERER" \
    --text "$safe_text" \
    --audio-file "$audio_tmp" \
    --output "$html_tmp" \
    --assets-dir "$BROWSER_ASSETS_DIR"
}

open_voice_report_launcher() {
  [ "$autoplay" = "1" ] || return 0

  if [ ! -x "$VOICE_REPORT_APP" ]; then
    echo "Missing Voice Report launcher: $VOICE_REPORT_APP" >&2
    return 1
  fi
  if "$VOICE_REPORT_APP" --detach --text-file "$text_tmp" --audio-file "$audio_tmp" >/dev/null 2>&1; then
    launcher_opened="1"
    echo "Voice Report launcher opened via app.sh"
    return 0
  fi
  echo "Voice Report launcher failed to open via app.sh" >&2
  return 1
}

printf '%s\n' "$safe_text" > "$text_tmp"

echo "Voice report summary: $safe_text"
launcher_opened="0"

WHISPER_AUTOPLAY=0 \
WHISPER_REQUIRE_NEURAL=1 \
WHISPER_TTS_TEXT_FILE="$text_tmp" \
WHISPER_TTS_PROFILES_FILE="$voice_profile_file" \
WHISPER_TTS_DEFAULT_UNLABELED_SPEAKER="reporter" \
"$WHISPER_TTS_CMD" "" "$audio_tmp"

if [ "$autoplay" = "1" ]; then
  if ! open_voice_report_launcher; then
    launcher_opened="0"
  fi
  if [ "$launcher_opened" = "1" ]; then
    echo "Voice Report launcher opened with generated audio."
  else
    echo "Voice Report launcher open failed; falling back to terminal audio playback."
    "$WHISPER_DIR/play-audio.sh" "$audio_tmp" || true
  fi
fi

if [ "$keep_temp" = "1" ] || [ "$launcher_opened" = "1" ]; then
  echo "Kept temp files in: $work_dir"
fi
