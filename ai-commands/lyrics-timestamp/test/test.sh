#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$COMMAND_DIR/output/test"
AUDIO_FILE="$OUT_DIR/silent.wav"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

ffmpeg -hide_banner -loglevel error -f lavfi -i anullsrc=r=44100:cl=mono -t 6 -y "$AUDIO_FILE"

"$COMMAND_DIR/lyrics-timestamp.command.sh" map \
  --lyrics-file "$SCRIPT_DIR/fixtures/lyrics.txt" \
  --audio-file "$AUDIO_FILE" \
  --dist "$OUT_DIR"

python3 - "$OUT_DIR/lyrics-timestamp.json" "$OUT_DIR/lyrics-timestamp.srt" <<'PY'
import json
import sys
from pathlib import Path

json_path = Path(sys.argv[1])
srt_path = Path(sys.argv[2])
payload = json.loads(json_path.read_text(encoding="utf-8"))

assert payload["durationMs"] >= 5900
assert payload["alignmentMethod"] == "proportional-duration"
assert payload["ignoredLineRule"] == "skip empty and punctuation-only lines"
assert [line["index"] for line in payload["lines"]] == [1, 2, 3]
assert payload["lines"][0]["startMs"] == 0
assert payload["lines"][2]["endMs"] == payload["durationMs"]
assert "00:00:00,000 -->" in srt_path.read_text(encoding="utf-8")
PY

"$COMMAND_DIR/lyrics-timestamp.command.sh" map \
  --lyrics-file "$SCRIPT_DIR/fixtures/lyrics-with-separator.txt" \
  --audio-file "$AUDIO_FILE" \
  --dist "$OUT_DIR/hinted" \
  --timing-hints-file "$SCRIPT_DIR/fixtures/timing-hints.json"

python3 - "$OUT_DIR/hinted/lyrics-timestamp.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
lines = payload["lines"]

assert payload["alignmentMethod"] == "timing-hints"
assert [line["text"] for line in lines] == [
    "hello it is me",
    "And watching, with eternal lids apart,",
    "we could match these words to time",
]
assert all(line["text"] not in {"--", "***"} for line in lines)
hinted = next(line for line in lines if line["text"] == "And watching, with eternal lids apart,")
assert hinted["startMs"] == 20106
assert hinted["endMs"] == 24128
assert hinted["confidence"] == 1.0
PY

PREVIEW_OUT="$OUT_DIR/preview.json"
"$COMMAND_DIR/lyrics-timestamp.command.sh" preview \
  --lyrics-file "$SCRIPT_DIR/fixtures/lyrics-with-separator.txt" \
  --audio-file "$AUDIO_FILE" \
  --dist "$OUT_DIR/preview-only" \
  --timing-hints-file "$SCRIPT_DIR/fixtures/timing-hints.json" > "$PREVIEW_OUT"

python3 - "$PREVIEW_OUT" "$OUT_DIR/preview-only/lyrics-timestamp.json" <<'PY'
import json
import sys
from pathlib import Path

preview = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
json_path = Path(sys.argv[2])

assert preview["payload"]["alignmentMethod"] == "timing-hints"
assert preview["payload"]["lines"][1]["startMs"] == 20106
assert preview["srt"].startswith("1\n00:00:")
assert not json_path.exists()
PY

echo "lyrics-timestamp smoke test passed"

"$SCRIPT_DIR/test-bright-star.sh"
