#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT_DIR/ai-config}"
source "$SCRIPT_DIR/../runtime-paths.sh"
BROWSER_CMD="$ROOT_DIR/ai-commands/browser/browser.command.sh"
PYTHON_INSTALLER=""
NODE_INSTALLER=""
PROJECTS_REGISTRY="${SHOW_CONTEXT_PROJECTS_REGISTRY:-$ROOT_DIR/ai-commands/projects/projects-registry.example.yml}"
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
projects = []
current = None
current_list = None

for raw in registry.read_text(encoding="utf-8", errors="replace").splitlines():
    if raw.startswith("  - label: "):
        current = {"label": raw.split(": ", 1)[1].strip()}
        projects.append(current)
        current_list = None
        continue
    if current is None:
        continue
    m = re.match(r"^    ([A-Za-z0-9_]+):(.*)$", raw)
    if m:
        key = m.group(1)
        value = m.group(2).strip()
        if value:
            current[key] = value.strip('"')
            current_list = None
        else:
            current[key] = []
            current_list = key
        continue
    if current_list and raw.startswith("      - "):
        current[current_list].append(raw.split("- ", 1)[1].strip())

by_label = {project.get("label"): project for project in projects}
selected = by_label.get(selected_label)
if not selected:
    raise SystemExit(f"Project label not found: {selected_label}")

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

related = []
for key in ("related_project_labels", "frontend_project_labels", "ui_project_labels", "source_project_labels"):
    value = selected.get(key, [])
    if isinstance(value, str):
        value = [value]
    related.extend(value)
for key in ("frontend_project_label", "ui_project_label", "source_project_label"):
    value = selected.get(key)
    if isinstance(value, str):
        related.append(value)

# Reverse lookup: a shared UI project can declare the backend projects it serves
# once, instead of requiring every backend entry to duplicate the relationship.
for project in projects:
    served = project.get("serves_project_labels", [])
    if isinstance(served, str):
        served = [served]
    if selected_label in served and project.get("label"):
        related.append(project["label"])

seen = set()
for related_label in related:
    if not related_label or related_label in seen:
        continue
    seen.add(related_label)
    related_project = by_label.get(related_label)
    if not related_project:
        continue
    related_path = resolve(related_project.get("repo_path"))
    if related_path:
        print(f"related\t{related_label}\t{related_path}")
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
      if [[ -d "$path" ]]; then
        target="$path"
      else
        target="$(dirname "$path")"
      fi
    else
      echo "Local context path not found: $path" >&2
      continue
    fi
    if command -v gio >/dev/null 2>&1; then
      gio open "$target" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$target" >/dev/null 2>&1 || true
    elif command -v nautilus >/dev/null 2>&1; then
      nautilus "$target" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then
      open "$target" >/dev/null 2>&1 || true
    else
      echo "No file manager opener found for: $target" >&2
    fi
  done
}


ensure_pygments() {
  if command_python - <<'PYCHECK' >/dev/null 2>&1
import importlib.util
raise SystemExit(0 if importlib.util.find_spec("pygments") else 1)
PYCHECK
  then
    return 0
  fi
  echo "Pygments is not installed; using built-in code colors and diff markers." >&2
  return 0
}

