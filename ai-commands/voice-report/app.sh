#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${VOICE_REPORT_REPO_ROOT:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
APP_ROOT="${VOICE_REPORT_APP_ROOT:-$REPO_ROOT/ai}"
ELECTRON_BIN="$APP_ROOT/node_modules/.bin/electron"
NPM_BIN="${VOICE_REPORT_NPM_BIN:-npm}"
BOOTSTRAP_DRY_RUN="${VOICE_REPORT_BOOTSTRAP_DRY_RUN:-0}"
DETACH="0"
WAIT_READY="1"
READY_TIMEOUT_SECONDS="${VOICE_REPORT_READY_TIMEOUT_SECONDS:-10}"
READY_STABILITY_SECONDS="${VOICE_REPORT_READY_STABILITY_SECONDS:-2}"
READY_FILE_VALUE=""
ELECTRON_ARGS=("--autoplay-policy=no-user-gesture-required")
TEXT_VALUE=""
TEXT_FILE_VALUE=""
AUDIO_FILE_VALUE=""
VOICE_PROFILE_VALUE=""
VOICE_SPEAKER_VALUE="${VOICE_REPORT_SPEAKER:-reporter}"
VOICE_GENDER_VALUE=""
VOICE_ID_VALUE=""
SERVE_CHECK="0"
MUTED_VALUE="0"
PASSTHROUGH_ARGS=()
GENERATED_TEMP_DIR=""
TEXT_FILE_GENERATED_FROM_TEXT="0"
FORWARDED_ARGS=()
if [[ "$(uname -s)" == "Linux" ]]; then
  ELECTRON_ARGS+=("--no-sandbox" "--disable-setuid-sandbox")
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach)
      DETACH="1"
      shift
      ;;
    --wait-ready)
      WAIT_READY="1"
      shift
      ;;
    --no-wait-ready)
      WAIT_READY="0"
      shift
      ;;
    --ready-timeout)
      READY_TIMEOUT_SECONDS="${2:-10}"
      shift 2
      ;;
    --serve-check)
      SERVE_CHECK="1"
      shift
      ;;
    --muted)
      MUTED_VALUE="1"
      shift
      ;;
    --text)
      TEXT_VALUE="${2:-}"
      shift 2
      ;;
    --text-file)
      TEXT_FILE_VALUE="${2:-}"
      shift 2
      ;;
    --audio-file)
      AUDIO_FILE_VALUE="${2:-}"
      shift 2
      ;;
    --voice-profile-file)
      VOICE_PROFILE_VALUE="${2:-}"
      shift 2
      ;;
    --voice-speaker)
      VOICE_SPEAKER_VALUE="${2:-}"
      shift 2
      ;;
    --ready-file)
      READY_FILE_VALUE="${2:-}"
      shift 2
      ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  ./app.sh --text "Finished the task" [--audio-file /tmp/report.wav]
  ./app.sh --text-file /tmp/report.txt --audio-file /tmp/report.wav [--detach]
  ./app.sh --detach --text "Finished the task" [--ready-timeout 10]
  ./app.sh --text "Finished" --voice-profile-file /path/profile.json --voice-speaker reporter
  ./app.sh --serve-check
  ./app.sh --detach --muted --text "Smoke test"
USAGE
      exit 0
      ;;
    *)
      PASSTHROUGH_ARGS+=("$1")
      shift
      ;;
  esac
done

# The command picker invokes this launcher without report text. Give that
# interactive entrypoint a short, real report so the UI never opens in its
# transcript-only state with no audio selected.
if [[ "$SERVE_CHECK" != "1" && -z "$TEXT_VALUE" && -z "$TEXT_FILE_VALUE" && -z "$AUDIO_FILE_VALUE" ]]; then
  TEXT_VALUE="Voice Report launcher is ready."
fi

