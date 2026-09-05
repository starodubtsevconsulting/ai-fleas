#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
FONT_NAME="font-1"
SAMPLE=""
FONTS_ROOT="$SCRIPT_DIR/fonts"
OUTPUT_ROOT="$SCRIPT_DIR/output"
DIST=""
TEXT=""
TEXT_FILE=""
WIDTH=1920
HEIGHT=1080
INTERNAL_SCALE=2
FPS=30
FONT_HEIGHT=48
LINE_SPACING=125
LEFT_MARGIN=180
RIGHT_MARGIN=180
TOP_MARGIN=180
BOTTOM_MARGIN=180
MAX_LINE_WIDTH=1400
TEXT_POSITION="top"
HORIZONTAL_POSITION="left"
TAIL_SYMBOLS=0
REVEAL_STYLE="stroke"
DRAW_SECONDS=5.0
HOLD_SECONDS=2.0
BACKGROUND="255,255,255"
TEXT_COLOR="0,0,0"
VIDEO_FORMAT="h264"
KEEP_FRAMES=0
BUILD=0
BUILD_ONLY=0
BUILD_KEEP=0
BUILD_ARGS=()
CHECK_GLYPHS=0
CLIP_MODE="line"
VIDEO_MODE="per-line"
JOBS="auto"
MAX_LINES="all"
LINES_SPEC="all"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required system tool: $1" >&2
    echo "Install it with your OS package manager; it is not a Python dependency." >&2
    exit 1
  fi
}

