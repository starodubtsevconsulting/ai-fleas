#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMD_SH="$SCRIPT_DIR/../tts.command.sh"
#INPUT_FILE="$SCRIPT_DIR/sample-three-voices.txt"
INPUT_FILE="$SCRIPT_DIR/fixtures/post-ufo.expected.md"
OUTPUT_FILE="$SCRIPT_DIR/../output/test-output.wav"

if [ ! -x "$CMD_SH" ]; then
  echo "Missing executable: $CMD_SH" >&2
  exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
  echo "Missing input file: $INPUT_FILE" >&2
  exit 1
fi

echo "[TEST] Fixture examples available under: $SCRIPT_DIR/fixtures"

echo "[TEST] Running tts smoke test..."
/usr/bin/env bash "$CMD_SH" \
  --text-file "$INPUT_FILE" \
  --input-is-compiled \
  --output "$OUTPUT_FILE" \
  --allow-fallback \
  --timeout 45 \
  --no-autoplay

if [ ! -s "$OUTPUT_FILE" ]; then
  echo "[FAIL] Output file missing or empty: $OUTPUT_FILE" >&2
  exit 1
fi

echo "[OK] Smoke test passed."
echo "Output: $OUTPUT_FILE"
