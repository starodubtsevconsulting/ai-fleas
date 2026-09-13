#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "show-context" || exit $?
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT_DIR/ai-config}"
source "$SCRIPT_DIR/../runtime-paths.sh"
BROWSER_CMD="$ROOT_DIR/ai-commands/connect/browser/browser.command.sh"
PYTHON_INSTALLER=""
NODE_INSTALLER=""
PROJECTS_REGISTRY="${AI_PROFILE_PROJECT_FILE:-}"
CURRENT_PLAN_PATH_FILE="$(ai_current_plan_pointer_path "$APP_ROOT")"
CURRENT_SESSION_PATH_FILE="$CURRENT_PLAN_PATH_FILE"

CONTEXT_FILE=""
MODE="context"
REPORT_TEMPLATE=""
RULE_REVIEW_FILES=()
FEATURE_QUERY=""
PROJECT_LABEL=""
RELATED_PROJECT_DIRS=()
RELATED_PROJECT_LABELS=()
SESSION_CONTEXT_DIRS=()
SECTION=""
TITLE=""
REQUEST_TEXT=""
RESULT_TEXT=""
OPEN_BROWSER="true"
OPEN_LINKS="false"
URLS=()
PATHS=()
SEE_MODE="false"
SEE_INPUT=""
SEE_DIR="${SHOW_CONTEXT_SEE_DIR:-$HOME/Desktop/see}"
MEETINGS_CONTEXT_DIR="${SHOW_CONTEXT_MEETINGS_DIR:-}"

usage() {
  cat <<'USAGE_EOF'
Usage:
  show-context.command.sh --template md-rules-changed --file <markdown-rule> [--file <markdown-rule> ...] [--title <title>] [--request <text>] [--result <text>] [--no-open]
  show-context.command.sh rule-review --file <markdown-rule> [--file <markdown-rule> ...] [--title <title>] [--request <text>] [--result <text>] [--no-open]
  show-context.command.sh [--project-dir <path>] [--output-dir <path>] --file <path> [--section <heading>] [--title <title>] [--request <text>] [--result <text>] [--open-links] [--path <path>] [--no-open]
  show-context.command.sh [--project <label>|--project-dir <path>] [--output-dir <path>] --feature <query> [--section <heading>] [--title <title>] [--request <text>] [--result <text>] [--open-links] [--path <path>] [--no-open]
  show-context.command.sh [--project-dir <path>] [--output-dir <path>] --url <url> [--url <url> ...] [--path <path>]
  show-context.command.sh [--project-dir <path>] [--output-dir <path>] --path <path> [--path <path> ...]
  show-context.command.sh [--project-dir <path>] [--output-dir <path>] --see [latest|all|<file-name-or-pattern>] [--see-dir <path>]

Optional meeting discovery:
  --meetings-dir <path>  Search prepared meeting context under an explicitly configured folder.
USAGE_EOF
}

if [[ "${1:-}" == "rule-review" ]]; then
  MODE="rule-review"
  REPORT_TEMPLATE="md-rules-changed"
  shift
fi

for ((argument_index = 1; argument_index <= $#; argument_index += 1)); do
  if [[ "${!argument_index}" == "--template" ]]; then
    template_value_index=$((argument_index + 1))
    REPORT_TEMPLATE=""
    if ((template_value_index <= $#)); then
      REPORT_TEMPLATE="${!template_value_index}"
    fi
    if [[ "$REPORT_TEMPLATE" != "md-rules-changed" ]]; then
      echo "Unknown show-context template: $REPORT_TEMPLATE" >&2
      echo "Supported templates: md-rules-changed" >&2
      exit 2
    fi
    MODE="rule-review"
  fi
done

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir) AI_FLOW_PROJECT_DIR="${2:-}"; shift 2 ;;
    --project) PROJECT_LABEL="${2:-}"; shift 2 ;;
    --output-dir) AI_FLOW_OUTPUT_DIR="${2:-}"; shift 2 ;;
    --template) REPORT_TEMPLATE="${2:-}"; shift 2 ;;
    --file)
      if [[ "$MODE" == "rule-review" ]]; then RULE_REVIEW_FILES+=("${2:-}"); else CONTEXT_FILE="${2:-}"; fi
      shift 2 ;;
    --feature) FEATURE_QUERY="${2:-}"; shift 2 ;;
    --section) SECTION="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    --request) REQUEST_TEXT="${2:-}"; shift 2 ;;
    --result) RESULT_TEXT="${2:-}"; shift 2 ;;
    --url) URLS+=("${2:-}"); shift 2 ;;
    --path) PATHS+=("${2:-}"); shift 2 ;;
    --see)
      SEE_MODE="true"
      if [[ $# -gt 1 && "${2:-}" != --* ]]; then SEE_INPUT="${2:-}"; shift 2; else SEE_INPUT="latest"; shift; fi ;;
    --see-dir) SEE_DIR="${2:-}"; shift 2 ;;
    --meetings-dir) MEETINGS_CONTEXT_DIR="${2:-}"; shift 2 ;;
    --open-links) OPEN_LINKS="true"; shift ;;
    --no-open) OPEN_BROWSER="false"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown parameter: $1" >&2; usage >&2; exit 1 ;;
  esac