usage() {
  cat <<'USAGE'
Usage:
  ./video-handwriting-effect.command.sh --text "0123.," [options]
  ./video-handwriting-effect.command.sh --text-file poem.txt --font-name font-1 [options]
  ./video-handwriting-effect.command.sh --build-only --font-name font-1
  ./video-handwriting-effect.command.sh --check-glyphs --text-file samples/text/lyrics-1.txt

Build behavior:
  If fonts/<font-name>/manifest.json is missing, the command builds it automatically
  from samples/<font-name>/ when that directory exists, otherwise samples/<font-name>.png.

Options:
  --font-name <name>       Font directory name under fonts/. Default: font-1.
  --sample <path>          Sample PNG or directory for automatic build. Default: samples/<font-name>/ if present, otherwise samples/<font-name>.png.
  --build                 Build the font before rendering, even if it already exists.
  --rebuild               Same as --build. build_font.py cleans the font directory by default.
  --build-only            Build the font and exit without rendering.
  --build-keep            Keep existing files while building the font.
  --build-threshold <n>   Forwarded to build_font.py --threshold.
  --build-line-gap <n>    Forwarded to build_font.py --line-gap.
  --build-glyph-gap <n>   Forwarded to build_font.py --glyph-gap.
  --build-padding <n>     Forwarded to build_font.py --padding.
  --build-min-row-ink <n> Forwarded to build_font.py --min-row-ink.
  --build-min-col-ink <n> Forwarded to build_font.py --min-col-ink.
  --build-labels <value>  Forwarded to build_font.py --labels. Repeatable.
  --check-glyphs          Report missing glyphs for the text and exit before rendering.
  --clip-mode <mode>      Text-file clip mode: line, sentence, paragraph, whole, auto. Default: line.
  --video-mode <mode>     Text-file output: per-line or single. Default: per-line.
  --jobs <n|auto>         Parallel clips for text files. Default: auto = min(10, CPU cores, clip count).
  --max-lines <n|all>     Render only the first n text chunks. Default: all. Useful for tests.
  --lines <spec>           Render selected text chunks: all, 1-17, or 1,3,4. Default: all.
  --fonts-root <path>     Font root directory. Default: ./fonts.
  --output-root <path>    Output root directory. Default: ./output.
  --dist <path>           Output directory for text files. Default: output/<font-name>/. Writes line-1.mp4, line-2.mp4, ...
  --text <value>          Text to render.
  --text-file <path>      UTF-8 text file to render.
  --width <px>            Final video width. Default: 1920.
  --height <px>           Final video height. Default: 1080.
  --internal-scale <n>    Render scale before downscaling. Default: 2.
  --letter-height <px>    Final letter height in pixels. Alias of --font-height. Default: 48.
  --font-height <px>      Final glyph height in pixels. Default: 48.
  --line-spacing <px>     Final line spacing. Default: 125.
  --left-margin <px>      Final left margin. Default: 180.
  --right-margin <px>     Final right margin. Default: 180.
  --top-margin <px>       Final top margin for --text-position top. Default: 180.
  --bottom-margin <px>    Final bottom margin for --text-position bottom. Default: 180.
  --text-position <mode>  Vertical text position: top, center, bottom. Default: top.
  --vertical-position <mode> Alias of --text-position.
  --text-align <mode>     Horizontal text alignment: left, center. Default: left.
  --horizontal-position <mode> Alias of --text-align.
  --max-line-width <px>   Final max text width. Default: 1400.
  --tail-symbols <n>      Fade older glyphs and keep this many recent symbols visible. Default: 0 disables.
  --reveal-style <mode>   Active glyph reveal: stroke, crop. Default: stroke.
  --fps <n>               Frames per second. Default: 30.
  --draw-seconds <n>      Handwriting reveal duration. Default: 5.0.
  --hold-seconds <n>      Hold duration after reveal. Default: 2.0.
  --background <color>    r,g,b[,a] or transparent. Default: 255,255,255.
  --ink-color <color>     Ink color r,g,b[,a]. Alias of --text-color. Default: 0,0,0.
  --text-color <color>    Ink color r,g,b[,a]. Default: 0,0,0.
  --video-format <format> h264 or alpha-mov. alpha-mov preserves transparency for overlays. Default: h264.
  --transparent           Shortcut for --background transparent --video-format alpha-mov.
  --keep-frames           Do not delete existing frame files before rendering.
  -h, --help              Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --font-name) FONT_NAME="$2"; shift 2 ;;
    --sample) SAMPLE="$2"; shift 2 ;;
    --build|--rebuild) BUILD=1; shift ;;
    --build-only) BUILD=1; BUILD_ONLY=1; shift ;;
    --build-keep) BUILD_KEEP=1; shift ;;
    --build-threshold) BUILD_ARGS+=(--threshold "$2"); shift 2 ;;
    --build-line-gap) BUILD_ARGS+=(--line-gap "$2"); shift 2 ;;
    --build-glyph-gap) BUILD_ARGS+=(--glyph-gap "$2"); shift 2 ;;
    --build-padding) BUILD_ARGS+=(--padding "$2"); shift 2 ;;
    --build-min-row-ink) BUILD_ARGS+=(--min-row-ink "$2"); shift 2 ;;
    --build-min-col-ink) BUILD_ARGS+=(--min-col-ink "$2"); shift 2 ;;
    --build-labels) BUILD_ARGS+=(--labels "$2"); shift 2 ;;
    --check-glyphs) CHECK_GLYPHS=1; shift ;;
    --clip-mode) CLIP_MODE="$2"; shift 2 ;;
    --video-mode) VIDEO_MODE="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --max-lines) MAX_LINES="$2"; shift 2 ;;
    --lines) LINES_SPEC="$2"; shift 2 ;;
    --fonts-root) FONTS_ROOT="$2"; shift 2 ;;
    --output-root) OUTPUT_ROOT="$2"; shift 2 ;;
    --dist) DIST="$2"; shift 2 ;;
    --text) TEXT="$2"; shift 2 ;;
    --text-file) TEXT_FILE="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    --height) HEIGHT="$2"; shift 2 ;;
    --internal-scale) INTERNAL_SCALE="$2"; shift 2 ;;
    --font-height|--letter-height) FONT_HEIGHT="$2"; shift 2 ;;
    --line-spacing) LINE_SPACING="$2"; shift 2 ;;
    --left-margin) LEFT_MARGIN="$2"; shift 2 ;;
    --right-margin) RIGHT_MARGIN="$2"; shift 2 ;;
    --top-margin) TOP_MARGIN="$2"; shift 2 ;;
    --bottom-margin) BOTTOM_MARGIN="$2"; shift 2 ;;
    --text-position|--vertical-position) TEXT_POSITION="$2"; shift 2 ;;
    --text-align|--horizontal-position) HORIZONTAL_POSITION="$2"; shift 2 ;;
    --max-line-width) MAX_LINE_WIDTH="$2"; shift 2 ;;
    --tail-symbols) TAIL_SYMBOLS="$2"; shift 2 ;;
    --reveal-style) REVEAL_STYLE="$2"; shift 2 ;;
    --fps) FPS="$2"; shift 2 ;;
    --draw-seconds) DRAW_SECONDS="$2"; shift 2 ;;
    --hold-seconds) HOLD_SECONDS="$2"; shift 2 ;;
    --background) BACKGROUND="$2"; shift 2 ;;
    --text-color|--ink-color) TEXT_COLOR="$2"; shift 2 ;;
    --video-format) VIDEO_FORMAT="$2"; shift 2 ;;
    --transparent) BACKGROUND="transparent"; VIDEO_FORMAT="alpha-mov"; shift ;;
    --keep-frames) KEEP_FRAMES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

