#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

python3 "$SCRIPT_DIR/show-context.py" \
  --file "$SCRIPT_DIR/show-context.report.template.md" \
  --output "$TMP_DIR/report.html" \
  --title "Portable context" \
  --request "What should the human understand?" \
  --no-open >/dev/null

grep -q '<title>Portable context</title>' "$TMP_DIR/report.html"
grep -q 'What should the human understand?' "$TMP_DIR/report.html"
grep -q 'class="mermaid"' "$TMP_DIR/report.html"
grep -q 'Focused evidence only' "$TMP_DIR/report.html"
grep -q 'securityLevel:"strict"' "$TMP_DIR/report.html"
grep -q '<style>' "$TMP_DIR/report.html"
grep -q '<script type="module">' "$TMP_DIR/report.html"
grep -q 'Use the smallest useful combination of a table, screenshot, diff, link, or code snippet.' "$TMP_DIR/report.html"

cat > "$TMP_DIR/nested-fence.md" <<'MARKDOWN'
# Exact Markdown source

````markdown
## Rule

```mermaid
flowchart TD
  A --> B
```
````
MARKDOWN

python3 "$SCRIPT_DIR/show-context.py" \
  --file "$TMP_DIR/nested-fence.md" \
  --output "$TMP_DIR/nested-fence.html" \
  --no-open >/dev/null

grep -q 'language-markdown' "$TMP_DIR/nested-fence.html"
grep -q 'flowchart TD' "$TMP_DIR/nested-fence.html"
[[ "$(grep -o 'class="mermaid"' "$TMP_DIR/nested-fence.html" | wc -l | tr -d ' ')" == 0 ]]

echo 'portable show-context Python tests passed'
