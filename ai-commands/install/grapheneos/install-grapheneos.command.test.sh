#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="$SCRIPT_DIR/install-grapheneos.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$COMMAND" ]] || fail "command executable is missing"

set +e
output="$($COMMAND 2>&1)"
status=$?
set -e

[[ $status -eq 3 ]] || fail "SNAPSHOT command must exit 3; got $status"
[[ "$output" == *"0.0.1-SNAPSHOT"* ]] || fail "version is not reported"
[[ "$output" == *"NOT READY"* ]] || fail "SNAPSHOT readiness warning is missing"
[[ "$output" == *"cannot be executed"* ]] || fail "SNAPSHOT execution was not explicitly blocked"
[[ "$output" != *"installer implementation"* ]] || fail "execution passed the shared SNAPSHOT guard"

echo "PASS: GrapheneOS SNAPSHOT command is blocked before implementation execution"
