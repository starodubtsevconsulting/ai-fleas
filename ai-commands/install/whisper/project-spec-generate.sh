#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHISPER_CMD="$SCRIPT_DIR/text-to-audio.sh"
SAMPLE_TEST_SCRIPT_FILE="$SCRIPT_DIR/sample-voice-test-script.md"

CHANNEL_ROOT=""
PLAYLIST_ID=""
PLAYLIST_LABEL=""
EPISODE_ID=""
EPISODE_LABEL=""
INPUT_FILE=""
OUTPUT_FILE=""
VOICE_PROFILE_FILE=""
DEFAULT_NAMED_SPEAKER_ID="narrator"
WHISPER_REQUIRE_NEURAL="1"
WHISPER_AUTOPLAY="0"
WHISPER_TTS_STRICT_PROFILES="1"
LOG_FILE=""
DRY_RUN=0
VALIDATE_ONLY=0
SAMPLE_TEST_SCRIPT=0

usage() {
  cat <<USAGE
Usage:
  project-spec-generate.sh \
    --channel-root <path> \
    --playlist-id <id> \
    --playlist-label <label> \
    --episode-id <id> \
    --episode-label <label> \
    [--input-file <path>] \
    --output-file <path> \
    --voice-profile-file <path> \
    --speaker <id> \
    [--require-neural 1|0] \
    [--autoplay 1|0] \
    [--strict-profiles 1|0] \
    [--log-file <path>] \
    [--dry-run] \
    [--validate-only] \
    [--sample-test-script]
USAGE
}

resolve_output_file() {
  python3 - "$VOICE_PROFILE_FILE" "$DEFAULT_NAMED_SPEAKER_ID" "$OUTPUT_FILE" <<'PY'
import json
import re
import sys
from pathlib import Path

profile_path = Path(sys.argv[1])
speaker_id = sys.argv[2]
output_path = Path(sys.argv[3])

def slug(value: str) -> str:
    text = re.sub(r'[^a-z0-9]+', '-', (value or '').strip().lower()).strip('-')
    return text or 'na'

raw = json.loads(profile_path.read_text(encoding='utf-8'))
profiles = raw.get('profiles', raw) if isinstance(raw, dict) else raw
if not isinstance(profiles, list):
    raise SystemExit(f'Invalid profile bundle: {profile_path}')

wanted = slug(speaker_id)
selected = None
for item in profiles:
    if not isinstance(item, dict):
        continue
    aliases = []
    for value in (item.get('id'), item.get('speaker')):
        if isinstance(value, str) and value.strip():
            aliases.append(slug(value))
    extra = item.get('aliases')
    if isinstance(extra, list):
        aliases.extend(slug(v) for v in extra if isinstance(v, str) and v.strip())
    if wanted in aliases:
        selected = item
        break

if selected is None and profiles:
    selected = profiles[0]
if selected is None:
    raise SystemExit(f'No usable profiles found in {profile_path}')

speaker = slug(selected.get('id') or selected.get('speaker') or speaker_id)
voice = slug(str(selected.get('voice', 'default')))
rate = slug(str(selected.get('rate', '0')))
pitch = slug(str(selected.get('pitch', '0')))
base = output_path.stem
suffix = output_path.suffix or '.wav'
final_name = f'{base}__speaker-{speaker}__voice-{voice}__rate-{rate}__pitch-{pitch}{suffix}'
print(str(output_path.with_name(final_name)))
PY
}

while [ $# -gt 0 ]; do
  case "$1" in
    --channel-root) CHANNEL_ROOT="${2:-}"; shift 2 ;;
    --playlist-id) PLAYLIST_ID="${2:-}"; shift 2 ;;
    --playlist-label) PLAYLIST_LABEL="${2:-}"; shift 2 ;;
    --episode-id) EPISODE_ID="${2:-}"; shift 2 ;;
    --episode-label) EPISODE_LABEL="${2:-}"; shift 2 ;;
    --input-file) INPUT_FILE="${2:-}"; shift 2 ;;
    --output-file) OUTPUT_FILE="${2:-}"; shift 2 ;;
    --voice-profile-file) VOICE_PROFILE_FILE="${2:-}"; shift 2 ;;
    --speaker) DEFAULT_NAMED_SPEAKER_ID="${2:-}"; shift 2 ;;
    --require-neural) WHISPER_REQUIRE_NEURAL="${2:-}"; shift 2 ;;
    --autoplay) WHISPER_AUTOPLAY="${2:-}"; shift 2 ;;
    --strict-profiles) WHISPER_TTS_STRICT_PROFILES="${2:-}"; shift 2 ;;
    --log-file) LOG_FILE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --validate-only) VALIDATE_ONLY=1; shift ;;
    --sample-test-script) SAMPLE_TEST_SCRIPT=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for required in CHANNEL_ROOT PLAYLIST_ID PLAYLIST_LABEL EPISODE_ID EPISODE_LABEL OUTPUT_FILE VOICE_PROFILE_FILE DEFAULT_NAMED_SPEAKER_ID; do
  if [ -z "${!required}" ]; then
    echo "Missing required argument: $required" >&2
    exit 1
  fi
