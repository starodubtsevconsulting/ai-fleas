#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMMAND_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/voice-report-audible-test.XXXXXX")"
READY_FILE="$WORK_DIR/ready.json"
TEXT="Voice report audible output test. This report is intentionally long enough to verify real system audio output. The default configured voice is female Aria and the launcher face should be rose. The test will fail if Electron reports playback but the operating system does not show an active unmuted audio sink input. This sentence keeps the sound playing for verification. This sentence keeps the sound playing for verification."

cleanup() {
  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      kill "$pid" 2>/dev/null || true
    done < <(pgrep -f "voice-report/launcher/electron/main.cjs.*$READY_FILE" || true)
  fi
}
trap cleanup EXIT

if ! command -v pactl >/dev/null 2>&1; then
  echo "Voice Report audible test cannot run: pactl is not available." >&2
  exit 1
fi


default_sink="$(pactl get-default-sink)"
sink_mute="$(pactl get-sink-mute @DEFAULT_SINK@)"
sink_volume="$(pactl get-sink-volume @DEFAULT_SINK@)"
echo "Voice Report audible output sink: $default_sink"
echo "Voice Report audible output sink mute: $sink_mute"
echo "Voice Report audible output sink volume: $sink_volume"
if printf '%s
' "$sink_mute" | grep -q 'Mute: yes'; then
  echo "Voice Report audible test failed: default output sink is muted." >&2
  exit 1
fi
if ! printf '%s
' "$sink_volume" | grep -Eq '/[[:space:]]*[1-9][0-9]*%'; then
  echo "Voice Report audible test failed: default output sink volume appears to be 0%." >&2
  exit 1
fi

"$COMMAND_DIR/app.sh" --detach --ready-file "$READY_FILE" --ready-timeout "${VOICE_REPORT_AUDIBLE_READY_TIMEOUT_SECONDS:-15}" --text "$TEXT"

node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (data.status !== "playing") throw new Error(`expected playing, got ${data.status}`);
if (data.muted === true) throw new Error("audible test must not be muted");
if (data.voiceGender !== "female") throw new Error(`expected default female voice, got ${data.voiceGender}`);
if (data.voiceId !== "en-US-AriaNeural") throw new Error(`expected Aria voice, got ${data.voiceId}`);
if (data.windowVisible !== true) throw new Error("expected visible launcher window");
' "$READY_FILE"

sink_seen=0
for _ in $(seq 1 30); do
  if pactl list sink-inputs 2>/dev/null | awk '
    BEGIN { in_block=0; electron=0; corked=0; muted=0; }
    /^Sink Input #/ { if (in_block && electron && !corked && !muted) found=1; in_block=1; electron=0; corked=0; muted=0; next }
    in_block && /application\.name = "Voice Report"/ { electron=1 }
    in_block && /application\.process\.binary = "electron"/ { electron=1 }
    in_block && /Corked: yes/ { corked=1 }
    in_block && /Mute: yes/ { muted=1 }
    END { if (in_block && electron && !corked && !muted) found=1; exit(found ? 0 : 1) }
  '; then
    sink_seen=1
    break
  fi
  sleep 0.2
done

if [ "$sink_seen" != "1" ]; then
  echo "Voice Report audible test failed: no active unmuted Electron/Voice Report sink input was detected." >&2
  echo "Current sink inputs:" >&2
  pactl list sink-inputs >&2 || true
  exit 1
fi

echo "voice-report audible output test passed"
