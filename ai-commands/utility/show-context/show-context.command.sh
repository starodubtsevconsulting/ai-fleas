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
    --project-dir)
      AI_FLOW_PROJECT_DIR="${2:-}"
      shift 2
      ;;
    --project)
      PROJECT_LABEL="${2:-}"
      shift 2
      ;;
    --output-dir)
      AI_FLOW_OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --template)
      REPORT_TEMPLATE="${2:-}"
      shift 2
      ;;
    --file)
      if [[ "$MODE" == "rule-review" ]]; then
        RULE_REVIEW_FILES+=("${2:-}")
      else
        CONTEXT_FILE="${2:-}"
      fi
      shift 2
      ;;
    --feature)
      FEATURE_QUERY="${2:-}"
      shift 2
      ;;
    --section)
      SECTION="${2:-}"
      shift 2
      ;;
    --title)
      TITLE="${2:-}"
      shift 2
      ;;
    --request)
      REQUEST_TEXT="${2:-}"
      shift 2
      ;;
    --result)
      RESULT_TEXT="${2:-}"
      shift 2
      ;;
    --url)
      URLS+=("${2:-}")
      shift 2
      ;;
    --path)
      PATHS+=("${2:-}")
      shift 2
      ;;
    --see)
      SEE_MODE="true"
      if [[ $# -gt 1 && "${2:-}" != --* ]]; then
        SEE_INPUT="${2:-}"
        shift 2
      else
        SEE_INPUT="latest"
        shift
      fi
      ;;
    --see-dir)
      SEE_DIR="${2:-}"
      shift 2
      ;;
    --meetings-dir)
      MEETINGS_CONTEXT_DIR="${2:-}"
      shift 2
      ;;
    --open-links)
      OPEN_LINKS="true"
      shift
      ;;
    --no-open)
      OPEN_BROWSER="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR

