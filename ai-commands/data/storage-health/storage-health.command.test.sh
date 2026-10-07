#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMD="$ROOT/storage-health.command.sh"
bash -n "$CMD"
out="$("$CMD" inspect)"
grep -q "NAME" <<<"$out"
grep -q "SERIAL" <<<"$out"
grep -q "TRAN" <<<"$out"
if "$CMD" health /definitely/not/a/device >/dev/null 2>&1; then echo "expected invalid device to fail" >&2; exit 1; fi
echo "storage-health command smoke tests passed"