resolve_voice_metadata() {
  if [[ "$SERVE_CHECK" == "1" ]]; then
    return
  fi
  local whisper_dir="$SCRIPT_DIR/../install/whisper"
  VOICE_PROFILE_VALUE="${VOICE_PROFILE_VALUE:-${VOICE_REPORT_PROFILE:-$whisper_dir/voice-report-fast.json}}"
  if [[ ! -f "$VOICE_PROFILE_VALUE" ]]; then
    echo "Missing Voice Report voice profile: $VOICE_PROFILE_VALUE" >&2
    exit 1
  fi
  local metadata
  metadata="$(python3 - "$VOICE_PROFILE_VALUE" "$VOICE_SPEAKER_VALUE" <<'PY'
import json
import re
import sys
from pathlib import Path

def normalize(value):
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').strip().lower()).strip('-')

profile_file, speaker = sys.argv[1], sys.argv[2]
wanted = normalize(speaker)
raw = json.loads(Path(profile_file).read_text(encoding='utf-8'))
profiles = raw.get('profiles', raw) if isinstance(raw, dict) else raw
if not isinstance(profiles, list):
    raise SystemExit(f'Invalid profiles file shape: {profile_file}')
for profile in profiles:
    if not isinstance(profile, dict):
        continue
    aliases = []
    for value in (profile.get('id'), profile.get('speaker')):
        if isinstance(value, str) and value.strip():
            aliases.append(normalize(value))
    extra = profile.get('aliases')
    if isinstance(extra, list):
        aliases.extend(normalize(v) for v in extra if isinstance(v, str) and v.strip())
    if wanted in aliases:
        gender = normalize(profile.get('gender'))
        voice = str(profile.get('voice', '') or '').strip()
        print(f'gender={gender}')
        print(f'voice={voice}')
        raise SystemExit(0)
raise SystemExit(f'No voice profile entry found for speaker: {speaker}')
PY
)"
  VOICE_GENDER_VALUE="$(printf '%s
' "$metadata" | awk -F= '$1=="gender" {print $2; exit}')"
  VOICE_ID_VALUE="$(printf '%s
' "$metadata" | awk -F= '$1=="voice" {print $2; exit}')"
  if [[ "$VOICE_GENDER_VALUE" != "male" && "$VOICE_GENDER_VALUE" != "female" ]]; then
    echo "Voice Report cannot play: voice gender is not clear for speaker '$VOICE_SPEAKER_VALUE' in $VOICE_PROFILE_VALUE. Set gender to male or female." >&2
    exit 1
  fi
}