build_rule_review_report() {
  local output_root report_file
  if [[ ${#RULE_REVIEW_FILES[@]} -eq 0 ]]; then
    echo "The md-rules-changed template requires at least one --file <markdown-rule>." >&2
    exit 2
  fi
  if [[ -n "$FEATURE_QUERY" || ${#URLS[@]} -gt 0 || "$SEE_MODE" == "true" || -n "$SECTION" ]]; then
    echo "The md-rules-changed template accepts only rule files and report presentation options." >&2
    exit 2
  fi
  output_root="$(output_root)"
  mkdir -p "$output_root"
  report_file="$output_root/$(date -u +"%Y%m%dT%H%M%SZ")-rule-review.md"
  command_python - "$ROOT_DIR" "$report_file" "$TITLE" "$REQUEST_TEXT" "$RESULT_TEXT" \
    "${RULE_REVIEW_FILES[@]}" <<'RULEREVIEWPY'
import re
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1]).resolve()
target = Path(sys.argv[2])
title = sys.argv[3].strip() or "Markdown rule review"
request = sys.argv[4].strip() or "Review the exact current Markdown rules and their changes."
result = sys.argv[5].strip()
files = [Path(value).expanduser().resolve() for value in sys.argv[6:]]

sections = []
review_items = []
for source in files:
    if not source.is_file():
        raise SystemExit(f"Rule file not found: {source}")
    if source.suffix.lower() not in {".md", ".markdown", ".mdown"}:
        raise SystemExit(f"The md-rules-changed template accepts Markdown files only: {source}")
    try:
        relative = source.relative_to(repo)
        tracked = subprocess.run(
            ["git", "-C", str(repo), "ls-files", "--error-unmatch", "--", str(relative)],
            text=True,
            capture_output=True,
            check=False,
        ).returncode == 0
        if tracked:
            diff = subprocess.run(
                ["git", "-C", str(repo), "diff", "--no-ext-diff", "HEAD", "--", str(relative)],
                text=True,
                capture_output=True,
                check=False,
            )
            valid_return_codes = {0}
        else:
            diff = subprocess.run(
                ["git", "-C", str(repo), "diff", "--no-ext-diff", "--no-index", "--", "/dev/null", str(source)],
                text=True,
                capture_output=True,
                check=False,
            )
            valid_return_codes = {0, 1}
        if diff.returncode not in valid_return_codes:
            raise SystemExit(diff.stderr.strip() or f"Unable to read diff for {source}")
        diff_text = diff.stdout.rstrip() or "No Git diff against HEAD for this file."
    except ValueError:
        relative = source
        diff_text = "Git diff unavailable because this file is outside the repository."
    current = source.read_text(encoding="utf-8", errors="replace").rstrip()
    diagrams = re.findall(r"^```mermaid\s*\n([\s\S]*?)^```\s*$", current, flags=re.MULTILINE)
    if diagrams:
        rendered_diagrams = "\n\n".join(
            f"##### Diagram {index}\n\n```mermaid\n{diagram.rstrip()}\n```"
            for index, diagram in enumerate(diagrams, start=1)
        )
    else:
        rendered_diagrams = "No Mermaid diagrams are declared in this Markdown file."
    sections.append(
        f"### `{relative}`\n\n"
        f"#### Exact current Markdown\n\n````markdown\n{current}\n````\n\n"
        f"#### Rendered diagrams\n\n{rendered_diagrams}\n\n"
        f"#### Working-tree diff against HEAD\n\n```diff\n{diff_text}\n```"
    )
    review_items.extend(
        [
            f"- [ ] `{relative}` — exact current Markdown reviewed",
            f"- [ ] `{relative}` — every rendered diagram preview reviewed",
            f"- [ ] `{relative}` — complete diff against `HEAD` reviewed",
        ]
    )

result_section = f"\n\n## Result\n\n{result}" if result else ""
document = f"""# {title}

```mermaid
flowchart TD
  Actor["Actor: human reviews modified Markdown rules"]
  Actor --> Current["Read exact current Markdown with highlighting"]
  Current --> Diff["Inspect additions and removals in the Git diff"]
  Diff --> Decision{{"Decision: rule content and consequences are acceptable?"}}
  Decision -->|Allowed| Outcome["Outcome: human may continue the governance approval process"]
  Decision -->|Prohibited| Blocked["BLOCKED: correct the rule and regenerate this report"]
  Blocked --> Current
```

## Diagram description

The diagram begins with the human reviewing the exact modified rule source. The human then compares the working-tree
diff, decides whether the rule content and consequences are acceptable, and either continues the governance approval
process or follows the blocked branch to correct the rule and regenerate this report.

## What this review does

{request}

## Modified Markdown rules

{chr(10).join(sections)}{result_section}

## Human review

{chr(10).join(review_items)}

Review every item above. Merely opening or displaying this report does not prove review. After inspecting every exact source
block, rendered diagram preview, and diff, the human explicitly confirms completion or identifies the required correction.
This report does not authorize commit, push, reload, or activation.
"""
target.write_text(document, encoding="utf-8")
print(target)
RULEREVIEWPY
  CONTEXT_FILE="$report_file"
}

registry_context_lines() {
  local label="$1"
  command_python - "$PROJECTS_REGISTRY" "$label" "$ROOT_DIR" <<'PROJECTPY'
import re
import sys
from pathlib import Path
from urllib.parse import quote

registry = Path(sys.argv[1])
selected_label = sys.argv[2]
ai_root = Path(sys.argv[3])
workspace_root = ai_root.parent
if not registry.is_file():
    raise SystemExit("AI_PROFILE_PROJECT_FILE is required")
selected = {}
for raw in registry.read_text(encoding="utf-8", errors="replace").splitlines():
    if raw.startswith(" ") or ":" not in raw or raw.lstrip().startswith("#"):
        continue
    key, value = raw.split(":", 1)
    selected[key.strip()] = value.strip().strip('"')
if selected_label not in {selected.get("id"), selected.get("label")}:
    raise SystemExit(f"Selected profile project does not match: {selected_label}")

def resolve(path_value):
    if not path_value or path_value == "N/A":
        return None
    path = Path(path_value)
    if not path.is_absolute():
        path = workspace_root / path_value
    return path

primary = resolve(selected.get("repo_path"))
if not primary:
    raise SystemExit(f"Project label has no repo_path: {selected_label}")
print(f"primary\t{selected_label}\t{primary}")

PROJECTPY
}

load_registry_context() {
  local label="$1"
  local kind item_label item_path
  while IFS=$'\t' read -r kind item_label item_path; do
    case "$kind" in
      primary)
        AI_FLOW_PROJECT_DIR="$item_path"
        PROJECT_LABEL="$item_label"
        ;;
      related)
        RELATED_PROJECT_LABELS+=("$item_label")
        RELATED_PROJECT_DIRS+=("$item_path")
        ;;
    esac
  done < <(registry_context_lines "$label")
  export AI_FLOW_PROJECT_DIR
}

load_meetings_context() {
  if [[ -z "$MEETINGS_CONTEXT_DIR" || ! -d "$MEETINGS_CONTEXT_DIR" ]]; then
    return 0
  fi
  local ready_dir indexed_dir
  indexed_dir="$MEETINGS_CONTEXT_DIR/indexed"
  if [[ -d "$indexed_dir" ]]; then
    while IFS= read -r -d '' ready_dir; do
      SESSION_CONTEXT_DIRS+=("$ready_dir")
    done < <(find "$indexed_dir" -mindepth 1 -maxdepth 2 -type d -print0 2>/dev/null | sort -z)
  fi
  while IFS= read -r -d '' ready_dir; do
    SESSION_CONTEXT_DIRS+=("$ready_dir")
  done < <(find "$MEETINGS_CONTEXT_DIR" -mindepth 1 -maxdepth 2 -type d -name '*-feature' -not -path "$indexed_dir/*" -print0 2>/dev/null | sort -z)
}

resolve_project_context() {
  if [[ -n "$AI_FLOW_PROJECT_DIR" && -z "$PROJECT_LABEL" ]]; then
    return 0
  fi
  if [[ -n "$PROJECT_LABEL" ]]; then
    load_registry_context "$PROJECT_LABEL"
    return 0
  fi
  if [[ -f "$CURRENT_SESSION_PATH_FILE" ]]; then
    local session_dir session_json session_project_label session_project_dir
    session_dir="$(sed -n '1p' "$CURRENT_SESSION_PATH_FILE" 2>/dev/null || true)"
    session_json="$session_dir/session.json"
    if [[ -f "$session_json" ]]; then
      session_project_label="$(node -e 'const s=require(process.argv[1]); const p=s.scope.projects.find((v)=>v.projectId===s.scope.primaryProjectId)||s.scope.projects[0]; process.stdout.write(p?.label||"")' "$session_json")"
      session_project_dir="$(node -e 'const s=require(process.argv[1]); const p=s.scope.projects.find((v)=>v.projectId===s.scope.primaryProjectId)||s.scope.projects[0]; process.stdout.write(p?.directory||"")' "$session_json")"
      if [[ -d "$session_dir/discussions" ]]; then
        SESSION_CONTEXT_DIRS+=("$session_dir/discussions")
      fi
      if [[ -n "$session_project_label" ]]; then
        load_registry_context "$session_project_label"
      elif [[ -n "$session_project_dir" ]]; then
        AI_FLOW_PROJECT_DIR="$session_project_dir"
        export AI_FLOW_PROJECT_DIR
      fi
    fi
  fi
}

resolve_project_context
load_meetings_context

open_local_paths() {
  if [[ ${#PATHS[@]} -eq 0 || "$OPEN_BROWSER" != "true" ]]; then
    return 0
  fi
  local path target opener
  for path in "${PATHS[@]}"; do
    [[ -z "$path" ]] && continue
    if [[ -e "$path" ]]; then
      if [[ -d "$path" ]]; then target="$path"; else target="$(dirname "$path")"; fi
    else
      echo "Local context path not found: $path" >&2
      continue
    fi
    if command -v gio >/dev/null 2>&1; then gio open "$target" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$target" >/dev/null 2>&1 || true
    elif command -v nautilus >/dev/null 2>&1; then nautilus "$target" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then open "$target" >/dev/null 2>&1 || true
    else echo "No file manager opener found for: $target" >&2
    fi
  done
}

ensure_pygments() {
  if command_python - <<'PYCHECK' >/dev/null 2>&1
import importlib.util
raise SystemExit(0 if importlib.util.find_spec("pygments") else 1)
PYCHECK
  then return 0; fi
  echo "Pygments is not installed; using built-in code colors and diff markers." >&2
  return 0
}

output_root() {
  if [[ -n "$AI_FLOW_OUTPUT_DIR" ]]; then
    if [[ "${AI_FLOW_OUTPUT_DIR%/}" == */.ai ]]; then printf '%s\n' "${AI_FLOW_OUTPUT_DIR%/}/tmp/show-context"; else printf '%s\n' "$AI_FLOW_OUTPUT_DIR"; fi
  else printf '%s\n' "$ROOT_DIR/.ai/tmp/show-context"; fi
}

render_see_context() {
  local output_root out_file
  if [[ ! -d "$SEE_DIR" ]]; then echo "See context directory not found: $SEE_DIR" >&2; exit 1; fi
  output_root="$(output_root)"
  mkdir -p "$output_root"
  out_file="$output_root/$(date -u +"%Y%m%dT%H%M%SZ")-see-context.html"
  command_python - "$SEE_DIR" "$SEE_INPUT" "$out_file" <<'SEEPY'
import fnmatch, html, mimetypes, sys
from pathlib import Path
from urllib.parse import quote
see_dir=Path(sys.argv[1]).expanduser().resolve(); query=(sys.argv[2] or "latest").strip(); target=Path(sys.argv[3])
files=sorted([p for p in see_dir.iterdir() if p.is_file()],key=lambda p:p.stat().st_mtime,reverse=True)
if not files: raise SystemExit(f"No files found in {see_dir}")
if query.lower() in {"","latest"}: selected=files[:1]
elif query.lower()=="all": selected=files
else:
    selected=[p for p in files if p.name==query or fnmatch.fnmatch(p.name,query)]
    if not selected: selected=[p for p in files if query.lower() in p.name.lower()]
if not selected: raise SystemExit(f"No matching files in {see_dir}: {query}")
def file_url(path): return "file://"+quote(str(path))
def card(path):
    mime=mimetypes.guess_type(path.name)[0] or "application/octet-stream"; url=file_url(path); safe=html.escape(url,quote=True)
    preview=f'<a href="{safe}"><img src="{safe}" alt="{html.escape(path.name,quote=True)}"></a>' if mime.startswith("image/") else f'<a class="file-link" href="{safe}">Open file</a>'
    return f'<section class="item"><h2>{html.escape(path.name)}</h2>{preview}<div class="path">{html.escape(str(path))}</div></section>'
cards="".join(card(p) for p in selected)
target.write_text(f'<!doctype html><html><head><meta charset="utf-8"><title>See Context</title></head><body><main><h1>See Context</h1>{cards}</main></body></html>',encoding="utf-8")
print(target)
SEEPY
  printf '%s\n' "$SEE_DIR"
  if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then "$BROWSER_CMD" "$out_file"; fi
}

resolve_feature_file() {
  if [[ -z "$FEATURE_QUERY" ]]; then return 0; fi
  if [[ -n "$CONTEXT_FILE" ]]; then echo "Use either --feature or --file, not both." >&2; exit 1; fi
  if [[ -z "$AI_FLOW_PROJECT_DIR" ]]; then echo "--feature requires a project context. Pass --project <label> / --project-dir <path>, or ensure the active session has PROJECT_DIR." >&2; exit 1; fi
  CONTEXT_FILE="$(command_python - "$FEATURE_QUERY" "$AI_FLOW_PROJECT_DIR" "${RELATED_PROJECT_DIRS[@]}" "${SESSION_CONTEXT_DIRS[@]}" <<'FEATUREPY'
import re, sys
from pathlib import Path
query=sys.argv[1].strip().lower(); roots=[]
for idx,arg in enumerate(sys.argv[2:]):
    path=Path(arg)
    if path.exists() and path.is_dir() and path not in [root for root,_ in roots]: roots.append((path,idx))
terms=[t for t in re.split(r"[^a-z0-9]+",query) if t]; variants=set(terms)
for term in list(terms):
    if term.endswith("s") and len(term)>3: variants.add(term[:-1])
def candidate_files(root,root_index):
    candidates=set(root.glob("**/*-feature.md")); doc_root=root/"documentation"; candidates.update(doc_root.glob("**/*.md")); return sorted(p for p in candidates if p.is_file())
docs=[]
for root,root_index in roots: docs.extend((root,root_index,p) for p in candidate_files(root,root_index))
if not docs: raise SystemExit("No feature docs or related project context files found")
best=[]
for root,root_index,doc in docs:
    text=doc.read_text(encoding="utf-8",errors="replace").lower(); score=sum(8 for term in variants if term in str(doc).lower())+sum(1 for term in variants if term in text); best.append((score,str(doc)))
best.sort(key=lambda item:(-item[0],item[1]))
if best[0][0]<1: raise SystemExit(f"No strong feature/context match found for query: {query}")
print(best[0][1])
FEATUREPY
)"
  echo "Feature context: $CONTEXT_FILE"
}

if [[ "$MODE" == "rule-review" ]]; then build_rule_review_report; fi
resolve_feature_file

if [[ "$SEE_MODE" == "true" ]]; then render_see_context; exit 0; fi

if [[ ${#URLS[@]} -gt 0 ]]; then
  if [[ -n "$CONTEXT_FILE" ]]; then echo "Use either --url or --file/--feature, not both." >&2; exit 1; fi
  printf '%s\n' "${URLS[@]}"
  printf '%s\n' "${PATHS[@]:-}" | sed '/^$/d'
  if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then "$BROWSER_CMD" "${URLS[@]}"; fi
  open_local_paths
  exit 0
fi

if [[ -z "$CONTEXT_FILE" && ${#PATHS[@]} -gt 0 ]]; then
  printf '%s\n' "${PATHS[@]}"
  open_local_paths
  exit 0
fi

if [[ -z "$CONTEXT_FILE" ]]; then usage >&2; exit 1; fi
if [[ ! -f "$CONTEXT_FILE" ]]; then echo "Context file not found: $CONTEXT_FILE" >&2; exit 1; fi

OUTPUT_ROOT="$(output_root)"
mkdir -p "$OUTPUT_ROOT"
OUT_FILE="$OUTPUT_ROOT/$(date -u +"%Y%m%dT%H%M%SZ")-$(basename "$CONTEXT_FILE" | tr -c 'A-Za-z0-9._-' '-').html"
LINKS_FILE="$OUT_FILE.links"
ensure_pygments

command_python - "$CONTEXT_FILE" "$OUT_FILE" "$SECTION" "$TITLE" "$LINKS_FILE" "$REQUEST_TEXT" "$RESULT_TEXT" \
  "$ROOT_DIR/node_modules/mermaid/dist/mermaid.min.js" <<'INNERPY'
import html, re, sys
from pathlib import Path
from urllib.parse import quote
source=Path(sys.argv[1]); target=Path(sys.argv[2]); section=sys.argv[3].strip(); title_arg=sys.argv[4].strip(); links_target=Path(sys.argv[5]); request_text=sys.argv[6].strip(); result_text=sys.argv[7].strip(); mermaid_asset=Path(sys.argv[8])
lines=source.read_text(encoding="utf-8",errors="replace").splitlines()
def heading(line):
    m=re.match(r"^(#{1,6})\s+(.+?)\s*$",line); return (len(m.group(1)),m.group(2).strip()) if m else None
def slug(value): return re.sub(r"[^a-z0-9]+","-",value.lower()).strip("-") or "section"
def norm(value): return re.sub(r"\s+"," ",re.sub(r"[#`*_]+","",value).strip()).lower()
selected=lines; selected_heading=""
if section:
    wanted=norm(section); start=None; level=None
    for idx,line in enumerate(lines):
        parsed=heading(line)
        if parsed and norm(parsed[1])==wanted: start=idx; level=parsed[0]; selected_heading=parsed[1]; break
    if start is None: raise SystemExit(f"Section not found: {section}")
    end=len(lines)
    for idx in range(start+1,len(lines)):
        parsed=heading(lines[idx])
        if parsed and parsed[0]<=level: end=idx; break
    selected=lines[start:end]
page_title=title_arg or selected_heading or source.name
def file_url(path): return "file://"+quote(str(path.resolve()))
def inline_md(text):
    escaped=html.escape(text); escaped=re.sub(r"`([^`]+)`",r"<code>\1</code>",escaped); escaped=re.sub(r"\*\*([^*]+)\*\*",r"<strong>\1</strong>",escaped); return escaped
body=[]
for line in selected:
    parsed=heading(line)
    if parsed:
        level,text=parsed; body.append(f'<h{level} id="{slug(text)}">{inline_md(text)}</h{level}>')
    elif line.strip(): body.append("<p>"+inline_md(line)+"</p>")
    else: body.append("")
section_meta=f"<div><strong>Section:</strong> {html.escape(selected_heading or section)}</div>" if section else ""
request_meta=f"<div><strong>You asked:</strong> {inline_md(request_text)}</div>" if request_text else ""
result_meta=f"<div><strong>Result:</strong> {inline_md(result_text)}</div>" if result_text else ""
document=f'<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(page_title)}</title></head><body><main><div class="meta">{request_meta}{result_meta}<div><strong>Source:</strong> <a href="{html.escape(file_url(source),quote=True)}">{html.escape(str(source))}</a></div>{section_meta}</div>{chr(10).join(body)}</main></body></html>'
target.write_text(document,encoding="utf-8")
links=[]
for raw in selected:
    for match in re.findall(r"https?://[^\s)\]\"']+",raw):
        cleaned=match.rstrip(".,;:")
        if cleaned not in links: links.append(cleaned)
links_target.write_text("\n".join(links)+("\n" if links else ""),encoding="utf-8")
INNERPY

printf '%s\n' "$OUT_FILE"
printf '%s\n' "${PATHS[@]:-}" | sed '/^$/d'
if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then
  if [[ "$OPEN_LINKS" == "true" && -s "$LINKS_FILE" ]]; then
    mapfile -t CONTEXT_LINKS < "$LINKS_FILE"
    "$BROWSER_CMD" "$OUT_FILE" "${CONTEXT_LINKS[@]}"
  else
    "$BROWSER_CMD" "$OUT_FILE"
  fi
fi
open_local_paths
