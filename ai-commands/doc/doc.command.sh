#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"
CHECK_ONLY=false

usage() {
  cat <<'USAGE'
Usage: doc.command.sh --check [--project-dir <path>] [--output-dir <path>]

Checks whether a project has the minimum documentation context required by the
Documentation command. It does not create or modify documentation.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) CHECK_ONLY=true; shift ;;
    --project-dir)
      [[ $# -ge 2 ]] || { echo 'Missing value for --project-dir' >&2; exit 2; }
      AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
    --output-dir)
      [[ $# -ge 2 ]] || { echo 'Missing value for --output-dir' >&2; exit 2; }
      AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown parameter: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ "$CHECK_ONLY" == true ]] || { usage >&2; exit 2; }

project_dir="${AI_FLOW_PROJECT_DIR:-$PWD}"
[[ -d "$project_dir" ]] || { echo "DOC_READINESS status=BLOCKED reason=project-directory-missing"; exit 1; }
project_dir="$(cd "$project_dir" && pwd -P)"

readme_status=missing
[[ -f "$project_dir/README.md" ]] && readme_status=present

documentation_roots=()
for candidate in docs documentation; do
  [[ -d "$project_dir/$candidate" ]] && documentation_roots+=("$candidate")
done

roots_value=none
if [[ ${#documentation_roots[@]} -gt 0 ]]; then
  roots_value="$(IFS=,; echo "${documentation_roots[*]}")"
fi

printf 'DOC_READINESS project_dir=%s\n' "$project_dir"
printf 'DOC_READINESS readme=%s\n' "$readme_status"
printf 'DOC_READINESS documentation_roots=%s\n' "$roots_value"

if [[ "$readme_status" != present ]]; then
  echo 'DOC_READINESS status=BLOCKED reason=readme-missing'
  exit 1
fi

echo 'DOC_READINESS status=READY next_action=read-readme-then-select-documentation-fixture'
