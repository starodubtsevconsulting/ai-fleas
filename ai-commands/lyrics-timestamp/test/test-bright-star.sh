#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/fixtures/bright-star"
OUT_DIR="$COMMAND_DIR/output/bright-star"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

"$COMMAND_DIR/lyrics-timestamp.command.sh" map \
  --lyrics-file "$FIXTURE_DIR/lyrics.md" \
  --audio-file "$FIXTURE_DIR/audio.mp3" \
  --dist "$OUT_DIR" \
  --timing-hints-file "$SCRIPT_DIR/fixtures/timing-hints.json"

python3 - "$OUT_DIR/lyrics-timestamp.json" "$OUT_DIR/lyrics-timestamp.srt" <<'PY'
import json
import sys
from pathlib import Path

json_path = Path(sys.argv[1])
srt_path = Path(sys.argv[2])
payload = json.loads(json_path.read_text(encoding="utf-8"))
lines = payload["lines"]

assert payload["durationMs"] > 70000
assert payload["alignmentMethod"] == "timing-hints"
assert len(lines) >= 14
assert all(line["text"] != "--" for line in lines)
assert lines[0]["text"] == "“Bright star, would I were stedfast as thou art”"
assert lines[-1]["text"] == "And so live ever—or else swoon to death."
hinted = next(line for line in lines if line["text"] == "And watching, with eternal lids apart,")
assert hinted["startMs"] == 20106
assert hinted["endMs"] == 24128
assert hinted["confidence"] == 1.0
assert all(line["startMs"] < line["endMs"] for line in lines)
assert all(left["startMs"] <= right["startMs"] for left, right in zip(lines, lines[1:]))
assert "Bright star" in srt_path.read_text(encoding="utf-8")
PY

echo "lyrics-timestamp Bright star fixture test passed"
