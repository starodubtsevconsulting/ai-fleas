#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "taxes" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SHOW_CONTEXT_CMD="$ROOT_DIR/ai-commands/show-context/show-context.command.sh"
STATEMENTS_CMD="$ROOT_DIR/ai-commands/statements/statements.command.sh"

if [[ -n "${AI_COMMAND_CONFIG_PATH:-}" && -f "$AI_COMMAND_CONFIG_PATH" ]]; then
  # shellcheck disable=SC1091
  source "$AI_COMMAND_CONFIG_PATH"
fi

INCORPORATED_ROOT="${INCORPORATED_ROOT:-${HOME}/accounting}"
REPORTS_ROOT="${REPORTS_ROOT:-${INCORPORATED_ROOT}/reports}"
TAXES_PROVIDER="${TAXES_PROVIDER:-fs}"
TAXES_OUTPUT_DIR="${TAXES_OUTPUT_DIR:-}"

ACTION="${1:-summary}"
if [[ $# -gt 0 ]]; then
  shift
fi

YEAR="$(date +%Y)"
SHOW="false"
OPEN="true"

usage() {
  cat <<'USAGE'
Usage:
  taxes.command.sh summary [--provider fs] [--year YYYY] [--reports-root <path>] [--incorporated-root <path>] [--output-dir <path>] [--show] [--no-open]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider)
      TAXES_PROVIDER="${2:-}"; shift 2 ;;
    --year)
      YEAR="${2:-}"; shift 2 ;;
    --reports-root)
      REPORTS_ROOT="${2:-}"; shift 2 ;;
    --incorporated-root)
      INCORPORATED_ROOT="${2:-}"
      REPORTS_ROOT="${REPORTS_ROOT:-${INCORPORATED_ROOT}/reports}"
      shift 2 ;;
    --output-dir)
      TAXES_OUTPUT_DIR="${2:-}"; shift 2 ;;
    --show)
      SHOW="true"; shift ;;
    --no-open)
      OPEN="false"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

if [[ "$TAXES_PROVIDER" != "fs" ]]; then
  echo "Unsupported taxes provider: $TAXES_PROVIDER (available: fs)" >&2
  exit 2
fi

if [[ "$ACTION" != "summary" ]]; then
  echo "Unsupported action: $ACTION" >&2
  usage >&2
  exit 2
fi

if [[ -z "$YEAR" || ! "$YEAR" =~ ^[0-9]{4}$ ]]; then
  echo "--year must be a 4-digit year" >&2
  exit 2
fi

REPORTS_ROOT="${REPORTS_ROOT/#\~/$HOME}"
YEAR_ROOT="$REPORTS_ROOT/$YEAR"

if [[ ! -d "$YEAR_ROOT" ]]; then
  echo "Reports year folder not found: $YEAR_ROOT" >&2
  exit 1
fi

if [[ -n "$TAXES_OUTPUT_DIR" ]]; then
  OUTPUT_DIR="${TAXES_OUTPUT_DIR/#\~/$HOME}"
else
  OUTPUT_DIR="$ROOT_DIR/.ai/tmp/taxes"
fi
mkdir -p "$OUTPUT_DIR"
OUT_FILE="$OUTPUT_DIR/${YEAR}-taxes-summary.md"

if ! find "$YEAR_ROOT" -type f -name 'taxes.md' | grep -E '/(taxes|statements)/' >/dev/null 2>&1; then
  echo "No taxes.md files found under $YEAR_ROOT; scanning statement PDFs for tax candidates." >&2
  if [[ ! -x "$STATEMENTS_CMD" ]]; then
    echo "statements command not executable: $STATEMENTS_CMD" >&2
    exit 1
  fi
  statement_args=(tax-candidates --provider fs --year "$YEAR" --reports-root "$REPORTS_ROOT" --output-dir "$OUTPUT_DIR")
  if [[ "$SHOW" == "true" ]]; then
    statement_args+=(--show)
  fi
  if [[ "$OPEN" != "true" ]]; then
    statement_args+=(--no-open)
  fi
  "$STATEMENTS_CMD" "${statement_args[@]}"
  exit 0
fi

command_python - "$YEAR" "$REPORTS_ROOT" "$OUT_FILE" <<'PY'
import re
import sys
from decimal import Decimal
from pathlib import Path

YEAR = sys.argv[1]
REPORTS_ROOT = Path(sys.argv[2]).expanduser()
OUT_FILE = Path(sys.argv[3])
YEAR_ROOT = REPORTS_ROOT / YEAR

money_re = re.compile(r"\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)")
date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")

candidates = []
for path in YEAR_ROOT.rglob("taxes.md"):
    parts = {part.lower() for part in path.parts}
    if "taxes" in parts or "statements" in parts:
        candidates.append(path)
candidates = sorted(set(candidates))

if not candidates:
    raise SystemExit(f"No taxes.md files found under {YEAR_ROOT}")

# Prefer quarter tax notes, then annual statement copies.
def score(path: Path):
    rel = path.relative_to(YEAR_ROOT).parts
    text = "/".join(rel).lower()
    value = 0
    if "/out/taxes/" in f"/{text}":
        value += 20
    if re.match(r"^[1-4]$", rel[0] if rel else ""):
        value += 10
    if "statements" in rel:
        value -= 5
    return (-value, str(path))

