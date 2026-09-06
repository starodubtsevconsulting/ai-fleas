#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "statements" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SHOW_CONTEXT_CMD="$ROOT_DIR/ai-commands/show-context/show-context.command.sh"

if [[ -n "${AI_COMMAND_CONFIG_PATH:-}" && -f "$AI_COMMAND_CONFIG_PATH" ]]; then
  # shellcheck disable=SC1091
  source "$AI_COMMAND_CONFIG_PATH"
fi

INCORPORATED_ROOT="${INCORPORATED_ROOT:-${HOME}/accounting}"
REPORTS_ROOT="${REPORTS_ROOT:-${INCORPORATED_ROOT}/reports}"
STATEMENTS_PROVIDER="${STATEMENTS_PROVIDER:-fs}"
STATEMENTS_OUTPUT_DIR="${STATEMENTS_OUTPUT_DIR:-}"

ACTION="${1:-tax-candidates}"
if [[ $# -gt 0 ]]; then
  shift
fi

YEAR="$(date +%Y)"
SHOW="false"
OPEN="true"

usage() {
  cat <<'USAGE'
Usage:
  statements.command.sh tax-candidates [--provider fs] [--year YYYY] [--reports-root <path>] [--incorporated-root <path>] [--output-dir <path>] [--show] [--no-open]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider)
      STATEMENTS_PROVIDER="${2:-}"; shift 2 ;;
    --year)
      YEAR="${2:-}"; shift 2 ;;
    --reports-root)
      REPORTS_ROOT="${2:-}"; shift 2 ;;
    --incorporated-root)
      INCORPORATED_ROOT="${2:-}"
      REPORTS_ROOT="${REPORTS_ROOT:-${INCORPORATED_ROOT}/reports}"
      shift 2 ;;
    --output-dir)
      STATEMENTS_OUTPUT_DIR="${2:-}"; shift 2 ;;
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

if [[ "$STATEMENTS_PROVIDER" != "fs" ]]; then
  echo "Unsupported statements provider: $STATEMENTS_PROVIDER (available: fs)" >&2
  exit 2
fi

if [[ "$ACTION" != "tax-candidates" ]]; then
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

if ! command -v pdftotext >/dev/null 2>&1; then
  echo "pdftotext is required to scan statement PDFs" >&2
  exit 1
fi

if [[ -n "$STATEMENTS_OUTPUT_DIR" ]]; then
  OUTPUT_DIR="${STATEMENTS_OUTPUT_DIR/#\~/$HOME}"
else
  OUTPUT_DIR="$ROOT_DIR/.ai/tmp/statements"
fi
mkdir -p "$OUTPUT_DIR"
OUT_FILE="$OUTPUT_DIR/${YEAR}-tax-candidates.md"

command_python - "$YEAR" "$REPORTS_ROOT" "$OUT_FILE" <<'PY'
import re
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

YEAR = sys.argv[1]
REPORTS_ROOT = Path(sys.argv[2]).expanduser()
OUT_FILE = Path(sys.argv[3])
YEAR_ROOT = REPORTS_ROOT / YEAR

statement_dir_names = {"statements", "statemetns", "statements_rbc", "bank statements"}
tax_keywords = [
    "commercial taxes",
    "pad ccra",
    "ccra canada",
    "canada revenue",
    "cra",
    "rev qc",
    "revenu quebec",
    "revenue quebec",
    "mrq",
    "rq",
    "txins",
    "decor",
    "emptx",
    "das",
    "source deduction",
    "source deductions",
    "gst",
    "qst",
]
noise_keywords = {"total", "balance", "opening", "closing"}
money_re = re.compile(r"(?<![\d-])(?:\$\s*)?((?:[0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\.[0-9]{2})(?!\d)")
date_re = re.compile(r"^(?:\d{1,2}\s+[A-Za-z]{3}|[A-Za-z]{3}\s+\d{1,2}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})$")


def is_statement_pdf(path: Path) -> bool:
    if path.suffix.lower() != ".pdf":
        return False
    parts = {part.lower() for part in path.parts}
    return bool(parts & statement_dir_names) or "statement" in path.name.lower()


def provider_for(text: str, path: Path) -> str:
    lower = text.lower()
    path_lower = str(path).lower()
    if "royal bank of canada" in lower or "/rbc/" in path_lower or "rbc" in path.name.lower():
        return "RBC"
    if "cibc" in lower or "/cibc/" in path_lower:
        return "CIBC"
    if "wise" in lower or "/wise/" in path_lower:
        return "WISE"
    return "UNKNOWN"


def classify(line: str) -> str:
    lower = line.lower()
    if "emptx" in lower or "source deduction" in lower or "source deductions" in lower or "das" in lower:
        return "PAYROLL"
    return "TAX"


def money_near(lines, index):
    # RBC often places the amount immediately after the description, while some
    # statement layouts place it on a nearby previous/next visual line.
    offsets = [0, 1, 2, 3, 4, 5, -1, -2, -3]
    for offset in offsets:
        pos = index + offset
        if pos < 0 or pos >= len(lines):
            continue
        raw = lines[pos]
        lower = raw.lower()
        if any(word in lower for word in noise_keywords) and pos != index:
            continue
        matches = money_re.findall(raw)
        if matches:
            return matches[-1]
    return ""