command_python_bootstrap

if [[ "$CHECK_GLYPHS" -ne 1 && "$BUILD_ONLY" -ne 1 ]]; then
  require_tool ffmpeg
fi

if [[ -z "$SAMPLE" ]]; then
  if [[ -d "$SCRIPT_DIR/samples/$FONT_NAME" ]]; then
    SAMPLE="$SCRIPT_DIR/samples/$FONT_NAME"
  else
    SAMPLE="$SCRIPT_DIR/samples/$FONT_NAME.png"
  fi
fi

FONT_DIR="$FONTS_ROOT/$FONT_NAME"
font_needs_build() {
  local manifest_path="$FONT_DIR/manifest.json"
  if [[ ! -f "$manifest_path" ]]; then
    return 0
  fi

  command_python - "$manifest_path" "$SAMPLE" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
sample = Path(sys.argv[2])
manifest_mtime = manifest_path.stat().st_mtime

try:
  manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception:
  raise SystemExit(0)

if sample.is_dir():
  sample_paths = sorted(
    path for path in sample.iterdir()
    if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
  )
else:
  sample_paths = [sample]

if not sample_paths or any(not path.exists() for path in sample_paths):
  raise SystemExit(0)

for path in sample_paths:
  label_path = path.with_name(f"{path.stem}-label.txt")
  if path.stat().st_mtime > manifest_mtime or (label_path.exists() and label_path.stat().st_mtime > manifest_mtime):
    raise SystemExit(0)

for entry in manifest.get("glyphs", {}).values():
  if not isinstance(entry, dict):
    continue
  source = entry.get("sample")
  if source and not Path(source).exists():
    raise SystemExit(0)
  if "y_offset" not in entry or "line_height" not in entry:
    raise SystemExit(0)

raise SystemExit(1)
PY
}

if [[ "$BUILD" -eq 1 ]] || font_needs_build; then
  if [[ ! -f "$SAMPLE" && ! -d "$SAMPLE" ]]; then
    echo "Sample not found for font build: $SAMPLE" >&2
    echo "Expected default: samples/$FONT_NAME/ or samples/$FONT_NAME.png" >&2
    exit 1
  fi

  BUILD_COMMAND=(command_python "$SCRIPT_DIR/build_font.py" --sample "$SAMPLE" --output "$FONTS_ROOT" --font-name "$FONT_NAME")
  if [[ "$BUILD_KEEP" -eq 1 ]]; then
    BUILD_COMMAND+=(--keep)
  fi
  BUILD_COMMAND+=("${BUILD_ARGS[@]}")
  printf 'Building font: %s -> %s\n' "$SAMPLE" "$FONT_DIR"
  "${BUILD_COMMAND[@]}"
fi

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ -n "$TEXT" && -n "$TEXT_FILE" ]]; then
  echo "Use either --text or --text-file, not both." >&2
  exit 2
fi

if [[ -z "$TEXT" && -z "$TEXT_FILE" ]]; then
  echo "Missing --text or --text-file." >&2
  usage >&2
  exit 2
fi

if [[ ! -f "$FONT_DIR/manifest.json" ]]; then
  echo "Font build did not produce: $FONT_DIR/manifest.json" >&2
  exit 1
fi

RUN_DIR="$OUTPUT_ROOT/$FONT_NAME"
mkdir -p "$RUN_DIR"