selected = sorted(candidates, key=score)[0]
text = selected.read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()

section = None
paid_rows = []
scheduled_rows = []
for raw in lines:
    stripped = raw.strip()
    if stripped.startswith("## "):
        heading = stripped.lower()
        if "taxes payed" in heading or "taxes paid" in heading:
            section = "paid"
        elif "still to pay" in heading:
            section = "scheduled"
        elif heading.startswith("## "):
            section = None if section == "scheduled" else section
    if not stripped.startswith("|") or "---" in stripped or "date" in stripped.lower() or "agency" in stripped.lower() or "category" in stripped.lower():
        continue
    cells = [cell.strip() for cell in stripped.strip("|").split("|")]
    if section == "paid" and len(cells) >= 4 and date_re.match(cells[0]):
        amount_match = money_re.search(cells[2])
        if amount_match:
            paid_rows.append({
                "date": cells[0],
                "type": cells[1].upper(),
                "amount": Decimal(amount_match.group(1).replace(",", "")),
                "description": cells[3],
            })
    elif section == "scheduled" and len(cells) >= 3 and cells[0].upper() != "TOTAL":
        amount_match = money_re.search(cells[2])
        if amount_match:
            scheduled_rows.append({
                "agency": cells[0],
                "due_date": cells[1],
                "amount": Decimal(amount_match.group(1).replace(",", "")),
            })

def money(value: Decimal) -> str:
    return f"${value:,.2f}"

recorded_tax = sum((row["amount"] for row in paid_rows if row["type"] == "TAX"), Decimal("0"))
recorded_payroll = sum((row["amount"] for row in paid_rows if row["type"] == "PAYROLL"), Decimal("0"))
recorded_total = recorded_tax + recorded_payroll
strict_rows = [row for row in paid_rows if row["date"].startswith(YEAR + "-")]
strict_tax = sum((row["amount"] for row in strict_rows if row["type"] == "TAX"), Decimal("0"))
strict_payroll = sum((row["amount"] for row in strict_rows if row["type"] == "PAYROLL"), Decimal("0"))
strict_total = strict_tax + strict_payroll
scheduled_total = sum((row["amount"] for row in scheduled_rows), Decimal("0"))

out = []
out.append(f"# {YEAR} Tax Summary")
out.append("")
out.append(f"Source note: `{selected}`")
out.append(f"Reports root: `{REPORTS_ROOT}`")
out.append("")
out.append("## Paid So Far")
out.append("")
out.append("| View | TAX | PAYROLL / source deductions | Total |")
out.append("|---|---:|---:|---:|")
out.append(f"| TOTAL - Recorded in note | {money(recorded_tax)} | {money(recorded_payroll)} | {money(recorded_total)} |")
out.append(f"| TOTAL - Strict {YEAR}-dated entries | {money(strict_tax)} | {money(strict_payroll)} | {money(strict_total)} |")
out.append("")
out.append("Use the strict year-dated row when the question is exactly \"this year so far\". Use the recorded row when the accounting note intentionally includes late prior-year payments inside the current-year package.")
out.append("")
out.append("## Scheduled / Still To Pay")
out.append("")
if scheduled_rows:
    out.append("| Agency | Due date | Amount |")
    out.append("|---|---|---:|")
    for row in scheduled_rows:
        out.append(f"| {row['agency']} | {row['due_date']} | {money(row['amount'])} |")
    out.append(f"| TOTAL |  | {money(scheduled_total)} |")
else:
    out.append("No scheduled payments found in the selected note.")
out.append("")
out.append("## Evidence Files")
out.append("")
for path in candidates:
    out.append(f"- `{path}`")
out.append("")
out.append("## Paid Rows")
out.append("")
out.append("| Date | Type | Amount | Description |")
out.append("|---|---|---:|---|")
for row in paid_rows:
    out.append(f"| {row['date']} | {row['type']} | {money(row['amount'])} | {row['description']} |")
out.append(f"| TOTAL | Recorded in note | {money(recorded_total)} | Includes all rows listed above |")
out.append(f"| TOTAL | Strict {YEAR}-dated entries | {money(strict_total)} | Excludes rows outside {YEAR} |")

OUT_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")
print(OUT_FILE)
print(f"recorded_total={money(recorded_total)}")
print(f"strict_{YEAR}_total={money(strict_total)}")
print(f"scheduled_total={money(scheduled_total)}")
PY

printf '\nSummary file: %s\n' "$OUT_FILE"
cat "$OUT_FILE"

if [[ "$SHOW" == "true" ]]; then
  if [[ ! -x "$SHOW_CONTEXT_CMD" ]]; then
    echo "show-context command not executable: $SHOW_CONTEXT_CMD" >&2
    exit 1
  fi
  show_args=(--file "$OUT_FILE" --title "$YEAR Tax Summary")
  if [[ "$OPEN" != "true" ]]; then
    show_args+=(--no-open)
  fi
  "$SHOW_CONTEXT_CMD" "${show_args[@]}"
fi
