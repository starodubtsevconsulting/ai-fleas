#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMMAND_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/voice-report-test.XXXXXX")"
READY_FILE="$WORK_DIR/ready.json"
MALE_READY_FILE="$WORK_DIR/male-ready.json"

cleanup() {
  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill "$pid" 2>/dev/null || true
    done < <(pgrep -f "voice-report/launcher/electron/main.cjs.*($READY_FILE|$MALE_READY_FILE)" || true)
  fi
}
trap cleanup EXIT

echo "[TEST] Running voice-report command-picker smoke test..."
# The command picker invokes app.sh with no report arguments. It must still
# synthesize the default report instead of showing a transcript with no audio.
"$COMMAND_DIR/app.sh" --detach --muted --ready-file "$READY_FILE" --ready-timeout "${VOICE_REPORT_TEST_READY_TIMEOUT_SECONDS:-12}"

node -e '
const fs = require("fs");
const readyFile = process.argv[1];
const data = JSON.parse(fs.readFileSync(readyFile, "utf8"));
if (data.status !== "playing") {
  throw new Error(`expected status playing, got ${data.status}`);
}
if (data.windowVisible !== true) {
  throw new Error("expected windowVisible true");
}
if (data.voiceGender !== "female") {
  throw new Error(`expected default voiceGender female, got ${data.voiceGender}`);
}
if (data.muted !== true) {
  throw new Error("expected smoke test playback to be muted");
}
if (data.voiceId !== "en-US-AriaNeural" && data.voiceId !== "Samantha") {
  throw new Error(`expected neural or macOS fallback voice, got ${data.voiceId}`);
}
if (!data.audioFile || !fs.existsSync(data.audioFile)) {
  throw new Error("expected generated audio file to exist");
}
const stat = fs.statSync(data.audioFile);
if (stat.size <= 44) {
  throw new Error(`expected non-empty wav, got ${stat.size} bytes`);
}
' "$READY_FILE"

if ! pgrep -f "voice-report/launcher/electron/main.cjs.*$READY_FILE" >/dev/null 2>&1; then
  echo "Voice Report launcher process is not alive after app.sh returned." >&2
  exit 1
fi

MALE_TEXT="Voice report male selection smoke test. Explicit male reporter should use the male voice and blue face."
"$COMMAND_DIR/app.sh" --detach --muted --ready-file "$MALE_READY_FILE" --ready-timeout "${VOICE_REPORT_TEST_READY_TIMEOUT_SECONDS:-12}" --voice-speaker male-reporter --text "$MALE_TEXT"
node -e '
const fs = require("fs");
const readyFile = process.argv[1];
const data = JSON.parse(fs.readFileSync(readyFile, "utf8"));
if (data.status !== "playing") throw new Error(`expected status playing, got ${data.status}`);
if (data.windowVisible !== true) throw new Error("expected windowVisible true");
if (data.voiceGender !== "male") throw new Error(`expected male override voiceGender male, got ${data.voiceGender}`);
if (data.voiceId !== "en-US-AndrewNeural" && data.voiceId !== "Alex") {
  throw new Error(`expected neural or macOS male fallback voice, got ${data.voiceId}`);
}
if (data.muted !== true) throw new Error("expected male smoke test playback to be muted");
' "$MALE_READY_FILE"
if ! pgrep -f "voice-report/launcher/electron/main.cjs.*$MALE_READY_FILE" >/dev/null 2>&1; then
  echo "Voice Report male launcher process is not alive after app.sh returned." >&2
  exit 1
fi

UNCLEAR_PROFILE="$WORK_DIR/unclear-profile.json"
cat >"$UNCLEAR_PROFILE" <<'JSON'
[
  {
    "id": "reporter",
    "speaker": "Voice Reporter",
    "aliases": ["reporter"],
    "voice": "en-US-TestNeural"
  }
]
JSON
if "$COMMAND_DIR/app.sh" --text "This must not play." --voice-profile-file "$UNCLEAR_PROFILE" >/tmp/voice-report-unclear-gender.log 2>&1; then
  echo "Voice Report played with an unclear voice gender." >&2
  exit 1
fi
if ! grep -q "voice gender is not clear" /tmp/voice-report-unclear-gender.log; then
  echo "Voice Report unclear-gender failure did not explain the gender problem." >&2
  cat /tmp/voice-report-unclear-gender.log >&2
  exit 1
fi

UNKNOWN_SPEAKER_TEXT="$WORK_DIR/unknown-speaker.txt"
printf '%s
' "Unexpected speaker: This must not play." >"$UNKNOWN_SPEAKER_TEXT"
if "$COMMAND_DIR/app.sh" --text-file "$UNKNOWN_SPEAKER_TEXT" >/tmp/voice-report-unknown-speaker.log 2>&1; then
  echo "Voice Report played with an unknown parsed speaker label." >&2
  exit 1
fi
if ! grep -q "TTS profile validation failed" /tmp/voice-report-unknown-speaker.log; then
  echo "Voice Report unknown-speaker failure did not explain the profile problem." >&2
  cat /tmp/voice-report-unknown-speaker.log >&2
  exit 1
fi

echo "voice-report launcher smoke test passed"