case "$CLIP_MODE" in
  auto|sentence|line|paragraph|whole) ;;
  *) echo "Invalid --clip-mode: $CLIP_MODE" >&2; exit 2 ;;
esac

case "$VIDEO_MODE" in
  per-line|single) ;;
  *) echo "Invalid --video-mode: $VIDEO_MODE" >&2; exit 2 ;;
esac

if [[ "$MAX_LINES" != "all" && ! "$MAX_LINES" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid --max-lines: $MAX_LINES" >&2
  exit 2
fi
if [[ "$LINES_SPEC" != "all" && ! "$LINES_SPEC" =~ ^[1-9][0-9]*(-[1-9][0-9]*)?(,[1-9][0-9]*(-[1-9][0-9]*)?)*$ ]]; then
  echo "Invalid --lines: $LINES_SPEC" >&2
  exit 2
fi
if [[ "$LINES_SPEC" == "all" && "$MAX_LINES" != "all" ]]; then
  LINES_SPEC="1-$MAX_LINES"
fi

case "$TEXT_POSITION" in
  top|center|bottom) ;;
  *) echo "Invalid --text-position: $TEXT_POSITION" >&2; exit 2 ;;
esac

case "$HORIZONTAL_POSITION" in
  left|center) ;;
  *) echo "Invalid --text-align: $HORIZONTAL_POSITION" >&2; exit 2 ;;
esac

if [[ "$JOBS" != "auto" && ! "$JOBS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid --jobs: $JOBS" >&2
  exit 2
fi

if [[ ! "$TAIL_SYMBOLS" =~ ^[0-9]+$ ]]; then
  echo "Invalid --tail-symbols: $TAIL_SYMBOLS" >&2
  exit 2
fi

case "$REVEAL_STYLE" in
  stroke|crop) ;;
  *) echo "Invalid --reveal-style: $REVEAL_STYLE" >&2; exit 2 ;;
esac

case "$VIDEO_FORMAT" in
  h264|alpha-mov) ;;
  *) echo "Invalid --video-format: $VIDEO_FORMAT" >&2; exit 2 ;;
esac

if [[ "$VIDEO_FORMAT" == "alpha-mov" && "$BACKGROUND" != "transparent" && "$BACKGROUND" != *,*,*,* ]]; then
  echo "alpha-mov should be used with --background transparent or an rgba background with alpha < 255." >&2
  exit 2
fi

default_ext() {
  if [[ "$VIDEO_FORMAT" == "alpha-mov" ]]; then
    printf 'mov'
  else
    printf 'mp4'
  fi
}

default_video_name() {
  local stem="$1"
  printf '%s.%s' "$stem" "$(default_ext)"
}

if [[ -n "$TEXT_FILE" && "$CLIP_MODE" != "whole" ]]; then
  if [[ -z "$DIST" ]]; then
    DIST_DIR="$RUN_DIR"
    if [[ "$VIDEO_MODE" == "single" ]]; then
      DIST_TARGET="$DIST_DIR/$(default_video_name "$FONT_NAME")"
    else
      DIST_TARGET="$DIST_DIR/$(default_video_name line)"
    fi
  elif [[ "$VIDEO_MODE" == "single" && "$DIST" != */ && "${DIST##*.}" != "$DIST" ]]; then
    mkdir -p "$(dirname -- "$DIST")"
    DIST_TARGET="$DIST"
  else
    if [[ "$DIST" != */ && "${DIST##*.}" != "$DIST" ]]; then
      echo "For text-file per-line output, --dist must be a directory, for example: --dist output/$FONT_NAME/" >&2
      exit 2
    fi
    DIST_DIR="${DIST%/}"
    mkdir -p "$DIST_DIR"
    if [[ "$VIDEO_MODE" == "single" ]]; then
      DIST_TARGET="$DIST_DIR/$(default_video_name "$FONT_NAME")"
    else
      DIST_TARGET="$DIST_DIR/$(default_video_name line)"
    fi
  fi
elif [[ -z "$DIST" ]]; then
  DIST_TARGET="$RUN_DIR/$(default_video_name "$FONT_NAME")"
elif [[ "$DIST" == */ || -d "$DIST" || "${DIST##*.}" == "$DIST" ]]; then
  mkdir -p "$DIST"
  DIST_TARGET="${DIST%/}/$(default_video_name "$FONT_NAME")"
