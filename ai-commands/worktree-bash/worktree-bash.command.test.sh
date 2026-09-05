#!/usr/bin/env bash
set -euo pipefail

command_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/worktree-bash.command.sh"
fixture="$(mktemp -d "${TMPDIR:-/tmp}/worktree-bash-test.XXXXXX")"
outside="$(mktemp -d "${TMPDIR:-/tmp}/worktree-bash-outside.XXXXXX")"
cleanup() { rm -rf "$fixture" "$outside"; }
trap cleanup EXIT

git -C "$fixture" init -q

run_in_fixture() { (cd "$fixture" && bash "$command_script" "$@"); }
expect_failure() {
  if "$@" >/dev/null 2>&1; then
    echo "expected failure: $*" >&2
    exit 1
  fi
}

run_in_fixture -- /bin/bash -c 'printf inside > inside.txt' >/dev/null
[[ "$(<"$fixture/inside.txt")" == inside ]]

dry_output="$(run_in_fixture --dry-run -- /bin/bash -c 'printf no > dry.txt')"
[[ "$dry_output" == worktree=*payload=* ]]
[[ ! -e "$fixture/dry.txt" ]]

expect_failure run_in_fixture -- /bin/bash -c 'printf outside > "$1"' bash "$outside/absolute.txt"
[[ ! -e "$outside/absolute.txt" ]]
expect_failure run_in_fixture -- /bin/bash -c 'printf traversal > ../traversal.txt'
[[ ! -e "$(dirname "$fixture")/traversal.txt" ]]

ln -s "$outside" "$fixture/outside-link"
expect_failure run_in_fixture -- /bin/bash -c 'printf symlink > outside-link/escape.txt'
[[ ! -e "$outside/escape.txt" ]]

expect_failure run_in_fixture -- /bin/bash -c '/bin/bash -c '\''printf child > "$1"'\'' bash "$2"' bash ignored "$outside/child.txt"
[[ ! -e "$outside/child.txt" ]]
expect_failure run_in_fixture -- /bin/bash -c 'value="$(printf substitution)"; printf %s "$value" > "$1"' bash "$outside/substitution.txt"
[[ ! -e "$outside/substitution.txt" ]]

expect_failure run_in_fixture --project-root "$outside" -- /bin/bash -c 'printf project > "$1"' bash "$outside/project-file.txt"
[[ ! -e "$outside/project-file.txt" ]]
run_in_fixture --project-root "$outside" -- /bin/bash -c 'mkdir -p "$1/.ai-workflow-suite"; printf state > "$1/.ai-workflow-suite/state.yml"' bash "$outside" >/dev/null
[[ "$(<"$outside/.ai-workflow-suite/state.yml")" == state ]]
expect_failure run_in_fixture --project-root / -- /usr/bin/true

expect_failure run_in_fixture -- /usr/bin/curl --connect-timeout 1 http://127.0.0.1:9/

WORKTREE_BASH_SECRET=not-for-child run_in_fixture -- /bin/bash -c 'test -z "${WORKTREE_BASH_SECRET:-}"' >/dev/null
run_in_fixture -- git status --short >/dev/null
if command -v node >/dev/null; then run_in_fixture -- node --version >/dev/null; fi
if command -v node >/dev/null; then
  run_in_fixture -- node -e 'const n=require("node:net"),p=require("node:path").join(process.env.TMPDIR,"test.sock"),s=n.createServer();s.listen(p,()=>s.close())' >/dev/null
fi

printf removable > "$fixture/removable.txt"
expect_failure run_in_fixture -- /bin/bash -c 'rm -f removable.txt'
[[ -e "$fixture/removable.txt" ]]
run_in_fixture --allow-destructive -- /bin/bash -c 'rm -f removable.txt' >/dev/null
[[ ! -e "$fixture/removable.txt" ]]

expect_failure run_in_fixture --
expect_failure run_in_fixture payload-without-separator

if find "$fixture" -name '.worktree-bash-*' -print -quit | grep -q .; then
  echo 'temporary command residue found' >&2
  exit 1
fi

echo 'worktree-bash command tests: PASS'
