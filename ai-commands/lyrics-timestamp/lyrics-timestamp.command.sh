#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "lyrics-timestamp" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ACTION="${1:-}"
if [[ $# -gt 0 ]]; then
  shift
fi

usage() {
  cat <<'USAGE'
Usage:
  ./lyrics-timestamp.command.sh map --lyrics-file <path> --audio-file <path> --dist <path>
  ./lyrics-timestamp.command.sh preview --lyrics-file <path> --audio-file <path> --dist <path>

Options:
  --lyrics-file <path>   Plain text or Markdown lyrics.
  --audio-file <path>    Audio file readable by ffprobe.
  --dist <path>          Output directory or .json output file.
  --line-mode <mode>     non-empty (default).
  --format <formats>     json,srt (default).
  --tail-ms <number>     Extra duration added to each line end. Default: 250.
  --timing-hints-file <path>
                         Optional JSON with known line start/end anchors.
USAGE
}

if [[ -z "$ACTION" || "$ACTION" == "--help" || "$ACTION" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "$ACTION" != "map" && "$ACTION" != "preview" ]]; then
  echo "Unknown action: $ACTION" >&2
  usage >&2
  exit 2
fi

if [[ "$ACTION" == "preview" ]]; then
  exec python3 "$SCRIPT_DIR/map_lyrics_timestamp.py" --preview "$@"
fi

exec python3 "$SCRIPT_DIR/map_lyrics_timestamp.py" "$@"