else
  mkdir -p "$(dirname -- "$DIST")"
  DIST_TARGET="$DIST"
fi

INTERNAL_WIDTH=$((WIDTH * INTERNAL_SCALE))
INTERNAL_HEIGHT=$((HEIGHT * INTERNAL_SCALE))
INTERNAL_FONT_HEIGHT=$((FONT_HEIGHT * INTERNAL_SCALE))
INTERNAL_LINE_SPACING=$((LINE_SPACING * INTERNAL_SCALE))
INTERNAL_LEFT_MARGIN=$((LEFT_MARGIN * INTERNAL_SCALE))
INTERNAL_RIGHT_MARGIN=$((RIGHT_MARGIN * INTERNAL_SCALE))
INTERNAL_TOP_MARGIN=$((TOP_MARGIN * INTERNAL_SCALE))
INTERNAL_BOTTOM_MARGIN=$((BOTTOM_MARGIN * INTERNAL_SCALE))
INTERNAL_MAX_LINE_WIDTH=$((MAX_LINE_WIDTH * INTERNAL_SCALE))

RENDER_ARGS=(
  --font-dir "$FONT_DIR"
  --width "$INTERNAL_WIDTH"
  --height "$INTERNAL_HEIGHT"
  --font-height "$INTERNAL_FONT_HEIGHT"
  --line-spacing "$INTERNAL_LINE_SPACING"
  --left-margin "$INTERNAL_LEFT_MARGIN"
  --right-margin "$INTERNAL_RIGHT_MARGIN"
  --top-margin "$INTERNAL_TOP_MARGIN"
  --bottom-margin "$INTERNAL_BOTTOM_MARGIN"
  --max-line-width "$INTERNAL_MAX_LINE_WIDTH"
  --vertical-position "$TEXT_POSITION"
  --horizontal-position "$HORIZONTAL_POSITION"
  --tail-symbols "$TAIL_SYMBOLS"
  --reveal-style "$REVEAL_STYLE"
  --fps "$FPS"
  --draw-seconds "$DRAW_SECONDS"
  --hold-seconds "$HOLD_SECONDS"
  --background "$BACKGROUND"
  --text-color "$TEXT_COLOR"
)

if [[ "$KEEP_FRAMES" -eq 1 ]]; then
  RENDER_ARGS+=(--keep)
fi

if [[ "$CHECK_GLYPHS" -eq 1 ]]; then
  RENDER_ARGS+=(--check-glyphs)
fi

render_clip() {
  local clip_text="$1"
  local frames_dir="$2"
  local video_out="$3"

  command_python "$SCRIPT_DIR/render.py" "${RENDER_ARGS[@]}" --frames-dir "$frames_dir" --text="$clip_text"

  if [[ "$CHECK_GLYPHS" -eq 1 ]]; then
    return 0
  fi

  if [[ "$VIDEO_FORMAT" == "alpha-mov" ]]; then
    ffmpeg -hide_banner -loglevel error -y \
      -framerate "$FPS" \
      -i "$frames_dir/frame_%06d.png" \
      -vf "scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuva444p10le" \
      -c:v prores_ks \
      -profile:v 4444 \
      -pix_fmt yuva444p10le \
      "$video_out"
  else
    ffmpeg -hide_banner -loglevel error -y \
      -framerate "$FPS" \
      -i "$frames_dir/frame_%06d.png" \
      -vf "scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p" \
      -c:v libx264 \
      -crf 18 \
      -preset medium \
      -movflags +faststart \
      "$video_out"
  fi

  printf 'Video written: %s\n' "$video_out"
}

if [[ -n "$TEXT_FILE" ]]; then
  TEXT="$(<"$TEXT_FILE")"
  command_python "$SCRIPT_DIR/render.py" "${RENDER_ARGS[@]}" --check-glyphs --frames-dir "$RUN_DIR/frames/check-glyphs" --text="$TEXT" >/dev/null
  if [[ "$CHECK_GLYPHS" -eq 1 ]]; then
    printf 'All required glyphs are available.\n'
    exit 0
  fi
fi

