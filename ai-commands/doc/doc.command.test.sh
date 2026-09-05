#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
COMMANDS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PRINCIPLE="$SCRIPT_DIR/principles/diagram-first-principle.md"
INCLUDED_RULES_PRINCIPLE="$SCRIPT_DIR/principles/included-rules-principle.md"
PROJECT_CONTEXT_PRINCIPLE="$SCRIPT_DIR/principles/project-documentation-context-principle.md"
CODE_PRINCIPLE="$SCRIPT_DIR/principles/development-top-of-file-documentation-principle.md"
COMPANION_PRINCIPLE="$SCRIPT_DIR/principles/companion-file-documentation-principle.md"
PROJECT="$TMP_DIR/project"

mkdir -p "$PROJECT/docs"
printf '# Example project\n' > "$PROJECT/README.md"
PROJECT_CANONICAL="$(cd "$PROJECT" && pwd -P)"

[[ -f "$PRINCIPLE" ]]
[[ -f "$INCLUDED_RULES_PRINCIPLE" ]]
[[ -f "$PROJECT_CONTEXT_PRINCIPLE" ]]
[[ -f "$CODE_PRINCIPLE" ]]
[[ -f "$COMPANION_PRINCIPLE" ]]
[[ ! -d "$COMMANDS_ROOT/docs" ]]

grep -q '^# Diagram First Principle$' "$PRINCIPLE"
grep -q '^## Included rules$' "$PRINCIPLE"
grep -q 'included-rules-principle.md' "$PRINCIPLE"
grep -q '^# Included Rules Principle$' "$INCLUDED_RULES_PRINCIPLE"
grep -q 'BLOCKED_INCLUDED_RULE_CONTEXT' "$INCLUDED_RULES_PRINCIPLE"
grep -q '^flowchart TD$' "$PRINCIPLE"
grep -q '^## Rules$' "$PRINCIPLE"
grep -q '^## Fixture use$' "$PRINCIPLE"
grep -q 'principles/diagram-first-principle.md' "$SCRIPT_DIR/doc.command.md"
grep -q 'principles/included-rules-principle.md' "$SCRIPT_DIR/doc.command.md"
grep -q 'Documentation fixture composition' "$SCRIPT_DIR/doc.command.md"
grep -q 'principles/project-documentation-context-principle.md' "$SCRIPT_DIR/doc.command.md"
grep -q 'principles/development-top-of-file-documentation-principle.md' "$SCRIPT_DIR/doc.command.md"
grep -q 'principles/companion-file-documentation-principle.md' "$SCRIPT_DIR/doc.command.md"
grep -q 'one principle may explicitly include another' "$SCRIPT_DIR/doc.command.md"
grep -q 'considers every cataloged' "$SCRIPT_DIR/doc.command.md"
grep -q 'dependencies load transitively and fail closed' "$SCRIPT_DIR/doc.command.md"
grep -q '^## Supported Prompts$' "$SCRIPT_DIR/doc.command.md"
grep -q 'Check documentation readiness for <project>' "$SCRIPT_DIR/doc.command.md"
grep -q 'The diagram starts with a documentation author or reviewer' "$SCRIPT_DIR/doc.command.md"
grep -q '^# Project Documentation Context Principle$' "$PROJECT_CONTEXT_PRINCIPLE"
grep -q '^# Development Top-of-File Documentation Principle$' "$CODE_PRINCIPLE"
grep -q 'Read the resolved project'"'"'s `README.md`' "$PROJECT_CONTEXT_PRINCIPLE"
grep -q 'top of the file' "$CODE_PRINCIPLE"
grep -q 'Do not add class-level, method-level, or function-level documentation by default' "$CODE_PRINCIPLE"
grep -q '^# Companion File Documentation Principle$' "$COMPANION_PRINCIPLE"
grep -q 'same basename' "$COMPANION_PRINCIPLE"

check_output="$(bash "$SCRIPT_DIR/doc.command.sh" --check --project-dir "$PROJECT")"
grep -F "DOC_READINESS project_dir=$PROJECT_CANONICAL" <<<"$check_output"
grep -F 'DOC_READINESS readme=present' <<<"$check_output"
grep -F 'DOC_READINESS documentation_roots=docs' <<<"$check_output"
grep -F 'DOC_READINESS status=READY' <<<"$check_output"

if bash "$SCRIPT_DIR/doc.command.sh" --check --project-dir "$TMP_DIR/missing" >/dev/null 2>&1; then
  echo 'doc command must block a missing project directory' >&2
  exit 1
fi

if bash "$SCRIPT_DIR/doc.command.sh" --unknown >/dev/null 2>&1; then
  echo 'doc command must reject unsupported arguments' >&2
  exit 1
fi

echo 'documentation command tests passed'
