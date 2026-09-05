#!/usr/bin/env bash
set -euo pipefail

expected_version="3.4.1"

matrix_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/v_matrix.json"
if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  from_matrix="$(python3 - "$matrix_file" "$codename" <<'PY'
import json
import sys

path = sys.argv[1]
codename = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

ver = data.get("default_scala_version")
for entry in data.get("ubuntu_to_scala", []):
    if entry.get("codename") == codename and entry.get("recommended_version"):
        ver = entry["recommended_version"]
        break

if ver:
    print(ver)
PY
)"
  from_matrix="${from_matrix//$'\r'/}"
  if [ -n "$from_matrix" ]; then
    expected_version="$from_matrix"
  fi
fi

test -x "$HOME/scala/current/bin/scala" && test -d "$HOME/scala/$expected_version"