synthesize_audio_if_needed() {
  if [[ "$SERVE_CHECK" == "1" || -n "$AUDIO_FILE_VALUE" ]]; then
    return
  fi
  if [[ -z "$TEXT_VALUE" && -z "$TEXT_FILE_VALUE" ]]; then
    return
  fi

  local whisper_dir="$SCRIPT_DIR/../install/whisper"
  local tts_command="$whisper_dir/text-to-audio.sh"
  local voice_profile="$VOICE_PROFILE_VALUE"
  if [[ ! -x "$tts_command" ]]; then
    echo "Missing Voice Report TTS command: $tts_command" >&2
    exit 1
  fi

  GENERATED_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/voice-report-app.XXXXXX")"
  if [[ -n "$TEXT_VALUE" ]]; then
    TEXT_FILE_VALUE="$GENERATED_TEMP_DIR/report.txt"
    printf '%s: %s\n' "$VOICE_SPEAKER_VALUE" "$TEXT_VALUE" >"$TEXT_FILE_VALUE"
    TEXT_FILE_GENERATED_FROM_TEXT="1"
  fi
  AUDIO_FILE_VALUE="$GENERATED_TEMP_DIR/report.wav"

  # Never let a local fallback bypass the strict voice-profile checks.
  if ! WHISPER_AUTOPLAY=0 \
    WHISPER_REQUIRE_NEURAL=1 \
    WHISPER_TTS_STRICT_PROFILES=1 \
    WHISPER_TTS_TEXT_FILE="$TEXT_FILE_VALUE" \
    WHISPER_TTS_PROFILES_FILE="$voice_profile" \
    WHISPER_TTS_DEFAULT_UNLABELED_SPEAKER="$VOICE_SPEAKER_VALUE" \
    "$tts_command" --validate-only "" "$AUDIO_FILE_VALUE"; then
    echo "Voice Report cannot play: TTS profile validation failed. Check for unclear voice gender or an accidental speaker label such as 'Name:' that is not defined in $voice_profile." >&2
    exit 1
  fi

  if ! WHISPER_AUTOPLAY=0 \
    WHISPER_REQUIRE_NEURAL=1 \
    WHISPER_TTS_STRICT_PROFILES=1 \
    WHISPER_TTS_TEXT_FILE="$TEXT_FILE_VALUE" \
    WHISPER_TTS_PROFILES_FILE="$voice_profile" \
    WHISPER_TTS_DEFAULT_UNLABELED_SPEAKER="$VOICE_SPEAKER_VALUE" \
    "$tts_command" "" "$AUDIO_FILE_VALUE"; then
    # Keep reports audible on macOS if the remote neural voice service is
    # temporarily unavailable. The normal neural path above remains preferred.
    if [[ "$(uname -s)" == "Darwin" ]] && command -v say >/dev/null 2>&1 && command -v afconvert >/dev/null 2>&1; then
      local fallback_aiff="$GENERATED_TEMP_DIR/report.aiff"
      local fallback_voice="Samantha"
      if [[ "$VOICE_GENDER_VALUE" == "male" ]]; then
        fallback_voice="Alex"
      fi
      if [[ -n "$TEXT_VALUE" ]]; then
        say -v "$fallback_voice" -o "$fallback_aiff" "$TEXT_VALUE" && \
          afconvert -f WAVE -d LEI16 "$fallback_aiff" "$AUDIO_FILE_VALUE"
      else
        say -v "$fallback_voice" -o "$fallback_aiff" -f "$TEXT_FILE_VALUE" && \
          afconvert -f WAVE -d LEI16 "$fallback_aiff" "$AUDIO_FILE_VALUE"
      fi
      if [[ -s "$AUDIO_FILE_VALUE" ]]; then
        VOICE_ID_VALUE="$fallback_voice"
        echo "Voice Report is using the local macOS voice because neural TTS was unavailable." >&2
        return
      fi
    fi
    echo "Voice Report cannot play: TTS profile validation failed. Check for unclear voice gender or an accidental speaker label such as 'Name:' that is not defined in $voice_profile." >&2
    exit 1
  fi
}