output_root() {
  if [[ -n "$AI_FLOW_OUTPUT_DIR" ]]; then
    if [[ "${AI_FLOW_OUTPUT_DIR%/}" == */.ai ]]; then
      printf '%s
' "${AI_FLOW_OUTPUT_DIR%/}/tmp/show-context"
    else
      printf '%s
' "$AI_FLOW_OUTPUT_DIR"
    fi
  else
    printf '%s
' "$ROOT_DIR/.ai/tmp/show-context"
  fi
}
render_see_context() {
  local output_root out_file
  if [[ ! -d "$SEE_DIR" ]]; then
    echo "See context directory not found: $SEE_DIR" >&2
    exit 1
  fi
  output_root="$(output_root)"
  mkdir -p "$output_root"
  out_file="$output_root/$(date -u +"%Y%m%dT%H%M%SZ")-see-context.html"
  command_python - "$SEE_DIR" "$SEE_INPUT" "$out_file" <<'SEEPY'
import fnmatch
import html
import mimetypes
import sys
from pathlib import Path
from urllib.parse import quote

see_dir = Path(sys.argv[1]).expanduser().resolve()
query = (sys.argv[2] or "latest").strip()
target = Path(sys.argv[3])
files = sorted([p for p in see_dir.iterdir() if p.is_file()], key=lambda p: p.stat().st_mtime, reverse=True)
if not files:
    raise SystemExit(f"No files found in {see_dir}")
if query.lower() in {"", "latest"}:
    selected = files[:1]
elif query.lower() == "all":
    selected = files
else:
    selected = [p for p in files if p.name == query or fnmatch.fnmatch(p.name, query)]
    if not selected:
        lowered = query.lower()
        selected = [p for p in files if lowered in p.name.lower()]
if not selected:
    raise SystemExit(f"No matching files in {see_dir}: {query}")

def file_url(path):
    return "file://" + quote(str(path))

def card(path):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    url = file_url(path)
    meta = f"{path.name} - {mime} - {path.stat().st_size:,} bytes"
    safe_url = html.escape(url, quote=True)
    if mime.startswith("image/"):
        preview = f'<a href="{safe_url}"><img src="{safe_url}" alt="{html.escape(path.name, quote=True)}"></a>'
    else:
        preview = f'<a class="file-link" href="{safe_url}">Open file</a>'
    return """<section class="item">
      <h2>{name}</h2>
      <div class="meta-line">{meta}</div>
      {preview}
      <div class="path">{path}</div>
    </section>""".format(name=html.escape(path.name), meta=html.escape(meta), preview=preview, path=html.escape(str(path)))

cards = "".join(card(path) for path in selected)
document = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>See Context</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f8fa; color: #1f2933; }}
    main {{ max-width: 1200px; margin: 0 auto; padding: 28px 24px 56px; background: #fff; min-height: 100vh; }}
    h1 {{ margin: 0 0 4px; }}
    h2 {{ margin: 0 0 6px; font-size: 18px; }}
    .intro {{ color: #5b6675; border-bottom: 1px solid #d9dee7; padding-bottom: 16px; margin-bottom: 20px; }}
    .item {{ border: 1px solid #d9dee7; border-radius: 6px; padding: 16px; margin: 16px 0; background: #fbfcfe; }}
    .meta-line, .path {{ color: #5b6675; font-size: 13px; overflow-wrap: anywhere; }}
    .path {{ margin-top: 10px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }}
    img {{ display: block; max-width: 100%; height: auto; margin-top: 12px; border: 1px solid #d9dee7; border-radius: 4px; }}
    .file-link {{ display: inline-block; margin-top: 12px; color: #0b5cad; font-weight: 600; }}
    a {{ color: #0b5cad; }}
  </style>
</head>
<body>
<main>
  <h1>See Context</h1>
  <div class="intro">Source folder: {see_dir}<br>Query: {query}<br>Files shown: {count}</div>
  {cards}
</main>
</body>
</html>
""".format(see_dir=html.escape(str(see_dir)), query=html.escape(query), count=len(selected), cards=cards)
target.write_text(document, encoding="utf-8")
print(target)
SEEPY
  printf '%s\n' "$SEE_DIR"
  if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then
    "$BROWSER_CMD" "$out_file"
  fi
}

resolve_feature_file() {
  if [[ -z "$FEATURE_QUERY" ]]; then
    return 0
  fi
  if [[ -n "$CONTEXT_FILE" ]]; then
    echo "Use either --feature or --file, not both." >&2
    exit 1
  fi
  if [[ -z "$AI_FLOW_PROJECT_DIR" ]]; then
    echo "--feature requires a project context. Pass --project <label> / --project-dir <path>, or ensure the active session has PROJECT_DIR." >&2
    exit 1
  fi
  CONTEXT_FILE="$(command_python - "$FEATURE_QUERY" "$AI_FLOW_PROJECT_DIR" "${RELATED_PROJECT_DIRS[@]}" "${SESSION_CONTEXT_DIRS[@]}" <<'FEATUREPY'
import re
import sys
from pathlib import Path
query = sys.argv[1].strip().lower()
roots = []
for idx, arg in enumerate(sys.argv[2:]):
    path = Path(arg)
    if path.exists() and path.is_dir() and path not in [root for root, _ in roots]:
        roots.append((path, idx))
terms = [t for t in re.split(r"[^a-z0-9]+", query) if t]
variants = set(terms)
for term in list(terms):
    if term.endswith("s") and len(term) > 3:
        variants.add(term[:-1])

def candidate_files(root, root_index):
    candidates = set()
    candidates.update(root.glob("**/*-feature.md"))
    doc_root = root / "documentation"
    candidates.update(doc_root.glob("*-feature.md"))
    candidates.update(doc_root.glob("**/*-feature.md"))
    candidates.update(doc_root.glob("feature/*.md"))
    candidates.update(doc_root.glob("**/README.md"))
    candidates.update(doc_root.glob("**/*.md"))
    if root_index > 0:
        for source_root in (root / "app" / "src", root / "src"):
            if source_root.exists():
                for pattern in ("**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"):
                    candidates.update(source_root.glob(pattern))
    return sorted(p for p in candidates if p.is_file() and "node_modules" not in p.parts and "dist" not in p.parts and "build" not in p.parts)

docs = []
for root, root_index in roots:
    docs.extend((root, root_index, p) for p in candidate_files(root, root_index))
if not docs:
    raise SystemExit("No feature docs or related project context files found")

def heading_title(text):
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip().lower()
    return ""

def has_show_context(text):
    for line in text.splitlines():
        m = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if m and re.sub(r"\s+", " ", m.group(2).strip()).lower() == "show context":
            return True
    return False

best = []
for root, root_index, doc in docs:
    text = doc.read_text(encoding="utf-8", errors="replace")
    filename = doc.name.lower()
    rel = str(doc.relative_to(root)).lower()
    title = heading_title(text)
    body = text.lower()
    score = 0
    for term in variants:
        if term in filename:
            score += 12
        if term in rel:
            score += 8
        if term in title:
            score += 7
        if re.search(rf"\b{re.escape(term)}\b", body):
            score += 1
    if query and query in title:
        score += 10
    if query and query in filename:
        score += 10
    if filename.endswith("-feature.md"):
        score += 6
    if doc.suffix.lower() == ".md":
        score += 2
    if root_index == 0:
        score += 2
    if has_show_context(text):
        score += 2
    best.append((score, str(doc)))
best.sort(key=lambda item: (-item[0], item[1]))
if best[0][0] < 5:
    raise SystemExit(f"No strong feature/context match found for query: {query}")
print(best[0][1])
FEATUREPY
)"
  echo "Feature context: $CONTEXT_FILE"
  if [[ -z "$SECTION" ]]; then
    if command_python - "$CONTEXT_FILE" <<'SECTIONPY'
import re
import sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    m = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
    if m and re.sub(r"\s+", " ", m.group(2).strip()).lower() == "show context":
        raise SystemExit(0)
raise SystemExit(1)
SECTIONPY
    then
      SECTION="Show Context"
    fi
  fi
}

if [[ "$MODE" == "rule-review" ]]; then
  build_rule_review_report
fi

resolve_feature_file

if [[ "$SEE_MODE" == "true" ]]; then
  render_see_context
  exit 0
fi

if [[ ${#URLS[@]} -gt 0 ]]; then
  if [[ -n "$CONTEXT_FILE" ]]; then
    echo "Use either --url or --file/--feature, not both." >&2
    exit 1
  fi
  printf '%s\n' "${URLS[@]}"
  printf '%s\n' "${PATHS[@]:-}" | sed '/^$/d'
  if [[ "$OPEN_BROWSER" == "true" && -x "$BROWSER_CMD" ]]; then
    "$BROWSER_CMD" "${URLS[@]}"
  fi
  open_local_paths
  exit 0
fi

if [[ -z "$CONTEXT_FILE" && ${#PATHS[@]} -gt 0 ]]; then
  printf '%s\n' "${PATHS[@]}"
  open_local_paths
  exit 0
fi

if [[ -z "$CONTEXT_FILE" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Context file not found: $CONTEXT_FILE" >&2
  exit 1
fi

OUTPUT_ROOT="$(output_root)"
mkdir -p "$OUTPUT_ROOT"

OUT_FILE="$OUTPUT_ROOT/$(date -u +"%Y%m%dT%H%M%SZ")-$(basename "$CONTEXT_FILE" | tr -c 'A-Za-z0-9._-' '-').html"

LINKS_FILE="$OUT_FILE.links"

ensure_pygments

command_python - "$CONTEXT_FILE" "$OUT_FILE" "$SECTION" "$TITLE" "$LINKS_FILE" "$REQUEST_TEXT" "$RESULT_TEXT" \
  "$ROOT_DIR/node_modules/mermaid/dist/mermaid.min.js" <<'INNERPY'
import html
import re
import sys
from pathlib import Path
from urllib.parse import quote

source = Path(sys.argv[1])
target = Path(sys.argv[2])
section = sys.argv[3].strip()
title_arg = sys.argv[4].strip()
links_target = Path(sys.argv[5])
request_text = sys.argv[6].strip()
result_text = sys.argv[7].strip()
mermaid_asset = Path(sys.argv[8])

try:
    from pygments import highlight as pygments_highlight
    from pygments.formatters import HtmlFormatter
    from pygments.lexers import TextLexer, get_lexer_by_name, guess_lexer_for_filename
    PYGMENTS_AVAILABLE = True
except Exception:
    HtmlFormatter = None
    TextLexer = None
    PYGMENTS_AVAILABLE = False

lines = source.read_text(encoding="utf-8", errors="replace").splitlines()

def heading(line):
    match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
    if not match:
        return None
    return len(match.group(1)), match.group(2).strip()

def slug(value):
    value = value.lower()
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "section"

def norm(value):
    return re.sub(r"\s+", " ", re.sub(r"[#`*_]+", "", value).strip()).lower()

selected = lines
selected_heading = ""
if section:
    wanted = norm(section)
    start = None
    level = None
    for idx, line in enumerate(lines):
        parsed = heading(line)
        if parsed and norm(parsed[1]) == wanted:
            start = idx
            level = parsed[0]
            selected_heading = parsed[1]
            break
    if start is None:
        raise SystemExit(f"Section not found: {section}")
    end = len(lines)
    for idx in range(start + 1, len(lines)):
        parsed = heading(lines[idx])
        if parsed and parsed[0] <= level:
            end = idx
            break
    selected = lines[start:end]

page_title = title_arg or selected_heading or source.name

code_language_by_suffix = {
    ".bash": "bash",
    ".c": "c",
    ".conf": "ini",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".css": "css",
    ".diff": "diff",
    ".go": "go",
    ".gradle": "gradle",
    ".groovy": "groovy",
    ".h": "c",
    ".hpp": "cpp",
    ".html": "xml",
    ".java": "java",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "javascript",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".log": "plaintext",
    ".mjs": "javascript",
    ".properties": "properties",
    ".proto": "protobuf",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".scala": "scala",
    ".sh": "bash",
    ".smithy": "plaintext",
    ".sql": "sql",
    ".toml": "toml",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".txt": "plaintext",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".zsh": "bash",
}
markdown_suffixes = {".md", ".markdown", ".mdown"}
code_language_aliases = {
    "c++": "cpp",
    "c#": "csharp",
    "console": "plaintext",
    "js": "javascript",
    "md": "markdown",
    "shell": "bash",
    "sh": "bash",
    "text": "plaintext",
    "ts": "typescript",
    "yml": "yaml",
    "zsh": "bash",
}


def normalize_code_language(value: str) -> str:
    stripped = (value or "").strip()
    if not stripped:
        return ""
    token = stripped.split(None, 1)[0].strip().lower()
    token = token.strip("{}[]()")
    token = re.sub(r"[^a-z0-9_+#.-]", "", token)
    return code_language_aliases.get(token, token)


source_code_language = ""
if source.suffix.lower() not in markdown_suffixes:
    source_code_language = code_language_by_suffix.get(source.suffix.lower(), "plaintext")

url_pattern = re.compile(r"https?://[^\s<>\")\]']+")

def file_url(path: Path) -> str:
    return "file://" + quote(str(path.resolve()))


def resolve_href(raw_href: str) -> str:
    href = html.unescape(raw_href).strip()
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", href) or href.startswith("#"):
        return href
    return file_url((source.parent / href).resolve())


def linkify_escaped(escaped):
    def replace(match):
        display = match.group(0)
        trailing = ""
        while display and display[-1] in ".,;:":
            trailing = display[-1] + trailing
            display = display[:-1]
        href = html.escape(html.unescape(display), quote=True)
        return f'<a href="{href}">{display}</a>{trailing}'
    return url_pattern.sub(replace, escaped)

def plain_code_html(text):
    return linkify_escaped(html.escape(text))


def pygments_css():
    if not PYGMENTS_AVAILABLE:
        return ""
    return HtmlFormatter(style="monokai").get_style_defs(".codehilite")


def pygments_code_html(text, language=""):
    if not PYGMENTS_AVAILABLE:
        return ""
    normalized = normalize_code_language(language)
    try:
        if normalized and normalized != "plaintext":
            lexer = get_lexer_by_name(normalized)
        else:
            lexer = guess_lexer_for_filename(source.name, text)
    except Exception:
        lexer = TextLexer()
    formatter = HtmlFormatter(nowrap=True, style="monokai")
    return pygments_highlight(text, lexer, formatter).rstrip("\n")


def fallback_syntax_html(text):
    escaped = html.escape(text)
    token_pattern = re.compile(
        r"(?P<comment>//[^\n]*|#[^\n]*)|"
        r"(?P<string>&quot;[^&]*&quot;|&#x27;[^&]*&#x27;|`[^`]*`)|"
        r"(?P<keyword>\b(?:async|await|class|const|def|else|export|for|from|function|if|import|in|interface|"
        r"let|new|null|private|public|return|static|string|true|false|type|undefined|void|while)\b)|"
        r"(?P<number>\b\d+(?:\.\d+)?\b)"
    )

    def replace(match):
        kind = match.lastgroup
        return f'<span class="code-{kind}">{match.group(0)}</span>'

    return token_pattern.sub(replace, escaped)


def highlight_code(text, language=""):
    highlighted = pygments_code_html(text, language)
    if highlighted:
        return highlighted
    if normalize_code_language(language) == "diff":
        highlighted_lines = []
        for line in text.splitlines():
            escaped = plain_code_html(line)
            if line.startswith("+") and not line.startswith("+++"):
                highlighted_lines.append(f'<span class="diff-added">{escaped}</span>')
            elif line.startswith("-") and not line.startswith("---"):
                highlighted_lines.append(f'<span class="diff-removed">{escaped}</span>')
            else:
                highlighted_lines.append(escaped)
        return "\n".join(highlighted_lines)
    return fallback_syntax_html(text)


def code_block_html(text, language=""):
    normalized = normalize_code_language(language)
    class_attr = f' class="language-{html.escape(normalized, quote=True)}"' if normalized else ""
    lang_label = f'<div class="code-language">{html.escape(normalized)}</div>' if normalized else ""
    fallback_attr = (
        ' data-show-context-fallback="true"'
        if not PYGMENTS_AVAILABLE and normalized == "diff"
        else ""
    )
    return f'<div class="code-frame">{lang_label}<pre class="code-block codehilite"><code{class_attr}{fallback_attr}>' + highlight_code(text, normalized) + '</code></pre></div>'


def render_mermaid_block(text):
    return (
        '<div class="diagram-block">'
        '<div class="mermaid">'
        + html.escape(text)
        + '</div>'
        '<details><summary>Diagram source</summary>'
        + code_block_html(text, "mermaid")
        + '</details>'
        '</div>'
    )


def inline_md(text):
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    def replace_md_link(match):
        label = match.group(1)
        href = html.escape(resolve_href(match.group(2)), quote=True)
        return f'<a href="{href}">{label}</a>'
    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace_md_link, escaped)
    if '<a href="' not in escaped:
        escaped = linkify_escaped(escaped)
    return escaped

def render_table(table_lines):
    rows = []
    for raw in table_lines:
        cells = [cell.strip() for cell in raw.strip().strip("|").split("|")]
        rows.append(cells)
    if len(rows) < 2:
        return "".join(f"<p>{inline_md(line)}</p>" for line in table_lines)
    html_rows = ["<table>"]
    html_rows.append("<thead><tr>" + "".join(f"<th>{inline_md(c)}</th>" for c in rows[0]) + "</tr></thead>")
    html_rows.append("<tbody>")
    for row in rows[2:]:
        html_rows.append("<tr>" + "".join(f"<td>{inline_md(c)}</td>" for c in row) + "</tr>")
    html_rows.append("</tbody></table>")
    return "\n".join(html_rows)

body = []
if source_code_language:
    body.append(code_block_html("\n".join(selected), source_code_language))
    selected = []
in_code = False
code_lang = ""
code = []
code_fence_character = ""
code_fence_length = 0
in_list = False
table = []

def flush_list():
    global in_list
    if in_list:
        body.append("</ul>")
        in_list = False

def flush_table():
    if table:
        body.append(render_table(table.copy()))
        table.clear()

for line in selected:
    fence = re.match(r"^\s*(`{3,}|~{3,})(.*)$", line)
    if fence and not in_code:
        flush_table()
        flush_list()
        code_fence_character = fence.group(1)[0]
        code_fence_length = len(fence.group(1))
        code_lang = fence.group(2).strip().lower()
        in_code = True
        continue
    if fence and in_code:
        fence_text = fence.group(1)
        closes_current_fence = (
            fence_text[0] == code_fence_character
            and len(fence_text) >= code_fence_length
            and not fence.group(2).strip()
        )
        if closes_current_fence:
            code_text = "\n".join(code)
            if code_lang == "mermaid":
                body.append(render_mermaid_block(code_text))
            else:
                body.append(code_block_html(code_text, code_lang))
            code = []
            code_lang = ""
            code_fence_character = ""
            code_fence_length = 0
            in_code = False
        else:
            code.append(line)
        continue
    if in_code:
        code.append(line)
        continue
    parsed = heading(line)
    if parsed:
        flush_table()
        flush_list()
        level, text = parsed
        body.append(f'<h{level} id="{slug(text)}">{inline_md(text)}</h{level}>')
        continue
    if re.match(r"^\s*\|.*\|\s*$", line):
        flush_list()
        table.append(line)
        continue
    flush_table()
    if re.match(r"^\s*[-*]\s+", line):
        if not in_list:
            body.append("<ul>")
            in_list = True
        body.append("<li>" + inline_md(re.sub(r"^\s*[-*]\s+", "", line)) + "</li>")
        continue
    flush_list()
    if not line.strip():
        body.append("")
    else:
        body.append("<p>" + inline_md(line) + "</p>")

flush_table()
flush_list()
if in_code:
    code_text = "\n".join(code)
    if code_lang == "mermaid":
        body.append(render_mermaid_block(code_text))
    else:
        body.append(code_block_html(code_text, code_lang))

section_meta = f"<div><strong>Section:</strong> {html.escape(selected_heading or section)}</div>" if section else ""
request_meta = f"<div><strong>You asked:</strong> {inline_md(request_text)}</div>" if request_text else ""
if result_text:
    result_path = Path(result_text).expanduser()
    try:
        result_is_path = result_path.exists()
    except OSError:
        result_is_path = False
    if result_is_path:
        result_display = f'<a href="{html.escape(file_url(result_path), quote=True)}">{html.escape(result_text)}</a>'
    else:
        result_display = inline_md(result_text)
    result_meta = f"<div><strong>Result:</strong> {result_display}</div>"
else:
    result_meta = ""
if mermaid_asset.is_file():
    mermaid_source = mermaid_asset.read_text(encoding="utf-8", errors="replace").replace("</script", "<\\/script")
    mermaid_scripts = (
        f"<script>{mermaid_source}</script>\n"
        '<script>mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "default" });</script>'
    )
else:
    mermaid_scripts = """<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "default" });
</script>"""

document = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(page_title)}</title>
  <style>
    {pygments_css()}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 0; background: #f7f8fa; color: #1f2933; }}
    main {{ max-width: 1040px; margin: 0 auto; padding: 32px 24px 64px; background: #fff; min-height: 100vh; }}
    .meta {{ color: #5b6675; border-bottom: 1px solid #d9dee7; padding-bottom: 16px; margin-bottom: 24px; }}
    h1, h2, h3 {{ line-height: 1.25; }}
    code {{ background: #eef1f5; color: #24364b; padding: 1px 4px; border-radius: 4px; }}
    .code-frame {{ margin: 16px 0; }}
    .code-language {{ display: inline-block; background: #d9dee7; color: #24364b; font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; padding: 3px 8px; border-radius: 4px 4px 0 0; }}
    pre {{ background: #101820; color: #f2f5f8; padding: 16px; overflow: auto; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }}
    .code-language + pre {{ margin-top: 0; border-top-left-radius: 0; }}
    pre code {{ background: transparent; color: inherit; padding: 0; border-radius: 0; }}
    .code-comment {{ color: #8b9cae; font-style: italic; }}
    .code-string {{ color: #b7f5c5; }}
    .code-keyword {{ color: #c5a3ff; font-weight: 600; }}
    .code-number {{ color: #ffc982; }}
    .diff-added {{ display: block; background: rgba(46, 160, 67, .22); color: #b7f5c5; }}
    .diff-removed {{ display: block; background: rgba(248, 81, 73, .22); color: #ffb8b5; }}
    pre a, pre code a {{ color: #8ecbff; text-decoration: underline; }}
    pre::selection, pre *::selection {{ background: #2f6fed; color: #fff; }}
    .diagram-block {{ border: 1px solid #d9dee7; border-radius: 6px; padding: 16px; margin: 18px 0; background: #fbfcfe; }}
    .mermaid {{ display: flex; justify-content: center; overflow-x: auto; }}
    details {{ margin-top: 12px; color: #5b6675; }}
    summary {{ cursor: pointer; font-weight: 600; }}
    table {{ border-collapse: collapse; width: 100%; margin: 16px 0; }}
    th, td {{ border: 1px solid #d9dee7; padding: 8px 10px; text-align: left; vertical-align: top; }}
    th {{ background: #eef1f5; }}
    a {{ color: #0b5cad; }}
  </style>
</head>
<body>
<main>
  <div class="meta">
    {request_meta}
    {result_meta}
    <div><strong>Source:</strong> <a href="{html.escape(file_url(source), quote=True)}">{html.escape(str(source))}</a></div>
    {section_meta}
  </div>
  {chr(10).join(body)}
</main>
{mermaid_scripts}
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
<script>
  if (window.hljs) {{
    document.querySelectorAll('pre code:not([data-show-context-fallback])').forEach((block) => window.hljs.highlightElement(block));
  }}
</script>
</body>
</html>
"""
target.write_text(document, encoding="utf-8")
link_pattern = re.compile(r"https?://[^\s)\]\"']+")
links = []
for raw in selected:
    for match in link_pattern.findall(raw):
        cleaned = match.rstrip(".,;:")
        if cleaned not in links:
            links.append(cleaned)
links_target.write_text("\n".join(links) + ("\n" if links else ""), encoding="utf-8")
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