done

if [ "$SAMPLE_TEST_SCRIPT" = "1" ]; then
  if [ ! -f "$SAMPLE_TEST_SCRIPT_FILE" ]; then
    echo "Missing embedded sample test script: $SAMPLE_TEST_SCRIPT_FILE" >&2
    exit 1
  fi
  INPUT_FILE="$SAMPLE_TEST_SCRIPT_FILE"
  output_dir="$(dirname "$OUTPUT_FILE")"
  output_ext="${OUTPUT_FILE##*.}"
  if [ "$output_ext" = "$OUTPUT_FILE" ]; then
    output_ext="wav"
  fi
  OUTPUT_FILE="$output_dir/sample-test-script.$output_ext"
  if [ "$DRY_RUN" != "1" ] && [ "$VALIDATE_ONLY" != "1" ]; then
    WHISPER_AUTOPLAY="1"
  fi
fi

if [ -z "$INPUT_FILE" ]; then
  echo "Missing required argument: INPUT_FILE (or use --sample-test-script)" >&2
  exit 1
fi
if [ ! -f "$INPUT_FILE" ]; then
  echo "Missing episode input file: $INPUT_FILE" >&2
  exit 1
fi
if [ ! -f "$VOICE_PROFILE_FILE" ]; then
  echo "Missing channel voice bundle: $VOICE_PROFILE_FILE" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to resolve output filenames from voice profile bundles." >&2
  exit 1
fi

OUTPUT_FILE="$(resolve_output_file)"
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
TMP_OUTPUT_FILE="$OUTPUT_DIR/.generated-specs.tmp.wav"
mkdir -p "$OUTPUT_DIR"

if [ -n "$LOG_FILE" ]; then
  : > "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

echo "Channel root: $CHANNEL_ROOT"
echo "Playlist: $PLAYLIST_LABEL ($PLAYLIST_ID)"
echo "Episode: $EPISODE_LABEL ($EPISODE_ID)"
echo "Input: $INPUT_FILE"
echo "Channel voice bundle: $VOICE_PROFILE_FILE"
echo "Default named speaker: $DEFAULT_NAMED_SPEAKER_ID"
echo "Output: $OUTPUT_FILE"
if [ "$SAMPLE_TEST_SCRIPT" = "1" ]; then
  echo "Mode: sample-test-script"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run only. No audio generated."
  exit 0
fi

rm -f "$TMP_OUTPUT_FILE"

whisper_args=("" "$TMP_OUTPUT_FILE")
if [ "$VALIDATE_ONLY" = "1" ]; then
  whisper_args=(--validate-only "" "$TMP_OUTPUT_FILE")
fi

WHISPER_REQUIRE_NEURAL="$WHISPER_REQUIRE_NEURAL" \
WHISPER_AUTOPLAY="$WHISPER_AUTOPLAY" \
WHISPER_TTS_STRICT_PROFILES="$WHISPER_TTS_STRICT_PROFILES" \
WHISPER_TTS_DEFAULT_UNLABELED_SPEAKER="$DEFAULT_NAMED_SPEAKER_ID" \
WHISPER_TTS_TEXT_FILE="$INPUT_FILE" \
WHISPER_TTS_PROFILES_FILE="$VOICE_PROFILE_FILE" \
"$WHISPER_CMD" "${whisper_args[@]}"

if [ "$VALIDATE_ONLY" = "1" ]; then
  rm -f "$TMP_OUTPUT_FILE"
  echo "Validation only completed."
  exit 0
fi

mv "$TMP_OUTPUT_FILE" "$OUTPUT_FILE"
echo "Created: $OUTPUT_FILE"
