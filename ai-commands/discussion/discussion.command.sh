#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

ai_flow_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project-dir" >&2
        exit 2
      fi
      AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
    --output-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --output-dir" >&2
        exit 2
      fi
      AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      ai_flow_args+=("$1")
      shift
      ;;
  esac
done
if [ $# -gt 0 ]; then
  ai_flow_args+=("$@")
fi
set -- "${ai_flow_args[@]}"
export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
AI_CONFIG_PROJECT="$ROOT_DIR"

# shellcheck disable=SC1091
source "$ROOT_DIR/.codex/session.sh"

ACTION="${1:-help}"
if [ $# -gt 0 ]; then
  shift
fi

DATE_KEY="$(date +"%d_%m_%Y")"
INPUT_FILE=""
INPUT_TEXT=""
OUTPUT_NAME=""
SUMMARY_OUT=""
BACKLOG_OUT=""
BACKLOG_TITLE=""
BACKLOG_PROJECT=""
BACKLOG_SCOPE=""
SUMMARY_NAME=""
CONVERSATION_SOURCE_DIR="$HOME/Documents/Zoom"
CONVERSATION_FEATURE=""
CONVERSATION_PATTERN="*"
CONVERSATION_LIMIT="20"
CONVERSATION_TAGS=()
CONVERSATION_READY_ROOT=""
CONVERSATION_ORDER="newest"
CONVERSATION_RECENT="false"
LOOKUP_QUERY=""
LOOKUP_LIMIT="10"
LOOKUP_ROOTS=()
LOOKUP_JSON="false"
LOOKUP_SHOW="false"
LOOKUP_OPEN_BROWSER="true"
LOOKUP_REINDEX="false"
LOOKUP_NO_INDEX="false"
CONVERSATION_INDEX_DB=""
CURRENT_MODE="show"
CURRENT_CONVERSATION_NAME=""

usage() {
  cat <<'EOF'
Usage:
  discussion.command.sh init [--date DD_MM_YYYY]
  discussion.command.sh add-text [--date DD_MM_YYYY] [--name file.txt] (--file <path> | --text "<raw text>")
  discussion.command.sh add-screen [--date DD_MM_YYYY] [--name file.png] --file <path>
  discussion.command.sh list [--date DD_MM_YYYY]
  discussion.command.sh summarize [--date DD_MM_YYYY] [--out <path>]
  discussion.command.sh current-conversation [--set|--show|--summary|--clear] [--date DD_MM_YYYY] [--name <text>] [--file <path>|--source-dir <path>] [--no-open]
  discussion.command.sh prep-conversation [--date DD_MM_YYYY] (--feature <name>|--recent) [--source-dir <path>] [--ready-root <path>] [--pattern <glob>] [--limit <n>] [--chronological|--order newest|chronological] [--tag <tag> ...]
  discussion.command.sh index-conversations [--root <path> ...] [--index-path <path>] [--json]
  discussion.command.sh lookup-conversation (--query <text>|<text>) [--root <path> ...] [--limit <n>] [--show] [--json] [--reindex] [--no-index] [--index-path <path>] [--no-open]
  discussion.command.sh backlog-draft [--date DD_MM_YYYY] [--title <text>] [--project <label>] [--scope <text>] [--out <path>]

Notes:
  - Discussion storage root is workflow-scoped:
    session-root/<profile>/discussions/<DD_MM_YYYY>/
  - Screenshots go to:
    session-root/<profile>/discussions/<DD_MM_YYYY>/screens/
EOF
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

to_repo_relative_path() {
  local path="$1"
  case "$path" in
    "$ROOT_DIR"/*) printf '%s\n' ".${path#$ROOT_DIR}" ;;
    *) printf '%s\n' "$path" ;;
  esac
}

discussion_root_dir() {
  printf '%s\n' "$(session_root_dir)/discussions"
}

discussion_day_dir() {
  printf '%s\n' "$(discussion_root_dir)/$DATE_KEY"
}

conversation_index_db() {
  if [ -n "$CONVERSATION_INDEX_DB" ]; then
    printf '%s\n' "$CONVERSATION_INDEX_DB"
  else
    printf '%s\n' "$HOME/Documents/Zoom/indexed/_index/conversation-index.sqlite"
  fi
}

refresh_conversation_index_quiet() {
  local index_helper
  index_helper="$ROOT_DIR/commands/discussion/discussion_index.py"
  if [ ! -x "$index_helper" ]; then
    return 0
  fi
  "$index_helper" index \
    --db "$(conversation_index_db)" \
    --root "$HOME/Documents/Zoom/indexed" \
    --root "$(discussion_root_dir)" >/dev/null 2>&1 || true
}

discussion_source_files() {
  local preferred_txt
  preferred_txt="$(discussion_day_dir)/meeting_saved_closed_caption.txt"
  if [ -f "$preferred_txt" ]; then
    printf '%s\n' "$preferred_txt"
    return 0
  fi
  find "$(discussion_day_dir)" -mindepth 1 -maxdepth 1 -type f -name '*.txt' | sort
}

default_summary_path() {
  local first_txt preferred_txt base
  preferred_txt="$(discussion_day_dir)/meeting_saved_closed_caption.txt"
  first_txt="$(discussion_source_files | head -n 1 || true)"
  if [ -n "$SUMMARY_NAME" ]; then
    base="$(slugify "$SUMMARY_NAME")"
  elif [ -f "$preferred_txt" ]; then
    base="meeting_saved_closed_caption"
  elif [ -n "$first_txt" ]; then
    base="$(basename "$first_txt" .txt)"
    base="$(slugify "$base")"
  else
    base="discussion"
  fi
  if [ -z "$base" ]; then
    base="discussion"
  fi
  printf '%s\n' "$(discussion_day_dir)/${base}-summary.md"
}

ensure_discussion_dirs() {
  ensure_profile_runtime_dirs
  mkdir -p "$(discussion_day_dir)/screens"
}

current_conversation_file() {
  printf '%s\n' "$(discussion_root_dir)/current-conversation.json"
}

write_current_conversation() {
  local name="$1"
  local source_file="$2"
  local source_dir="$3"
  ensure_discussion_dirs
  command_python - \
    "$(current_conversation_file)" \
    "$DATE_KEY" \
    "$(discussion_day_dir)" \
    "$name" \
    "$source_file" \
    "$source_dir" <<'CURRENTPY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

target = Path(sys.argv[1])
payload = {
    "date_key": sys.argv[2],
    "day_dir": sys.argv[3],
    "name": sys.argv[4] or "current conversation",
    "source_file": sys.argv[5],
    "source_dir": sys.argv[6],
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(target)
CURRENTPY
}

read_current_conversation_field() {
  local field="$1"
  local marker
  marker="$(current_conversation_file)"
  if [ ! -f "$marker" ]; then
    return 0
  fi
  command_python - "$marker" "$field" <<'CURRENTPY'
import json
import sys
from pathlib import Path
try:
    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    payload = {}
print(payload.get(sys.argv[2], ""))
CURRENTPY
}


generate_current_conversation_summary() {
  local output_file="$1"
  local conversation_name="$2"
  local day_dir="$3"
  local source_dir="$4"
  command_python - \
    "$output_file" \
    "$conversation_name" \
    "$day_dir" \
    "$source_dir" <<'CURRENTSUMMARYPY'
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

output = Path(sys.argv[1])
name = sys.argv[2] or "current conversation"
day_dir = Path(sys.argv[3])
source_dir = Path(sys.argv[4]).expanduser() if sys.argv[4] else None
state_path = output.with_suffix(output.suffix + ".state.json")

state = {}
if state_path.exists():
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        state = {}
previous_offsets = state.get("offsets", {}) if isinstance(state.get("offsets", {}), dict) else {}
previous_images = set(state.get("images", [])) if isinstance(state.get("images", []), list) else set()
incremental = output.exists() and bool(previous_offsets)

text_suffixes = {".txt", ".md", ".vtt", ".srt", ".log"}
image_suffixes = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
summary_names = {"summary.md", output.name, state_path.name}

roots = []
if day_dir.exists():
    roots.append(day_dir)
if source_dir and source_dir.exists() and source_dir.resolve() != day_dir.resolve():
    roots.append(source_dir)

texts = []
images = []
seen = set()
for root in roots:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path in seen:
            continue
        seen.add(path)
        lower = path.name.lower()
        if lower in summary_names or lower.endswith("-summary.md") or lower.endswith("-feature.md") or lower.endswith(".state.json"):
            continue
        if path.suffix.lower() in text_suffixes:
            texts.append(path)
        elif path.suffix.lower() in image_suffixes:
            images.append(path)

def display_path(path):
    try:
        rel = path.resolve().relative_to(output.parent.resolve())
        return str(rel)
    except Exception:
        home = Path.home().resolve()
        try:
            return "~" + str(path.resolve()).removeprefix(str(home))
        except Exception:
            return path.name

def read_new_lines(path):
    key = str(path.resolve())
    size = path.stat().st_size
    offset = int(previous_offsets.get(key, 0) or 0) if incremental else 0
    if offset < 0 or offset > size:
        offset = 0
    with path.open("rb") as fh:
        fh.seek(offset)
        raw = fh.read()
    new_offsets[key] = size
    return raw.decode("utf-8", errors="replace").splitlines()

new_offsets = {}
all_lines = []
for path in texts:
    for idx, line in enumerate(read_new_lines(path), start=1):
        clean = line.strip()
        if not clean:
            continue
        if re.match(r"^\[[^]]+\]\s+\d{1,2}:\d{2}:\d{2}$", clean):
            continue
        all_lines.append((path, idx, clean))

new_image_paths = [image for image in images if str(image.resolve()) not in previous_images]

def pick(pattern, max_items=8):
    rx = re.compile(pattern, re.I)
    out = []
    seen_text = set()
    for path, idx, line in all_lines:
        normalized = re.sub(r"\s+", " ", line)
        if normalized in seen_text:
            continue
        if rx.search(line):
            seen_text.add(normalized)
            out.append((path, idx, line))
            if len(out) >= max_items:
                break
    return out

def first_meaningful(max_items=8):
    out = []
    seen_text = set()
    for path, idx, line in all_lines:
        normalized = re.sub(r"\s+", " ", line)
        if normalized in seen_text or len(normalized) < 20:
            continue
        seen_text.add(normalized)
        out.append((path, idx, line))
        if len(out) >= max_items:
            break
    return out

def last_meaningful(max_items=6):
    out = []
    seen_text = set()
    for path, idx, line in reversed(all_lines):
        normalized = re.sub(r"\s+", " ", line)
        if normalized in seen_text or len(normalized) < 20:
            continue
        seen_text.add(normalized)
        out.append((path, idx, line))
        if len(out) >= max_items:
            break
    return list(reversed(out))

def bullet(item):
    path, idx, line = item
    shown = display_path(path)
    return f"- [{Path(shown).name}: new line {idx}]({shown}) - {line}"

def section_items(items, fallback):
    if items:
        return [bullet(item) for item in items]
    return [f"- TODO: {fallback}"]

source_text = "\n".join(line for _, _, line in all_lines)
needs_diagram = bool(re.search(r"\b(design|architecture|flow|sequence|component|integration|cache|api|service|state|event)\b", source_text, re.I))
where = last_meaningful()
discussed = pick(r"\b(config|tag|cache|api|service|portal|ui|flow|design|requirement|problem|goal|test|prod|deploy|risk)\b") or first_meaningful()
decisions = pick(r"\b(decision|decided|agreed|we will|we should|let'?s|going to|approved|confirm(?:ed)?)\b")
open_questions = pick(r"\?|\b(not decided|unclear|not sure|tbd|todo|need to decide|question|blocker|risk|follow up)\b")
actions = pick(r"\b(action|todo|follow[- ]?up|need to|please|i will|we need|next step|takeaway)\b")
now = datetime.now(timezone.utc).isoformat()

block = []
if incremental:
    block.extend(["", "---", "", f"## Meeting Update - {now}", "", "_Best-effort incremental update from the current meeting cursor; only new transcript/notes since the last summary run are processed._", ""])
else:
    block.extend([f"# {name} Current Meeting Summary", "", "## Tags", "- current-conversation", "- live-meeting", "- discussion", "- not-indexed", "", "## Metadata", f"- Generated: {now}", "- Source state: live/current meeting context, not indexed", "- Indexing note: this summary uses a cursor for best-effort incremental updates; run `discussion prep-conversation` after the meeting is done.", f"- Discussion day: `{display_path(day_dir)}`"])
    if source_dir:
        block.append(f"- Source folder: `{display_path(source_dir)}`")
    block.append("")

if not all_lines and incremental:
    block.extend(["## New Since Last Summary", "- No new transcript/notes detected since the previous current-meeting summary run.", ""])
else:
    block.append("## Where We Are" if not incremental else "### Where We Are Now")
    block.extend(section_items(where, "capture the current meeting state and latest point in the discussion."))
    block.append("")
    block.append("## What Was Discussed" if not incremental else "### Newly Discussed")
    block.extend(section_items(discussed, "capture the main topics discussed so far."))
    block.append("")
    block.append("## Decisions" if not incremental else "### New Decisions")
    block.extend(section_items(decisions, "record decisions once they are explicit."))
    block.append("")
    block.append("## Not Decided / Open Questions" if not incremental else "### New Open Questions / Not Decided")
    block.extend(section_items(open_questions, "record unresolved questions, tradeoffs, blockers, or unknowns."))
    block.append("")
    block.append("## Follow-ups / Actions" if not incremental else "### New Follow-ups / Actions")
    block.extend(section_items(actions, "record owners and next steps."))
    block.append("")

block.append("## Visual Context / Screenshots" if not incremental else "### New Visual Context / Screenshots")
image_list = new_image_paths if incremental else images
if image_list:
    for image in image_list[:20]:
        shown = display_path(image)
        if not shown.startswith("~") and not shown.startswith("/"):
            block.append(f"- [{image.name}]({shown})")
        else:
            block.append(f"- `{shown}`")
else:
    block.append("- No new screenshots/images detected for this update." if incremental else "- TODO: add screenshots/images captured during the meeting, if any.")
block.append("")
block.append("## Design Diagram" if not incremental else "### Design Diagram Update")
if needs_diagram:
    block.extend(["```mermaid", "flowchart TD", "  A[Current discussion] --> B[Main topics]", "  B --> C[Decisions]", "  B --> D[Open questions]", "  C --> E[Follow-ups]", "  D --> E", "```"])
else:
    block.append("- Not needed yet; add a Mermaid diagram if the discussion becomes a design/flow conversation.")
block.append("")
block.append("## Raw Sources" if not incremental else "### Sources Touched")
if texts:
    for path in texts:
        block.append(f"- `{display_path(path)}`")
else:
    block.append("- TODO: no text transcript/notes captured yet.")
if not incremental:
    block.extend(["", "## Current Meeting Handoff", "- This is a live/current-meeting summary. When the meeting is done, run `discussion prep-conversation` to index it into `~/Documents/Zoom/indexed/`."])

output.parent.mkdir(parents=True, exist_ok=True)
if incremental:
    with output.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(block) + "\n")
else:
    output.write_text("\n".join(block) + "\n", encoding="utf-8")

state_payload = {
    "updated_at": now,
    "offsets": new_offsets,
    "images": sorted(str(image.resolve()) for image in images),
}
state_path.write_text(json.dumps(state_payload, indent=2) + "\n", encoding="utf-8")
print(output)
CURRENTSUMMARYPY
}

while [ $# -gt 0 ]; do
  case "$1" in
    --date)
      DATE_KEY="${2:-}"
      shift 2
      ;;
    --file)
      INPUT_FILE="${2:-}"
      shift 2
      ;;
    --text)
      INPUT_TEXT="${2:-}"
      shift 2
      ;;
    --name)
      OUTPUT_NAME="${2:-}"
      CURRENT_CONVERSATION_NAME="${2:-}"
      shift 2
      ;;
    --out)
      SUMMARY_OUT="${2:-}"
      shift 2
      ;;
    --summary-name|--name)
      SUMMARY_NAME="${2:-}"
      shift 2
      ;;
    --title)
      BACKLOG_TITLE="${2:-}"
      shift 2
      ;;
    --project)
      BACKLOG_PROJECT="${2:-}"
      shift 2
      ;;
    --scope)
      BACKLOG_SCOPE="${2:-}"
      shift 2
      ;;
    --feature)
      CONVERSATION_FEATURE="${2:-}"
      shift 2
      ;;
    --recent)
      CONVERSATION_RECENT="true"
      shift
      ;;
    --source-dir)
      CONVERSATION_SOURCE_DIR="${2:-}"
      shift 2
      ;;
    --pattern)
      CONVERSATION_PATTERN="${2:-}"
      shift 2
      ;;
    --limit)
      CONVERSATION_LIMIT="${2:-}"
      LOOKUP_LIMIT="${2:-}"
      shift 2
      ;;
    --query|-q)
      LOOKUP_QUERY="${2:-}"
      shift 2
      ;;
    --root)
      LOOKUP_ROOTS+=("${2:-}")
      shift 2
      ;;
    --index-path|--db)
      CONVERSATION_INDEX_DB="${2:-}"
      shift 2
      ;;
    --reindex|--rebuild-index)
      LOOKUP_REINDEX="true"
      shift
      ;;
    --no-index)
      LOOKUP_NO_INDEX="true"
      shift
      ;;
    --json)
      LOOKUP_JSON="true"
      shift
      ;;
    --show)
      LOOKUP_SHOW="true"
      if [ "$CURRENT_MODE" != "summary" ]; then
        CURRENT_MODE="show"
      fi
      shift
      ;;
    --set)
      CURRENT_MODE="set"
      shift
      ;;
    --summary)
      CURRENT_MODE="summary"
      shift
      ;;
    --clear)
      CURRENT_MODE="clear"
      shift
      ;;
    --no-open)
      LOOKUP_OPEN_BROWSER="false"
      shift
      ;;
    --tag|--tags)
      CONVERSATION_TAGS+=("${2:-}")
      shift 2
      ;;
    --ready-root)
      CONVERSATION_READY_ROOT="${2:-}"
      shift 2
      ;;
    --chronological)
      CONVERSATION_ORDER="chronological"
      shift
      ;;
    --order)
      CONVERSATION_ORDER="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      case "$ACTION" in
        lookup|lookup-conversation)
          if [ -z "$LOOKUP_QUERY" ]; then
            LOOKUP_QUERY="$1"
          else
            LOOKUP_QUERY="$LOOKUP_QUERY $1"
          fi
          shift
          ;;
        *)
          echo "Unknown argument: $1" >&2
          usage >&2
          exit 2
          ;;
      esac
      ;;
  esac
done

if ! printf '%s' "$DATE_KEY" | grep -Eq '^[0-9]{2}_[0-9]{2}_[0-9]{4}$'; then
  echo "Invalid --date '$DATE_KEY'. Use DD_MM_YYYY." >&2
  exit 2
fi

case "$ACTION" in
  init)
    ensure_discussion_dirs
    echo "Discussion day ready: $(discussion_day_dir)"
    ;;
  add-text)
    if [ -n "$INPUT_FILE" ] && [ -n "$INPUT_TEXT" ]; then
      echo "Use either --file or --text, not both." >&2
      exit 2
    fi
    if [ -z "$INPUT_FILE" ] && [ -z "$INPUT_TEXT" ]; then
      echo "Missing input. Provide --file or --text." >&2
      exit 2
    fi
    ensure_discussion_dirs
    if [ -z "$OUTPUT_NAME" ]; then
      OUTPUT_NAME="discussion_$(date +%H%M%S).txt"
    fi
    if ! printf '%s' "$OUTPUT_NAME" | grep -Eq '\.txt$'; then
      OUTPUT_NAME="${OUTPUT_NAME}.txt"
    fi
    target_file="$(discussion_day_dir)/$OUTPUT_NAME"
    if [ -n "$INPUT_FILE" ]; then
      if [ ! -f "$INPUT_FILE" ]; then
        echo "Input file not found: $INPUT_FILE" >&2
        exit 1
      fi
      cp "$INPUT_FILE" "$target_file"
    else
      printf '%s\n' "$INPUT_TEXT" > "$target_file"
    fi
    echo "Saved discussion text: $target_file"
    write_current_conversation "${CURRENT_CONVERSATION_NAME:-$OUTPUT_NAME}" "$target_file" ""
    ;;
  add-screen)
    if [ -z "$INPUT_FILE" ]; then
      echo "Missing --file for add-screen." >&2
      exit 2
    fi
    if [ ! -f "$INPUT_FILE" ]; then
      echo "Input file not found: $INPUT_FILE" >&2
      exit 1
    fi
    ensure_discussion_dirs
    if [ -z "$OUTPUT_NAME" ]; then
      OUTPUT_NAME="$(basename "$INPUT_FILE")"
    fi
    target_file="$(discussion_day_dir)/screens/$OUTPUT_NAME"
    cp "$INPUT_FILE" "$target_file"
    echo "Saved screenshot: $target_file"
    write_current_conversation "${CURRENT_CONVERSATION_NAME:-$OUTPUT_NAME}" "" "$(discussion_day_dir)"
    ;;
  list)
    ensure_discussion_dirs
    echo "Discussion day: $(discussion_day_dir)"
    echo
    echo "Text files:"
    find "$(discussion_day_dir)" -mindepth 1 -maxdepth 1 -type f -name '*.txt' | sort | sed 's#^#- #'
    echo
    echo "Screens:"
    find "$(discussion_day_dir)/screens" -mindepth 1 -maxdepth 1 -type f | sort | sed 's#^#- #'
    ;;
  current|current-conversation|current-meeting)
    marker_file="$(current_conversation_file)"
    case "$CURRENT_MODE" in
      clear)
        rm -f "$marker_file"
        echo "Current conversation cleared: $marker_file"
        ;;
      set)
        name="${CURRENT_CONVERSATION_NAME:-${OUTPUT_NAME:-current conversation}}"
        write_current_conversation "$name" "$INPUT_FILE" "$CONVERSATION_SOURCE_DIR"
        ;;
      summary)
        if [ -f "$marker_file" ]; then
          marker_date="$(read_current_conversation_field date_key)"
          marker_name="$(read_current_conversation_field name)"
          marker_file_source="$(read_current_conversation_field source_file)"
          marker_dir_source="$(read_current_conversation_field source_dir)"
          if [ -n "$marker_date" ]; then
            DATE_KEY="$marker_date"
          fi
          if [ -n "$marker_name" ]; then
            SUMMARY_NAME="$marker_name"
          fi
          ensure_discussion_dirs
          if [ -n "$marker_file_source" ] && [ -f "$marker_file_source" ]; then
            cp "$marker_file_source" "$(discussion_day_dir)/$(slugify "${SUMMARY_NAME:-current-conversation}").txt"
          elif [ -n "$marker_dir_source" ] && [ -f "$marker_dir_source/meeting_saved_closed_caption.txt" ]; then
            cp "$marker_dir_source/meeting_saved_closed_caption.txt" "$(discussion_day_dir)/$(slugify "${SUMMARY_NAME:-current-conversation}").txt"
          fi
        else
          ensure_discussion_dirs
          if [ -z "$SUMMARY_NAME" ]; then
            SUMMARY_NAME="current-conversation"
          fi
        fi
        summary_path="$(discussion_day_dir)/$(slugify "${SUMMARY_NAME:-current-conversation}")-current-summary.md"
        generate_current_conversation_summary "$summary_path" "${SUMMARY_NAME:-current conversation}" "$(discussion_day_dir)" "${marker_dir_source:-}"
        if [ "$LOOKUP_OPEN_BROWSER" = "true" ]; then
          show_context_cmd="$ROOT_DIR/commands/show-context/show-context.command.sh"
          if [ -x "$show_context_cmd" ]; then
            "$show_context_cmd" --file "$summary_path"
          fi
        else
          printf '%s\n' "$summary_path"
        fi
        ;;
      show)
        if [ -f "$marker_file" ]; then
          cat "$marker_file"
        else
          echo "No current conversation marker found: $marker_file"
          echo "Fallback current discussion day: $(discussion_day_dir)"
        fi
        ;;
      *)
        echo "Invalid current conversation mode: $CURRENT_MODE" >&2
        exit 2
        ;;
    esac
    ;;
  summarize)
    ensure_discussion_dirs
    source_files=()
    mapfile -t source_files < <(discussion_source_files)
    source_files_rel=()
    for src in "${source_files[@]}"; do
      source_files_rel+=("$(to_repo_relative_path "$src")")
    done
    if [ "${#source_files[@]}" -eq 0 ]; then
      echo "No discussion source .txt files found in $(discussion_day_dir)." >&2
      echo "Add raw chat/caption text first with add-text." >&2
      exit 1
    fi
    if [ -z "$SUMMARY_OUT" ]; then
      SUMMARY_OUT="$(default_summary_path)"
    fi
    case "$SUMMARY_OUT" in
      "$(discussion_day_dir)"/*-summary.md) ;;
      *)
        SUMMARY_OUT="$(default_summary_path)"
        ;;
    esac
    {
      echo "# Discussion Summary ($DATE_KEY)"
      echo
      echo "tags: [discussion, raw-notes, summary]"
      echo "workflow: $(workflow_id)"
      echo "date: $DATE_KEY"
      echo
      echo "## Raw Sources"
      printf '%s\n' "${source_files_rel[@]}" | sed 's#^#- #'
      echo
      echo "## Tags"
      awk '
        BEGIN { IGNORECASE=1 }
        /TODO|ACTION|DECISION|FOLLOW[- ]?UP|RISK|BLOCKER/ {
          for (i=1; i<=NF; i++) {
            token=$i
            gsub(/[^A-Za-z0-9_-]/, "", token)
            if (token ~ /^(TODO|ACTION|DECISION|FOLLOWUP|RISK|BLOCKER)$/) {
              seen[token]=1
            }
          }
        }
        END {
          for (k in seen) {
            print "- " tolower(k)
          }
        }
      ' "${source_files[@]}" 2>/dev/null || true
      echo
      echo "## Participants"
      awk '
        /^\[[^]]+\][[:space:]]+[0-9]{2}:[0-9]{2}:[0-9]{2}$/ {
          name=$0
          sub(/^\[/, "", name)
          sub(/\].*$/, "", name)
          seen[name]=1
        }
        END {
          for (p in seen) print "- " p
        }
      ' "${source_files[@]}" 2>/dev/null || true
      echo
      echo "## Conversation Highlights"
      awk '
        BEGIN {
          IGNORECASE=1
          max=12
          pattern="latency|alert|config|localization|instance|cpu|threshold|cache|on-call|ack|p99|health|datadog|spike|support"
        }
        {
          line=$0
          sub(/\r$/, "", line)
          if (line ~ /^\[[^]]+\][[:space:]]+[0-9]{2}:[0-9]{2}:[0-9]{2}$/) next
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
          if (line == "") next
          if (line ~ pattern && !seen[line]) {
            seen[line]=1
            print "- " line
            count++
            if (count >= max) exit
          }
        }
      ' "${source_files[@]}" 2>/dev/null || true
      echo
      echo "## Candidate Action Lines"
      awk '
        BEGIN { IGNORECASE=1 }
        /TODO|ACTION|DECISION|FOLLOW[- ]?UP|RISK|BLOCKER/ { print "- " $0 }
      ' "${source_files[@]}" 2>/dev/null || true
      echo
      echo "## Next Processing"
      echo "- Convert into a backlog item with: discussion.command.sh backlog-draft --date $DATE_KEY"
      echo "- Continue normal delivery flow; keep this as raw source-of-truth."
    } > "$SUMMARY_OUT"
    echo "Summary created: $SUMMARY_OUT"
    ;;
  index|index-conversations)
    index_helper="$ROOT_DIR/commands/discussion/discussion_index.py"
    if [ ! -x "$index_helper" ]; then
      echo "Conversation index helper not found: $index_helper" >&2
      exit 1
    fi
    index_args=(index --db "$(conversation_index_db)" --root "$HOME/Documents/Zoom/indexed" --root "$(discussion_root_dir)")
    for root in "${LOOKUP_ROOTS[@]}"; do
      index_args+=(--root "$root")
    done
    if [ "$LOOKUP_JSON" = "true" ]; then
      index_args+=(--json)
    fi
    "$index_helper" "${index_args[@]}"
    ;;
  lookup|lookup-conversation)
    if [ -z "$LOOKUP_QUERY" ]; then
      echo "Missing lookup query. Use --query <text>." >&2
      exit 2
    fi
    if ! printf '%s' "$LOOKUP_LIMIT" | grep -Eq '^[0-9]+$' || [ "$LOOKUP_LIMIT" -le 0 ]; then
      echo "Invalid --limit '$LOOKUP_LIMIT'. Use a positive integer." >&2
      exit 2
    fi
    index_helper="$ROOT_DIR/commands/discussion/discussion_index.py"
    if [ ! -x "$index_helper" ]; then
      echo "Conversation index helper not found: $index_helper" >&2
      exit 1
    fi
    lookup_args=(lookup --db "$(conversation_index_db)" --query "$LOOKUP_QUERY" --limit "$LOOKUP_LIMIT" --root "$HOME/Documents/Zoom/indexed" --root "$(discussion_root_dir)")
    for root in "${LOOKUP_ROOTS[@]}"; do
      lookup_args+=(--root "$root")
    done
    if [ "$LOOKUP_JSON" = "true" ]; then
      lookup_args+=(--json)
    fi
    if [ "$LOOKUP_REINDEX" = "true" ]; then
      lookup_args+=(--rebuild)
    fi
    if [ "$LOOKUP_NO_INDEX" = "true" ]; then
      lookup_args+=(--no-index)
    fi
    lookup_out="$($index_helper "${lookup_args[@]}")"
    printf '%s\n' "$lookup_out"
    if [ "$LOOKUP_SHOW" = "true" ]; then
      top_result="$(printf '%s\n' "$lookup_out" | sed -n 's/^TOP_RESULT=//p' | head -n 1)"
      if [ -z "$top_result" ]; then
        echo "No top result to show." >&2
        exit 1
      fi
      show_context_cmd="$ROOT_DIR/commands/show-context/show-context.command.sh"
      if [ ! -x "$show_context_cmd" ]; then
        echo "show-context command not found: $show_context_cmd" >&2
        exit 1
      fi
      if [ "$LOOKUP_OPEN_BROWSER" = "true" ]; then
        "$show_context_cmd" --file "$top_result" --request "$LOOKUP_QUERY" --result "$top_result"
      else
        "$show_context_cmd" --file "$top_result" --request "$LOOKUP_QUERY" --result "$top_result" --no-open
      fi
    fi
    ;;
  prep-conversation)
    ensure_discussion_dirs
    if [ "$CONVERSATION_RECENT" = "true" ]; then
      if [ ! -d "$CONVERSATION_SOURCE_DIR" ]; then
        echo "Conversation source directory not found: $CONVERSATION_SOURCE_DIR" >&2
        exit 1
      fi
      if ! printf '%s' "$CONVERSATION_LIMIT" | grep -Eq '^[0-9]+$'; then
        echo "Invalid --limit '$CONVERSATION_LIMIT'. Use a positive integer." >&2
        exit 2
      fi
      case "$CONVERSATION_ORDER" in
        newest|chronological) ;;
        *)
          echo "Invalid --order '$CONVERSATION_ORDER'. Use newest or chronological." >&2
          exit 2
          ;;
      esac
      command_python - \
        "$CONVERSATION_SOURCE_DIR" \
        "$CONVERSATION_PATTERN" \
        "$CONVERSATION_LIMIT" \
        "$CONVERSATION_ORDER" \
        "$(discussion_day_dir)" \
        "$DATE_KEY" \
        "$(workflow_id)" \
        "$ROOT_DIR" \
        "$CONVERSATION_READY_ROOT" \
        "${CONVERSATION_TAGS[@]}" <<'RECENTPY'
import fnmatch
import re
import shutil
import sys
from pathlib import Path

source_dir = Path(sys.argv[1]).expanduser().resolve()
pattern = sys.argv[2].strip() or "meeting_saved_closed_caption.txt"
limit = int(sys.argv[3])
order = sys.argv[4].strip() or "newest"
day_dir = Path(sys.argv[5])
date_key = sys.argv[6]
workflow = sys.argv[7]
repo_root = Path(sys.argv[8]).resolve()
ready_root_arg = sys.argv[9].strip()
extra_tags = []
for raw in sys.argv[10:]:
    for part in raw.replace(",", " ").split():
        tag = "".join(ch.lower() if ch.isalnum() else "-" for ch in part).strip("-")
        if tag and tag not in extra_tags:
            extra_tags.append(tag)

def slugify(value):
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "conversation"

def is_prepared(path):
    return any(part == "indexed" or part.endswith("-feature") for part in path.parts)

def clean_title(folder_name):
    title = re.sub(r"^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})\.(\d{2})\.(\d{2})\s*", "", folder_name).strip()
    title = re.sub(r"^NEW ZOOM\s*-\s*", "", title, flags=re.I).strip()
    title = title.replace("reveiw", "review")
    return title or folder_name

def infer_topic(folder_name, text):
    cleaned = clean_title(folder_name)
    body = text.lower()
    if "state sync" in body or "statesync" in body or "statesync" in cleaned.lower():
        topic = "helios-statesync-weekly-touchpoint"
    elif "oem" in body and ("dimension" in body or "encoding" in body or "deterministic" in body):
        topic = "oem-dimension-encoding"
    elif "cdn" in body and ("dictionar" in body or "localization" in body):
        topic = "localization-cdn-cache-office-hours"
    elif "internal tools portal" in body or ("open" in body and "pages" in body and "apis" in body):
        topic = "internal-tools-portal-api-refinement"
    elif "variant" in body and "metadata" in body and "localization" in body:
        topic = "localization-config-variants-refinement"
    elif "global" in body and "domain" in body and "cache" in body:
        topic = "global-domain-config-cache"
    elif "localization management service" in body and "search" in body:
        topic = "localization-search-client-engineering-sync"
    elif "epic" in body and ("ticket" in body or "board" in body):
        topic = "jira-epic-ticket-cleanup"
    elif cleaned.lower() == "zoom meeting" and "config" in body:
        topic = "config-service-debugging-session"
    else:
        topic = cleaned
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", folder_name)
    prefix = m.group(1) if m else ""
    return f"{prefix}-{slugify(topic)}" if prefix else slugify(topic)

def display_source(path):
    home = Path.home().resolve()
    try:
        return "~" + str(path.resolve()).removeprefix(str(home))
    except Exception:
        return str(path)

def rel(path):
    try:
        return "./" + str(path.resolve().relative_to(repo_root))
    except Exception:
        return str(path)

def excerpt(path, max_chars=2400):
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    snippet = "\n".join(lines[:80])
    if len(snippet) > max_chars:
        snippet = snippet[:max_chars].rstrip() + "\n..."
    return snippet

def important_parts(path, max_items=8):
    raw_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    keywords = re.compile(r"\b(action|decision|todo|follow|risk|blocker|cache|config|localization|domain|tag|state sync|statesync|oem|variant|metadata|api|portal|cdn|publish|invalidate|ticket|epic)\b", re.I)
    parts = []
    seen = set()
    for idx, line in enumerate(raw_lines, start=1):
        clean = line.strip()
        if not clean or clean in seen:
            continue
        if re.match(r"^\[[^]]+\]\s+\d{1,2}:\d{2}:\d{2}$", clean):
            continue
        if keywords.search(clean):
            seen.add(clean)
            parts.append((idx, clean))
            if len(parts) >= max_items:
                break
    if not parts:
        for idx, line in enumerate(raw_lines, start=1):
            clean = line.strip()
            if clean and not clean.startswith("["):
                parts.append((idx, clean))
                if len(parts) >= min(3, max_items):
                    break
    return parts

files = [p for p in source_dir.rglob("*") if p.is_file() and not is_prepared(p.relative_to(source_dir))]
selected = [p for p in files if fnmatch.fnmatch(p.name, pattern) or fnmatch.fnmatch(str(p.relative_to(source_dir)), pattern)]
selected.sort(key=lambda p: p.stat().st_mtime, reverse=True)
selected = selected[:limit]
if order == "chronological":
    selected.sort(key=lambda p: p.stat().st_mtime)
if not selected:
    raise SystemExit(f"No files matched {pattern!r} under {source_dir}")
zoom_root = Path.home() / "Documents" / "Zoom"
ready_root = Path(ready_root_arg).expanduser().resolve() if ready_root_arg else zoom_root / "indexed"
ready_root.mkdir(parents=True, exist_ok=True)
day_dir.mkdir(parents=True, exist_ok=True)
base_tags = ["conversation-history", "prepared-context", "feature-context", "zoom"]
for tag in extra_tags:
    if tag not in base_tags:
        base_tags.append(tag)
for caption in selected:
    folder = caption.parent
    text = caption.read_text(encoding="utf-8", errors="replace")
    slug = infer_topic(folder.name, text)
    dest = ready_root / slug
    counter = 2
    while dest.exists() and dest.resolve() != folder.resolve():
        dest = ready_root / f"{slug}-{counter}"
        counter += 1
    if folder.resolve() != dest.resolve():
        shutil.move(str(folder), str(dest))
    indexed_caption = dest / caption.name
    title = slug.replace("-", " ")
    topic_tags = [part for part in slug.split("-") if part and not part.isdigit() and len(part) > 2]
    item_tags = base_tags.copy()
    for tag in topic_tags:
        if tag not in item_tags:
            item_tags.append(tag)
    md_name = f"{slug}-feature.md"
    session_md = day_dir / md_name
    lines = []
    lines.append(f"# {title} Conversation Context")
    lines.append("")
    lines.append("## Tags")
    for tag in item_tags:
        lines.append(f"- {tag}")
    lines.append("")
    lines.append("## Metadata")
    lines.append(f"- Workflow: {workflow}")
    lines.append(f"- Date: {date_key}")
    lines.append(f"- Feature: {title}")
    lines.append("- Source kind: Zoom conversation history")
    lines.append(f"- Indexed folder: `{display_source(dest)}`")
    lines.append(f"- Original folder name: `{folder.name}`")
    lines.append(f"- File pattern: `{pattern}`")
    lines.append(f"- Order: `{order}`")
    lines.append("")
    lines.append("## Show Context")
    lines.append(f"- Indexed folder: `{display_source(dest)}`")
    lines.append(f"- Session index: `{rel(session_md)}`")
    lines.append(f"- Suggested lookup: `./commands/show-context/show-context.command.sh --feature \"{title}\"`")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- Title hint: {clean_title(folder.name)}")
    lines.append(f"- Indexed from caption: `{caption.name}`")
    lines.append("- Summary: TODO refine from transcript when this conversation is used for delivery context.")
    lines.append("")
    lines.append("## Raw Sources")
    for child in sorted(dest.iterdir()):
        if child.is_file() and child.name != md_name and child.name != "summary.md":
            lines.append(f"- `{display_source(child)}`")
    lines.append("")
    lines.append("## Search Excerpts")
    lines.append(f"### {caption.name}")
    lines.append("")
    lines.append("```text")
    lines.append(excerpt(indexed_caption))
    lines.append("```")
    lines.append("")
    content = "\n".join(lines)
    (dest / md_name).write_text(content, encoding="utf-8")
    summary_lines = [
        f"# {title} Summary",
        "",
        "## Tags",
        *[f"- {tag}" for tag in item_tags],
        "",
        "## Source",
        f"- Indexed folder: `{display_source(dest)}`",
        f"- Caption: [{caption.name}]({caption.name})",
        f"- Feature context: [{md_name}]({md_name})",
        "",
        "## Summary",
        f"- Title hint: {clean_title(folder.name)}",
        "- Prepared from the Zoom caption text; refine this summary when the conversation is used for delivery context.",
        "",
        "## Important Parts",
    ]
    for line_no, snippet in important_parts(indexed_caption):
        summary_lines.append(f"- [{caption.name}: line {line_no}]({caption.name}) - {snippet}")
    summary_lines.extend([
        "",
        "## Show Context",
        f"- Feature context: `{md_name}`",
    ])
    (dest / "summary.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    session_md.write_text(content, encoding="utf-8")
    print(dest)
RECENTPY
      refresh_conversation_index_quiet
      exit 0
    fi

    if [ -z "$CONVERSATION_FEATURE" ]; then
      echo "Missing --feature for prep-conversation." >&2
      exit 2
    fi
    if [ ! -d "$CONVERSATION_SOURCE_DIR" ]; then
      echo "Conversation source directory not found: $CONVERSATION_SOURCE_DIR" >&2
      exit 1
    fi
    if ! printf '%s' "$CONVERSATION_LIMIT" | grep -Eq '^[0-9]+$'; then
      echo "Invalid --limit '$CONVERSATION_LIMIT'. Use a positive integer." >&2
      exit 2
    fi
    case "$CONVERSATION_ORDER" in
      newest|chronological) ;;
      *)
        echo "Invalid --order '$CONVERSATION_ORDER'. Use newest or chronological." >&2
        exit 2
        ;;
    esac
    prep_out="$(
      command_python - \
        "$CONVERSATION_SOURCE_DIR" \
        "$CONVERSATION_FEATURE" \
        "$CONVERSATION_PATTERN" \
        "$CONVERSATION_LIMIT" \
        "$CONVERSATION_ORDER" \
        "$(discussion_day_dir)" \
        "$DATE_KEY" \
        "$(workflow_id)" \
        "$ROOT_DIR" \
        "$CONVERSATION_READY_ROOT" \
        "${CONVERSATION_TAGS[@]}" <<'PREPPY'
import fnmatch
import html
import re
import shutil
import sys
from pathlib import Path

source_dir = Path(sys.argv[1]).expanduser().resolve()
feature = sys.argv[2].strip()
pattern = sys.argv[3].strip() or "*"
limit = int(sys.argv[4])
order = sys.argv[5].strip() or "newest"
day_dir = Path(sys.argv[6])
date_key = sys.argv[7]
workflow = sys.argv[8]
repo_root = Path(sys.argv[9]).resolve()
ready_root_arg = sys.argv[10].strip()
extra_tags = []
for raw in sys.argv[11:]:
    for part in raw.replace(",", " ").split():
        tag = "".join(ch.lower() if ch.isalnum() else "-" for ch in part).strip("-")
        if tag and tag not in extra_tags:
            extra_tags.append(tag)
if limit <= 0:
    raise SystemExit("--limit must be positive")

def slugify(value):
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "conversation"

feature_slug = slugify(feature)
def is_prepared_folder(path):
    return any(part == "indexed" or part.endswith("-feature") for part in path.parts)
all_files = [p for p in source_dir.rglob("*") if p.is_file() and not is_prepared_folder(p.relative_to(source_dir))]
selected = [p for p in all_files if fnmatch.fnmatch(p.name, pattern) or fnmatch.fnmatch(str(p.relative_to(source_dir)), pattern)]
selected.sort(key=lambda p: p.stat().st_mtime, reverse=True)
selected = selected[:limit]
if order == "chronological":
    selected.sort(key=lambda p: p.stat().st_mtime)
if not selected:
    raise SystemExit(f"No files matched {pattern!r} under {source_dir}")

def default_ready_root():
    zoom_root = Path.home() / "Documents" / "Zoom"
    try:
        resolved_source = source_dir.resolve()
        resolved_zoom = zoom_root.resolve()
        if resolved_source == resolved_zoom or resolved_zoom in resolved_source.parents:
            return zoom_root / "indexed"
    except Exception:
        pass
    return None

ready_root = Path(ready_root_arg).expanduser().resolve() if ready_root_arg else default_ready_root()
ready_dir = None
if ready_root is not None:
    ready_dir = source_dir if source_dir.parent.name == "indexed" else ready_root / feature_slug
else:
    ready_dir = None
if ready_dir is not None:
    if source_dir.resolve() != ready_dir.resolve():
        base_ready_dir = ready_dir
        counter = 2
        while ready_dir.exists() and ready_dir.resolve() != source_dir.resolve():
            ready_dir = base_ready_dir.with_name(f"{base_ready_dir.name}-{counter}")
            counter += 1
        original_source_dir = source_dir
        zoom_root = Path.home() / "Documents" / "Zoom"
        try:
            source_is_zoom = source_dir.resolve() == zoom_root.resolve() or zoom_root.resolve() in source_dir.resolve().parents
        except Exception:
            source_is_zoom = False
        if source_is_zoom:
            shutil.move(str(source_dir), str(ready_dir))
            source_dir = ready_dir
            selected = [ready_dir / src.relative_to(original_source_dir) for src in selected]
        else:
            ignore = shutil.ignore_patterns("indexed", "*-feature")
            shutil.copytree(source_dir, ready_dir, ignore=ignore)
    else:
        ready_dir.mkdir(parents=True, exist_ok=True)

def rel(path):
    try:
        return "./" + str(path.resolve().relative_to(repo_root))
    except Exception:
        try:
            return str(path.resolve().relative_to(day_dir.resolve()))
        except Exception:
            return str(path)

def display_source(path):
    home = Path.home().resolve()
    try:
        return "~" + str(path.resolve()).removeprefix(str(home))
    except Exception:
        return str(path)

def is_text(path):
    return path.suffix.lower() in {".txt", ".md", ".vtt", ".srt", ".log", ".csv", ".json", ".yaml", ".yml"}

def excerpt(path, max_chars=2400):
    if not is_text(path):
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    snippet = "\n".join(lines[:80])
    if len(snippet) > max_chars:
        snippet = snippet[:max_chars].rstrip() + "\n..."
    return snippet

def important_parts(path, max_items=8):
    if not is_text(path):
        return []
    raw_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    keywords = re.compile(r"\b(action|decision|todo|follow|risk|blocker|cache|config|localization|domain|tag|state sync|statesync|oem|variant|metadata|api|portal|cdn|publish|invalidate|ticket|epic)\b", re.I)
    parts = []
    seen = set()
    for idx, line in enumerate(raw_lines, start=1):
        clean = line.strip()
        if not clean or clean in seen:
            continue
        if re.match(r"^\[[^]]+\]\s+\d{1,2}:\d{2}:\d{2}$", clean):
            continue
        if keywords.search(clean):
            seen.add(clean)
            parts.append((path, idx, clean))
            if len(parts) >= max_items:
                break
    return parts

base_tags = ["conversation-history", "prepared-context", "feature-context"]
if "zoom" in str(source_dir).lower():
    base_tags.append("zoom")
for tag in extra_tags:
    if tag not in base_tags:
        base_tags.append(tag)
for tag in [part for part in feature_slug.split("-") if part and not part.isdigit() and len(part) > 2]:
    if tag not in base_tags:
        base_tags.append(tag)

out = day_dir / f"{feature_slug}-feature.md"
raw_source_rel = rel(source_dir)
ready_source_path = ready_dir if ready_dir is not None else source_dir
lines = []
lines.append(f"# {feature} Conversation Context")
lines.append("")
lines.append("## Tags")
for tag in base_tags:
    lines.append(f"- {tag}")
lines.append("")
lines.append("## Metadata")
lines.append(f"- Workflow: {workflow}")
lines.append(f"- Date: {date_key}")
lines.append(f"- Feature: {feature}")
lines.append(f"- Source kind: conversation history")
lines.append(f"- Original source folder: `{display_source(source_dir)}`")
lines.append(f"- Original/prepared source folder: `{raw_source_rel}`")
if ready_dir is not None:
    lines.append(f"- Indexed folder: `{display_source(ready_dir)}`")
lines.append(f"- File pattern: `{pattern}`")
lines.append(f"- File limit: `{limit}`")
lines.append(f"- Order: `{order}`")
lines.append("")
lines.append("## Show Context")
lines.append(f"- Prepared feature context: `{rel(out)}`")
lines.append(f"- Source folder: `{raw_source_rel}`")
if ready_dir is not None:
    lines.append(f"- Indexed folder: `{display_source(ready_dir)}`")
lines.append(f"- Suggested lookup: `./commands/show-context/show-context.command.sh --feature \"{feature}\"`")
lines.append("")
lines.append("## Raw Sources")
for src in selected:
    indexed_src = ready_dir / src.relative_to(source_dir) if ready_dir is not None else src
    lines.append(f"- `{display_source(indexed_src)}` from `{display_source(src)}`")
lines.append("")
lines.append("## Conversation Index")
for src in selected:
    indexed_src = ready_dir / src.relative_to(source_dir) if ready_dir is not None else src
    kind = "text" if is_text(indexed_src) else "file"
    lines.append(f"- `{indexed_src.relative_to(ready_source_path)}`: {kind}, {indexed_src.stat().st_size} bytes")
lines.append("")
lines.append("## Search Excerpts")
for src in selected:
    indexed_src = ready_dir / src.relative_to(source_dir) if ready_dir is not None else src
    snippet = excerpt(indexed_src)
    if not snippet:
        continue
    lines.append(f"### {indexed_src.relative_to(ready_source_path)}")
    lines.append("")
    lines.append("```text")
    lines.append(snippet)
    lines.append("```")
    lines.append("")
lines.append("## Next Processing")
lines.append("- Use this file as the searchable conversation-history context for `show-context`.")
lines.append("- Convert stable decisions into the real feature doc or backlog item when they become delivery scope.")
lines.append("")
content = "\n".join(lines)
out.write_text(content, encoding="utf-8")
if ready_dir is not None:
    ready_md = ready_dir / f"{feature_slug}-feature.md"
    ready_md.write_text(content, encoding="utf-8")
    summary_lines = [
        f"# {feature} Summary",
        "",
        "## Tags",
        *[f"- {tag}" for tag in base_tags],
        "",
        "## Source",
        f"- Indexed folder: `{display_source(ready_dir)}`",
        f"- Feature context: [{ready_md.name}]({ready_md.name})",
        "",
        "## Summary",
        "- Prepared from the conversation source text; refine this summary when the conversation is used for delivery context.",
        "",
        "## Important Parts",
    ]
    important = []
    for src in selected:
        indexed_src = ready_dir / src.relative_to(source_dir) if ready_dir is not None else src
        important.extend(important_parts(indexed_src))
    for item_path, line_no, snippet in important[:8]:
        rel_item = item_path.relative_to(ready_dir)
        summary_lines.append(f"- [{rel_item}: line {line_no}]({rel_item}) - {snippet}")
    summary_lines.extend([
        "",
        "## Show Context",
        f"- Feature context: `{ready_md.name}`",
    ])
    (ready_dir / "summary.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print(ready_md)
print(out)
print(ready_dir if ready_dir is not None else source_dir)
PREPPY
    )"
    printf '%s\n' "$prep_out"
    ;;
  backlog-draft)
    ensure_discussion_dirs
    if [ -z "$BACKLOG_TITLE" ]; then
      BACKLOG_TITLE="discussion-${DATE_KEY}"
    fi
    if [ -z "$BACKLOG_SCOPE" ]; then
      BACKLOG_SCOPE="Process discussion raw notes and screenshots into implementation-ready scope."
    fi
    if [ -z "$BACKLOG_PROJECT" ]; then
      current_session="$(read_current_session_dir || true)"
      if [ -n "$current_session" ]; then
        BACKLOG_PROJECT="$(session_read_field "$current_session" PROJECT_LABEL)"
      fi
    fi
    if [ -z "$BACKLOG_PROJECT" ]; then
      BACKLOG_PROJECT="TBD"
    fi
    if [ -z "$SUMMARY_OUT" ]; then
      SUMMARY_OUT="$(discussion_day_dir)/discussion-summary.md"
    fi
    if [ ! -f "$SUMMARY_OUT" ]; then
      "$0" summarize --date "$DATE_KEY" --out "$SUMMARY_OUT" >/dev/null
    fi
    if [ -z "$BACKLOG_OUT" ]; then
      BACKLOG_OUT="$(backlog_root_dir)/$(slugify "$BACKLOG_TITLE").md"
    fi
    summary_rel="$(to_repo_relative_path "$SUMMARY_OUT")"
    day_dir_rel="$(to_repo_relative_path "$(discussion_day_dir)")"
    screens_dir_rel="$(to_repo_relative_path "$(discussion_day_dir)/screens")"
    {
      echo "# $BACKLOG_TITLE"
      echo
      echo "project: $BACKLOG_PROJECT"
      echo "task: $BACKLOG_TITLE"
      echo "scope: $BACKLOG_SCOPE"
      echo "docs: discussion summary \`$summary_rel\`"
      echo
      echo "## Problem Statement"
      echo "- Convert raw discussion artifacts into structured, implementation-ready deliverables."
      echo
      echo "## Technical Details"
      echo "- Raw discussion folder: \`$day_dir_rel\`"
      echo "- Screens folder: \`$screens_dir_rel\`"
      echo "- Source summary: \`$summary_rel\`"
      echo
      echo "## Acceptance Criteria"
      echo "- Discussion artifacts are preserved as raw source-of-truth."
      echo "- A refined implementation scope is produced for normal delivery flow."
    } > "$BACKLOG_OUT"
    echo "Backlog draft created: $BACKLOG_OUT"
    ;;
  help|*)
    usage
    ;;
esac
