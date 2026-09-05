#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
TEST_PROFILE_BUNDLE="$TMP_DIR/profile"
mkdir -p "$TEST_PROFILE_BUNDLE"
export AI_PROFILE_BUNDLE_ROOT="$TEST_PROFILE_BUNDLE"

output="$($SCRIPT_DIR/show-context.command.sh \
  --file "$SCRIPT_DIR/show-context.report.template.md" \
  --output-dir "$TMP_DIR" \
  --title "Portable context report" \
  --request "Can a human understand the evidence?" \
  --no-open)"

html_file="$(printf '%s\n' "$output" | head -n 1)"
[[ -f "$html_file" ]]
grep -q 'Portable context report' "$html_file"
grep -q 'Can a human understand the evidence?' "$html_file"
grep -q 'class="mermaid"' "$html_file"
grep -q 'Focused evidence only' "$html_file"
grep -q 'show-context.report.template.md' "$html_file"

rule_file="$TMP_DIR/example-rule.md"
printf '%s\n' \
  '# Example rule' \
  '' \
  '```mermaid' \
  'flowchart TD' \
  '  Actor["Actor: reviewer"] --> Outcome["Outcome: exact rule is visible"]' \
  '```' \
  '' \
  'The exact rule content must be shown.' > "$rule_file"

rule_output="$($SCRIPT_DIR/show-context.command.sh --template md-rules-changed \
  --file "$rule_file" \
  --output-dir "$TMP_DIR" \
  --title "Rule review report" \
  --request "Review the modified rule itself." \
  --result "$(printf 'Long human-readable result %.0s' {1..20})" \
  --no-open)"
rule_markdown_file="$(printf '%s\n' "$rule_output" | head -n 1)"
rule_html_file="$(printf '%s\n' "$rule_output" | tail -n 1)"
[[ -f "$rule_markdown_file" ]]
[[ -f "$rule_html_file" ]]
grep -q 'Rule review report' "$rule_html_file"
grep -q 'human reviews modified Markdown rules' "$rule_html_file"
grep -q 'Diagram description' "$rule_html_file"
grep -q 'The diagram begins with the human reviewing the exact modified rule source' "$rule_html_file"
grep -q 'What this review does' "$rule_html_file"
grep -q 'Modified Markdown rules' "$rule_html_file"
grep -q 'Exact current Markdown' "$rule_html_file"
grep -q 'The exact rule content must be shown.' "$rule_html_file"
grep -q 'Working-tree diff against HEAD' "$rule_html_file"
grep -q 'Human review' "$rule_html_file"
grep -q 'Rendered diagrams' "$rule_html_file"
grep -q 'Diagram 1' "$rule_html_file"
grep -q 'Merely opening or displaying this report does not prove review' "$rule_html_file"
grep -q 'Long human-readable result' "$rule_html_file"
grep -q 'class="language-markdown"' "$rule_html_file"
node "$SCRIPT_DIR/show-context.render.unit.test.mjs" "$rule_markdown_file" "$rule_html_file"

help_output="$($SCRIPT_DIR/show-context.command.sh --help)"
grep -q -- 'rule-review --file <markdown-rule>' <<<"$help_output"
grep -q -- '--template md-rules-changed' <<<"$help_output"
grep -q -- '`--template <template-id>`' "$SCRIPT_DIR/show-context.command.md"
grep -q -- 'code-review.*not currently registered' "$SCRIPT_DIR/show-context.command.md"
grep -q -- '../doc/principles/diagram-first-principle.md' "$SCRIPT_DIR/show-context.command.md"

alias_output="$($SCRIPT_DIR/show-context.command.sh rule-review \
  --file "$rule_file" \
  --output-dir "$TMP_DIR" \
  --no-open)"
alias_html_file="$(printf '%s\n' "$alias_output" | tail -n 1)"
[[ -f "$alias_html_file" ]]
grep -q 'Modified Markdown rules' "$alias_html_file"
grep -q -- '--meetings-dir <path>' <<<"$help_output"
if grep -Eqi 'zoom|documents/meetings' "$SCRIPT_DIR/show-context.command.sh"; then
  echo 'show-context must not hardcode a meeting provider or directory' >&2
  exit 1
fi

echo 'show-context tests passed'