build_forwarded_args() {
  FORWARDED_ARGS=()
  if [[ "$SERVE_CHECK" == "1" ]]; then
    FORWARDED_ARGS+=("--serve-check")
  fi
  if [[ -n "$TEXT_FILE_VALUE" ]]; then
    FORWARDED_ARGS+=("--text-file" "$TEXT_FILE_VALUE")
    if [[ "$TEXT_FILE_GENERATED_FROM_TEXT" == "1" && -n "$TEXT_VALUE" ]]; then
      FORWARDED_ARGS+=("--text" "$TEXT_VALUE")
    fi
  elif [[ -n "$TEXT_VALUE" ]]; then
    FORWARDED_ARGS+=("--text" "$TEXT_VALUE")
  fi
  if [[ -n "$AUDIO_FILE_VALUE" ]]; then
    FORWARDED_ARGS+=("--audio-file" "$AUDIO_FILE_VALUE")
  fi
  if [[ -n "$VOICE_GENDER_VALUE" ]]; then
    FORWARDED_ARGS+=("--voice-gender" "$VOICE_GENDER_VALUE")
  fi
  if [[ -n "$VOICE_ID_VALUE" ]]; then
    FORWARDED_ARGS+=("--voice-id" "$VOICE_ID_VALUE")
  fi
  if [[ "$MUTED_VALUE" == "1" ]]; then
    FORWARDED_ARGS+=("--muted")
  fi
  if [[ -n "$READY_FILE_VALUE" ]]; then
    FORWARDED_ARGS+=("--ready-file" "$READY_FILE_VALUE")
  fi
  # Bash 3.2 treats an empty array expansion as unset under `set -u`.
  # The command picker launches this script with no extra arguments.
  if [[ ${#PASSTHROUGH_ARGS[@]} -gt 0 ]]; then
    FORWARDED_ARGS+=("${PASSTHROUGH_ARGS[@]}")
  fi
}

wait_for_launcher_ready() {
  local electron_pid="$1"
  local deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    if [[ -s "$READY_FILE_VALUE" ]]; then
      local ready_status
      ready_status="$(node -e "const fs=require('fs'); const p=process.argv[1]; const data=JSON.parse(fs.readFileSync(p,'utf8')); process.stdout.write(String(data.status || ''));" "$READY_FILE_VALUE" 2>/dev/null || true)"
      if [[ "$ready_status" == "playing" ]]; then
        local window_visible
        window_visible="$(node -e "const fs=require('fs'); const p=process.argv[1]; const data=JSON.parse(fs.readFileSync(p,'utf8')); process.stdout.write(String(data.windowVisible || false));" "$READY_FILE_VALUE" 2>/dev/null || true)"
        if [[ "$window_visible" != "true" ]]; then
          echo "Voice Report launcher reported playback without a visible window." >&2
          cat "$READY_FILE_VALUE" >&2
          return 1
        fi
        sleep "$READY_STABILITY_SECONDS"
        if ! kill -0 "$electron_pid" 2>/dev/null; then
          echo "Voice Report launcher reported playback but exited during the ${READY_STABILITY_SECONDS}s stability check. Log: /tmp/voice-report-launcher.log" >&2
          tail -n 80 /tmp/voice-report-launcher.log >&2 || true
          return 1
        fi
        echo "Voice Report launcher visible and playing. PID: $electron_pid Ready: $READY_FILE_VALUE Log: /tmp/voice-report-launcher.log"
        return 0
      fi
      echo "Voice Report launcher reported non-playing status: ${ready_status:-unknown}" >&2
      cat "$READY_FILE_VALUE" >&2
      return 1
    fi
    if ! kill -0 "$electron_pid" 2>/dev/null; then
      echo "Voice Report launcher exited before reporting ready. Log: /tmp/voice-report-launcher.log" >&2
      tail -n 80 /tmp/voice-report-launcher.log >&2 || true
      return 1
    fi
    sleep 0.2
  done
  echo "Voice Report launcher did not report audio playback within ${READY_TIMEOUT_SECONDS}s. PID: $electron_pid Log: /tmp/voice-report-launcher.log" >&2
  tail -n 80 /tmp/voice-report-launcher.log >&2 || true
  return 1
}

bootstrap_node_deps() {
  if [[ -x "$ELECTRON_BIN" ]]; then
    return
  fi
  if [[ ! -f "$APP_ROOT/package-lock.json" ]]; then
    echo "Missing Node dependencies and package-lock.json is not available for bootstrap: $APP_ROOT" >&2
    exit 1
  fi
  if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
    echo "Missing Node dependencies and npm is not installed." >&2
    exit 1
  fi
  local npm_command="install"
  if [[ ! -d "$APP_ROOT/node_modules" ]]; then
    npm_command="ci"
  fi
  if [[ "$BOOTSTRAP_DRY_RUN" == "1" ]]; then
    echo "Would run npm $npm_command for Voice Report launcher bootstrap."
    return
  fi
  echo "Installing missing Node dependencies for Voice Report launcher with npm $npm_command..." >&2
  (cd "$APP_ROOT" && "$NPM_BIN" "$npm_command")
}

has_modern_bash() {
  local candidate
  for candidate in /opt/homebrew/bin/bash /usr/local/bin/bash /usr/bin/bash /bin/bash; do
    if [[ -x "$candidate" ]] && "$candidate" -c '[[ ${BASH_VERSINFO[0]} -ge 4 ]]' 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

ensure_tts_runtime() {
  local python_user_bin python_bin
  if [[ "$(uname -s)" == "Darwin" ]] && ! has_modern_bash; then
    if ! command -v brew >/dev/null 2>&1; then
      echo "Voice Report needs Bash 4 or newer, but Homebrew is unavailable to install it." >&2
      exit 1
    fi
    echo "Installing the Voice Report Bash runtime..." >&2
    brew install bash
  fi

  if command -v python3 >/dev/null 2>&1; then
    python_user_bin="$(python3 -m site --user-base 2>/dev/null)/bin"
    [[ -d "$python_user_bin" ]] && PATH="$python_user_bin:$PATH"
  fi
  if [[ -n "${HOME:-}" && -d "$HOME/Library/Python" ]]; then
    for python_bin in "$HOME"/Library/Python/*/bin; do
      [[ -d "$python_bin" ]] || continue
      PATH="$python_bin:$PATH"
    done
  fi
  export PATH

  if command -v edge-tts >/dev/null 2>&1; then
    return
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Voice Report needs Python 3 to install its speech runtime." >&2
    exit 1
  fi
  echo "Installing the Voice Report speech runtime..." >&2
  python3 -m pip install --user --upgrade edge-tts
}

bootstrap_node_deps

if [[ "$BOOTSTRAP_DRY_RUN" == "1" ]]; then
  exit 0
fi

resolve_voice_metadata
if [[ "$SERVE_CHECK" != "1" && -z "$AUDIO_FILE_VALUE" ]]; then
  ensure_tts_runtime
fi
synthesize_audio_if_needed
if [[ "$DETACH" == "1" && "$WAIT_READY" == "1" && -z "$READY_FILE_VALUE" ]]; then
  if [[ -z "$GENERATED_TEMP_DIR" ]]; then
    GENERATED_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/voice-report-app.XXXXXX")"
  fi
  READY_FILE_VALUE="$GENERATED_TEMP_DIR/ready.json"
fi
build_forwarded_args

if [[ ! -x "$ELECTRON_BIN" ]]; then
  echo "Missing Electron after dependency bootstrap: $ELECTRON_BIN" >&2
  exit 1
fi

run_electron() {
  if [[ ${#FORWARDED_ARGS[@]} -gt 0 ]]; then
    VOICE_REPORT_COMMAND_DIR="$SCRIPT_DIR" \
      "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" "${FORWARDED_ARGS[@]}"
  else
    VOICE_REPORT_COMMAND_DIR="$SCRIPT_DIR" \
      "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs"
  fi
}

run_electron_detached() {
  if command -v setsid >/dev/null 2>&1; then
    if [[ ${#FORWARDED_ARGS[@]} -gt 0 ]]; then
      nohup setsid env VOICE_REPORT_COMMAND_DIR="$SCRIPT_DIR" \
        "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" "${FORWARDED_ARGS[@]}" \
        </dev/null >>/tmp/voice-report-launcher.log 2>&1 &
    else
      nohup setsid env VOICE_REPORT_COMMAND_DIR="$SCRIPT_DIR" \
        "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" \
        </dev/null >>/tmp/voice-report-launcher.log 2>&1 &
    fi
  else
    if [[ ${#FORWARDED_ARGS[@]} -gt 0 ]]; then
      nohup env VOICE_REPORT_COMMAND_DIR="$SCRIPT_DIR" \
        "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" "${FORWARDED_ARGS[@]}" \
        </dev/null >>/tmp/voice-report-launcher.log 2>&1 &
    else
      nohup env VOICE_REPORT_COMMAND_DIR="$SCRIPT_DIR" \
        "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" \
        </dev/null >>/tmp/voice-report-launcher.log 2>&1 &
    fi
  fi
  echo "$!"
}

if [[ "$DETACH" == "1" ]]; then
  : > /tmp/voice-report-launcher.log
  electron_pid="$(run_electron_detached)"
  if [[ "$WAIT_READY" == "1" ]]; then
    wait_for_launcher_ready "$electron_pid"
    exit $?
  fi
  echo "Voice Report launcher started. PID: $electron_pid Log: /tmp/voice-report-launcher.log"
  exit 0
fi

run_electron