done

export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR

# The remaining implementation is unchanged; all browser opens route through
# the categorized connect/browser command selected above.

build_rule_review_report() {
  local output_root report_file
  if [[ ${#RULE_REVIEW_FILES[@]} -eq 0 ]]; then
    echo "The md-rules-changed template requires at least one --file <markdown-rule>." >&2
    exit 2
  fi
  output_root="$(output_root)"
  mkdir -p "$output_root"
  report_file="$output_root/$(date -u +"%Y%m%dT%H%M%SZ")-rule-review.md"
  CONTEXT_FILE="$report_file"
  printf '# %s\n\n' "${TITLE:-Markdown rule review}" > "$report_file"
  for source_file in "${RULE_REVIEW_FILES[@]}"; do
    printf '## `%s`\n\n' "$source_file" >> "$report_file"
    cat "$source_file" >> "$report_file"
    printf '\n\n' >> "$report_file"
  done
}

output_root() {
  if [[ -n "$AI_FLOW_OUTPUT_DIR" ]]; then
    if [[ "${AI_FLOW_OUTPUT_DIR%/}" == */.ai ]]; then printf '%s\n' "${AI_FLOW_OUTPUT_DIR%/}/tmp/show-context"; else printf '%s\n' "$AI_FLOW_OUTPUT_DIR"; fi
  else
    printf '%s\n' "$ROOT_DIR/.ai/tmp/show-context"
  fi
}

resolve_feature_file() {
  if [[ -z "$FEATURE_QUERY" ]]; then return 0; fi
  if [[ -z "$AI_FLOW_PROJECT_DIR" ]]; then echo "--feature requires a project context." >&2; exit 1; fi
  CONTEXT_FILE="$(find "$AI_FLOW_PROJECT_DIR" -type f -name '*.md' | grep -i "$FEATURE_QUERY" | head -n1 || true)"
  [[ -n "$CONTEXT_FILE" ]] || { echo "No feature/context match found for query: $FEATURE_QUERY" >&2; exit 1; }
}

open_local_paths() {
  [[ "$OPEN_BROWSER" == "true" ]] || return 0
  local p target
  for p in "${PATHS[@]}"; do
    [[ -e "$p" ]] || continue
    if [[ -d "$p" ]]; then target="$p"; else target="$(dirname "$p")"; fi
    if command -v gio >/dev/null 2>&1; then gio open "$target" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$target" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then open "$target" >/dev/null 2>&1 || true
    fi
  done
}

if [[ "$MODE" == "rule-review" ]]; then build_rule_review_report; fi
resolve_feature_file

if [[ ${#URLS[@]} -gt 0 ]]; then
  printf '%s\n' "${URLS[@]}"
  if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then "$BROWSER_CMD" "${URLS[@]}"; fi
  open_local_paths
  exit 0
fi

if [[ -z "$CONTEXT_FILE" && ${#PATHS[@]} -gt 0 ]]; then
  printf '%s\n' "${PATHS[@]}"
  open_local_paths
  exit 0
fi

[[ -n "$CONTEXT_FILE" ]] || { usage >&2; exit 1; }
[[ -f "$CONTEXT_FILE" ]] || { echo "Context file not found: $CONTEXT_FILE" >&2; exit 1; }

OUTPUT_ROOT="$(output_root)"
mkdir -p "$OUTPUT_ROOT"
OUT_FILE="$OUTPUT_ROOT/$(date -u +"%Y%m%dT%H%M%SZ")-$(basename "$CONTEXT_FILE" | tr -c 'A-Za-z0-9._-' '-').html"

command_python - "$CONTEXT_FILE" "$OUT_FILE" "$SECTION" "$TITLE" <<'PY'
import html, sys
from pathlib import Path
source=Path(sys.argv[1]); target=Path(sys.argv[2]); section=sys.argv[3].strip(); title=sys.argv[4].strip() or source.name
text=source.read_text(encoding='utf-8',errors='replace')
body=f'<pre>{html.escape(text)}</pre>'
target.write_text(f'<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title></head><body>{body}</body></html>',encoding='utf-8')
print(target)
PY

printf '%s\n' "$OUT_FILE"
printf '%s\n' "${PATHS[@]:-}" | sed '/^$/d'
if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then "$BROWSER_CMD" "$OUT_FILE"; fi
open_local_paths