def context(lines, index):
    start = max(0, index - 3)
    end = min(len(lines), index + 5)
    return " / ".join(line.strip() for line in lines[start:end] if line.strip())

pdfs = sorted(path for path in YEAR_ROOT.rglob("*.pdf") if is_statement_pdf(path))
candidates = []

for pdf in pdfs:
    try:
        result = subprocess.run(["pdftotext", str(pdf), "-"], check=False, capture_output=True, text=True, timeout=60)
    except Exception as exc:
        candidates.append({"provider": "ERROR", "date": "", "type": "", "amount": "", "match": f"Could not read PDF: {exc}", "context": "", "file": pdf})
        continue
    if result.returncode != 0:
        candidates.append({"provider": "ERROR", "date": "", "type": "", "amount": "", "match": (result.stderr or "pdftotext failed").strip(), "context": "", "file": pdf})
        continue

    lines = [line.strip() for line in result.stdout.splitlines()]
    provider = provider_for(result.stdout, pdf)
    last_date = ""
    for index, line in enumerate(lines):
        if not line:
            continue
        if date_re.match(line):
            last_date = line
            continue
        lower = line.lower()
        if not any(keyword in lower for keyword in tax_keywords):
            continue
        amount = money_near(lines, index)
        candidates.append({"provider": provider, "date": last_date, "type": classify(line), "amount": amount, "match": line, "context": context(lines, index), "file": pdf})

seen = OrderedDict()
for row in candidates:
    key = (row["provider"], row["date"], row["type"], row["amount"], row["match"], row["file"].name)
    seen.setdefault(key, row)
candidates = list(seen.values())
valid_rows = [row for row in candidates if row["provider"] != "ERROR"]
valid_count = len(valid_rows)

def amount_value(row):
    raw = row.get("amount") or ""
    if not raw:
        return None
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None

totals = {"TAX": 0.0, "PAYROLL": 0.0, "UNKNOWN": 0.0}
missing_amount_count = 0
for row in valid_rows:
    amount = amount_value(row)
    if amount is None:
        missing_amount_count += 1
        continue
    row_type = row["type"] if row["type"] in totals else "UNKNOWN"
    totals[row_type] += amount

def money(value):
    return f"${value:,.2f}"

out = []
out.append(f"# {YEAR} Statement Tax Candidates")
out.append("")
out.append(f"Reports root: `{REPORTS_ROOT}`")
out.append(f"Statements scanned: {len(pdfs)} PDF file(s)")
out.append(f"Candidates found: {valid_count}")
out.append("")
out.append("This is candidate extraction from statement PDFs. Verify rows before filing or before writing a curated `taxes.md` note.")
out.append("")
out.append("## Candidate Totals")
out.append("")
out.append("| Type | Amount candidate total | Rows missing amount |")
out.append("|---|---:|---:|")
out.append(f"| TAX | {money(totals['TAX'])} |  |")
out.append(f"| PAYROLL / source deductions | {money(totals['PAYROLL'])} |  |")
out.append(f"| UNKNOWN | {money(totals['UNKNOWN'])} |  |")
out.append(f"| TOTAL | {money(totals['TAX'] + totals['PAYROLL'] + totals['UNKNOWN'])} | {missing_amount_count} |")
out.append("")
out.append("## Candidates")
out.append("")
if candidates:
    out.append("| Provider | Date context | Type | Amount candidate | Matched line | Statement |")
    out.append("|---|---|---|---:|---|---|")
    for row in candidates:
        file_display = str(row["file"])
        out.append(f"| {row['provider']} | {row['date']} | {row['type']} | {row['amount']} | {row['match'].replace('|', '/')} | `{file_display}` |")
    out.append(f"| TOTAL |  | All numeric candidates | {money(totals['TAX'] + totals['PAYROLL'] + totals['UNKNOWN'])} | Rows missing amount: {missing_amount_count} |  |")
else:
    out.append("No tax-like payment candidates found in statement PDFs.")
out.append("")
out.append("## Context")
out.append("")
for i, row in enumerate(candidates, 1):
    out.append(f"### Candidate {i}")
    out.append(f"- Provider: {row['provider']}")
    out.append(f"- Statement: `{row['file']}`")
    out.append(f"- Context: {row['context'].replace('|', '/')}")
    out.append("")
out.append("## Statement Files")
out.append("")
for pdf in pdfs:
    out.append(f"- `{pdf}`")

OUT_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")
print(OUT_FILE)
print(f"statements_scanned={len(pdfs)}")
print(f"tax_candidates={valid_count}")
PY

printf '\nStatement candidate file: %s\n' "$OUT_FILE"
cat "$OUT_FILE"

if [[ "$SHOW" == "true" ]]; then
  if [[ ! -x "$SHOW_CONTEXT_CMD" ]]; then
    echo "show-context command not executable: $SHOW_CONTEXT_CMD" >&2
    exit 1
  fi
  show_args=(--file "$OUT_FILE" --title "$YEAR Statement Tax Candidates")
  if [[ "$OPEN" != "true" ]]; then
    show_args+=(--no-open)
  fi
  "$SHOW_CONTEXT_CMD" "${show_args[@]}"
fi