if [[ -z "$TEXT_FILE" || "$CLIP_MODE" == "whole" ]]; then
  FRAMES_DIR="$RUN_DIR/frames"
  if [[ -n "$TEXT_FILE" ]]; then
    TEXT="$(<"$TEXT_FILE")"
  fi
  render_clip "$TEXT" "$FRAMES_DIR" "$DIST_TARGET"
  exit 0
fi

CHUNKS_DIR="$(mktemp -d)"
trap 'rm -rf "$CHUNKS_DIR"' EXIT

command_python - "$TEXT_FILE" "$CHUNKS_DIR" "$CLIP_MODE" "$LINES_SPEC" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

source = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
mode = sys.argv[3]
lines_spec = sys.argv[4]
text = source.read_text(encoding="utf-8")

def clean(parts: list[str]) -> list[str]:
  return [part.strip() for part in parts if part.strip()]

def split_sentences(value: str) -> list[str]:
  normalized = re.sub(r"\s+", " ", value.strip())
  if not normalized:
    return []
  parts = re.split(r"(?<=[.!?])\s+", normalized)
  return clean(parts)

def split_lines(value: str) -> list[str]:
  return clean(value.splitlines())

def split_paragraphs(value: str) -> list[str]:
  return clean(re.split(r"\n\s*\n", value))

if mode == "auto":
  chunks = split_sentences(text)
  if len(chunks) <= 1:
    chunks = split_lines(text)
elif mode == "sentence":
  chunks = split_sentences(text)
elif mode == "line":
  chunks = split_lines(text)
elif mode == "paragraph":
  chunks = split_paragraphs(text)
else:
  chunks = [text.strip()] if text.strip() else []

def parse_lines_spec(value: str, chunk_count: int) -> list[int]:
  if value == "all":
    return list(range(chunk_count))
  selected: list[int] = []
  seen: set[int] = set()
  for part in value.split(","):
    if "-" in part:
      start_text, end_text = part.split("-", 1)
      start = int(start_text)
      end = int(end_text)
      if end < start:
        raise SystemExit(f"Invalid --lines range: {part}")
      values = range(start, end + 1)
    else:
      values = [int(part)]
    for line_number in values:
      if line_number < 1 or line_number > chunk_count:
        raise SystemExit(f"--lines value is out of range: {line_number}")
      index = line_number - 1
      if index not in seen:
        selected.append(index)
        seen.add(index)
  return selected

selected_indexes = parse_lines_spec(lines_spec, len(chunks))

if not selected_indexes:
  raise SystemExit("Text file did not contain renderable chunks.")

for index in selected_indexes:
  line_number = index + 1
  (out_dir / f"{line_number:03d}.txt").write_text(chunks[index] + "\n", encoding="utf-8")

PY

mapfile -t CLIP_FILES < <(find "$CHUNKS_DIR" -maxdepth 1 -type f -name '*.txt' | sort)
CLIP_COUNT="${#CLIP_FILES[@]}"
if [[ "$CLIP_COUNT" -eq 0 ]]; then
  echo "No text chunks were produced from: $TEXT_FILE" >&2
  exit 1
fi

DIST_DIR="$(dirname -- "$DIST_TARGET")"
DIST_BASE="$(basename -- "$DIST_TARGET")"
DIST_STEM="${DIST_BASE%.*}"
DIST_EXT="${DIST_BASE##*.}"
if [[ "$DIST_EXT" == "$DIST_BASE" ]]; then
  DIST_EXT="$(default_ext)"
fi
if [[ "$VIDEO_FORMAT" == "alpha-mov" && "$DIST_EXT" != "mov" ]]; then
  echo "Transparent alpha output uses ProRes 4444 and should be written as .mov. Use --dist with a .mov file or folder-style --dist." >&2
  exit 2
fi
mkdir -p "$DIST_DIR"

if [[ "$CHECK_GLYPHS" -ne 1 && "$KEEP_FRAMES" -ne 1 ]]; then
  if [[ -d "$RUN_DIR/frames" ]]; then
    find "$RUN_DIR/frames" -mindepth 1 -maxdepth 1 -type d -name "$DIST_STEM-*" -exec rm -rf {} +
  fi
  if [[ -d "$RUN_DIR/line-videos" ]]; then
    rm -rf "$RUN_DIR/line-videos"
  fi
  find "$DIST_DIR" -maxdepth 1 -type f -name "$DIST_STEM-*.${DIST_EXT}" -delete
  if [[ "$VIDEO_MODE" == "single" ]]; then
    rm -f "$DIST_TARGET"
  fi
