#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install_root="$(cd "$script_dir/.." && pwd)"
install_log="$install_root/logs/install.log"
config_file="${AI_COMMAND_CONFIG_PATH:-}"
[[ -n "$config_file" && -f "$config_file" ]] || { echo 'Profile-owned Whisper config required.' >&2; exit 2; }
fail_count=0

if [ -f "$config_file" ]; then
  # shellcheck disable=SC1090
  source "$config_file"
fi

require_neural="${WHISPER_REQUIRE_NEURAL:-${WHISPER_FEATURE_REQUIRE_NEURAL:-1}}"
feature_install_espeak="${WHISPER_FEATURE_INSTALL_ESPEAK_NG:-1}"
skip_install_log_status="${WHISPER_SMOKE_SKIP_INSTALL_LOG_STATUS:-0}"
whisper_device="${WHISPER_SMOKE_DEVICE:-cpu}"

ok() {
  echo "[OK] $1"
}

fail() {
  echo "[FAIL] $1"
  fail_count=$((fail_count + 1))
}

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "command available: $cmd"
  else
    fail "command missing: $cmd"
  fi
}

echo "Whisper smoke test started"

check_cmd whisper
check_cmd ffmpeg
if [ "$require_neural" = "1" ]; then
  check_cmd edge-tts
elif [ "$feature_install_espeak" = "1" ]; then
  if command -v edge-tts >/dev/null 2>&1 || command -v espeak-ng >/dev/null 2>&1; then
    ok "tts engine available (edge-tts or espeak-ng)"
  else
    fail "tts engine missing (edge-tts/espeak-ng)"
  fi
else
  check_cmd edge-tts
fi

if command -v ffplay >/dev/null 2>&1 || command -v mpv >/dev/null 2>&1; then
  ok "audio player available (ffplay or mpv)"
else
  fail "audio player missing (ffplay/mpv)"
fi

if [ -f "$install_log" ]; then
  ok "install log exists: $install_log"
  last_status="$(awk '$2=="whisper/install.sh"{s=$3} END{print s}' "$install_log")"
  if [ "$skip_install_log_status" = "1" ]; then
    ok "install log status check skipped for installer-triggered smoke test"
  elif [ "$last_status" = "OK" ]; then
    ok "latest whisper/install.sh status in install log is OK"
  else
    fail "latest whisper/install.sh status in install log is not OK (found: ${last_status:-none})"
  fi
else
  fail "install log missing: $install_log (run whisper/install.sh)"
fi

if [ "$fail_count" -gt 0 ]; then
  echo "Smoke test pre-checks failed ($fail_count)."
  exit 1
fi

work_dir="${WHISPER_CHECK_DIR:-$script_dir/test}"
sample_text="${1-}"
audio_file="$work_dir/output.wav"

mkdir -p "$work_dir"
if [ -n "$sample_text" ]; then
  text_to_audio_cmd=( "$script_dir/text-to-audio.sh" "$sample_text" "$audio_file" )
else
  text_to_audio_cmd=( "$script_dir/text-to-audio.sh" "" "$audio_file" )
fi

if WHISPER_AUTOPLAY="${WHISPER_AUTOPLAY:-0}" "${text_to_audio_cmd[@]}"; then
  ok "text-to-audio generation completed"
else
  fail "text-to-audio generation failed"
fi

if [ -s "$audio_file" ]; then
  ok "audio file exists: $audio_file"
else
  fail "audio file missing or empty: $audio_file"
fi

if whisper "$audio_file" \
  --model tiny \
  --language en \
  --task transcribe \
  --device "$whisper_device" \
  --output_dir "$work_dir" \
  --output_format txt \
  --fp16 False \
  --verbose False; then
  ok "whisper transcription command completed"
else
  fail "whisper transcription command failed"
fi

transcript_file="$work_dir/output.txt"
voice_report_profile="$script_dir/voice-report-fast.json"
voice_report_dir="$(mktemp -d /tmp/voice-report-smoke.XXXXXX)"
voice_report_text="$voice_report_dir/report.txt"
voice_report_audio="$voice_report_dir/report.wav"
printf '%s
' 'Voice report smoke test completed.' > "$voice_report_text"
if WHISPER_AUTOPLAY=0 WHISPER_TTS_TEXT_FILE="$voice_report_text" WHISPER_TTS_PROFILES_FILE="$voice_report_profile" WHISPER_TTS_DEFAULT_UNLABELED_SPEAKER="reporter" "$script_dir/text-to-audio.sh" "" "$voice_report_audio"; then
  ok "voice-report readiness generation completed"
else
  fail "voice-report readiness generation failed"
fi
if [ -s "$voice_report_audio" ]; then
  ok "voice-report audio file exists: $voice_report_audio"
else
  fail "voice-report audio file missing or empty: $voice_report_audio"
fi
rm -f "$voice_report_text" "$voice_report_audio" "$voice_report_audio.directives.log"
rmdir "$voice_report_dir" 2>/dev/null || true

if [ ! -s "$transcript_file" ]; then
  fail "transcript file missing or empty: $transcript_file"
else
  ok "transcript file exists: $transcript_file"
fi

if [ "$fail_count" -gt 0 ]; then
  echo "Smoke test failed with $fail_count issue(s)."
  exit 1
fi

echo "Smoke test complete."
echo "Audio: $audio_file"
echo "Transcript: $transcript_file"
