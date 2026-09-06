#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "statements" || exit $?
set -euo pipefail

# Adapter placeholder for CIBC statement extraction.
# The main statements command currently owns orchestration and calls pdftotext.
# Keep CIBC-specific parsing rules here as they grow beyond the shared extractor.

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage:
  statements-cibc-statement-adapter.command.sh <statement-text-file>

Reads text extracted from a CIBC statement PDF and emits tax-like candidate lines.
This adapter is intentionally small until CIBC parsing needs provider-specific rules.
USAGE
  exit 0
fi

TEXT_FILE="${1:-}"
if [[ -z "$TEXT_FILE" || ! -f "$TEXT_FILE" ]]; then
  echo "CIBC adapter expects a statement text file" >&2
  exit 2
fi

grep -Ein 'CRA|CCRA|CANADA REVENUE|REV QC|REVENU QUEBEC|REVENUE QUEBEC|GST|QST|TAX|SOURCE DEDUCTION|DAS' "$TEXT_FILE" || true