fi

LINE_VIDEOS_DIR="$DIST_DIR"
LINE_VIDEO_STEM="$DIST_STEM"
if [[ "$VIDEO_MODE" == "single" ]]; then
  LINE_VIDEOS_DIR="$CHUNKS_DIR/line-videos"
  mkdir -p "$LINE_VIDEOS_DIR"
fi

if [[ "$JOBS" == "auto" ]]; then
  CPU_COUNT="$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '1')"
  JOB_COUNT="$CPU_COUNT"
  if (( JOB_COUNT > 10 )); then
    JOB_COUNT=10
  fi
else
  JOB_COUNT="$JOBS"
fi
if (( JOB_COUNT > CLIP_COUNT )); then
  JOB_COUNT="$CLIP_COUNT"
fi
if (( JOB_COUNT < 1 )); then
  JOB_COUNT=1
fi

render_one_chunk() {
  local chunk_file="$1"
  local clip_id clip_number clip_text frames_dir video_out
  clip_id="$(basename -- "$chunk_file" .txt)"
  clip_number="$((10#$clip_id))"
  clip_text="$(<"$chunk_file")"
  frames_dir="$RUN_DIR/frames/$DIST_STEM-$clip_id"
  video_out="$LINE_VIDEOS_DIR/$LINE_VIDEO_STEM-$clip_number.$DIST_EXT"
  render_clip "$clip_text" "$frames_dir" "$video_out"
}

concat_single_video() {
  local concat_file="$CHUNKS_DIR/concat.txt"
  command_python - "$concat_file" "$LINE_VIDEOS_DIR" "$LINE_VIDEO_STEM" "$DIST_EXT" "${CLIP_FILES[@]}" <<'PY'
from __future__ import annotations

import sys
from pathlib import Path

concat_file = Path(sys.argv[1])
line_videos_dir = Path(sys.argv[2])
stem = sys.argv[3]
ext = sys.argv[4]
chunk_files = [Path(value) for value in sys.argv[5:]]

def escape(value: str) -> str:
  return value.replace("'", "'\\''")

lines = []
for chunk_file in chunk_files:
  clip_number = int(chunk_file.stem)
  video_out = (line_videos_dir / f"{stem}-{clip_number}.{ext}").resolve()
  lines.append(f"file '{escape(str(video_out))}'")
concat_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

  ffmpeg -hide_banner -loglevel error -y \
    -f concat \
    -safe 0 \
    -i "$concat_file" \
    -c copy \
    -movflags +faststart \
    "$DIST_TARGET"
  printf 'Video written: %s\n' "$DIST_TARGET"
}

printf 'Rendering %s clip(s) with %s job(s).\n' "$CLIP_COUNT" "$JOB_COUNT"
FAILED=0
RUNNING=0
for chunk_file in "${CLIP_FILES[@]}"; do
  ( render_one_chunk "$chunk_file" ) || exit 1 &
  RUNNING=$((RUNNING + 1))
  if (( RUNNING >= JOB_COUNT )); then
    if ! wait -n; then
      FAILED=1
    fi
    RUNNING=$((RUNNING - 1))
  fi
done

while (( RUNNING > 0 )); do
  if ! wait -n; then
    FAILED=1
  fi
  RUNNING=$((RUNNING - 1))
done

if (( FAILED != 0 )); then
  echo "One or more clip renders failed." >&2
  exit 1
fi

if [[ "$CHECK_GLYPHS" -eq 1 ]]; then
  printf 'Checked %s clip(s).\n' "$CLIP_COUNT"
elif [[ "$VIDEO_MODE" == "single" ]]; then
  concat_single_video
  printf 'Video clips combined: %s (%s clip(s))\n' "$DIST_TARGET" "$CLIP_COUNT"
else
  printf 'Video clips written: %s (%s clip(s))\n' "$DIST_DIR/$DIST_STEM-*.${DIST_EXT}" "$CLIP_COUNT"
fi
