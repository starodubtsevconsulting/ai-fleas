#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="$ROOT/command/command.command.sh"
COMMAND_DOC="$ROOT/command/command.command.md"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BUNDLE="$TMP/bundle"
mkdir -p "$BUNDLE/alpha" "$BUNDLE/beta"
cp "$ROOT/validate-execution-routes.sh" "$BUNDLE/"
printf '# Alpha\n' > "$BUNDLE/alpha/alpha.command.md"
printf '# Beta\nSee alpha/alpha.command.md\n' > "$BUNDLE/beta/beta.command.md"
printf '# Canonical\nalpha/alpha.command.md\troute-alpha\t-\t-\t-\t-\nbeta/beta.command.md\troute-beta\t-\t-\t-\t-\n' > "$BUNDLE/execution-routes.tsv"

run() { bash "$HELPER" --commands-root "$BUNDLE" "$@"; }
fails() { if run "$@" >/dev/null 2>&1; then echo "expected failure: $*" >&2; exit 1; fi; }
snapshot() { find "$1" -type f -exec shasum {} + | LC_ALL=C sort; }
assert_unchanged() {
  local before="$1" after
  after="$(snapshot "$BUNDLE")"
  test "$before" = "$after" || { echo 'managed tree changed unexpectedly' >&2; exit 1; }
}

run list | grep -Fq 'alpha/alpha.command.md'
run show --path alpha/alpha.command.md | grep -Fq 'route=route-alpha'
run check | grep -Fq 'status=checked'

before="$(snapshot "$BUNDLE")"
run create --path gamma/gamma.command.md --route route-gamma --dry-run | grep -Fq 'status=dry-run'
assert_unchanged "$before"
run create --path gamma/gamma.command.md --route route-gamma >/dev/null
run create --path custom/custom.command.md --route route-specialist >/dev/null
grep -Fq $'custom/custom.command.md\troute-specialist\t-\t-\t-\t-' "$BUNDLE/execution-routes.tsv"
before="$(snapshot "$BUNDLE")"
fails create --path gamma/gamma.command.md --route route-gamma
assert_unchanged "$before"
printf '# Replacement content\n' > "$TMP/replacement.md"
beta_before="$(cat "$BUNDLE/beta/beta.command.md")"
run update --path gamma/gamma.command.md --route route-gamma --content-file "$TMP/replacement.md" >/dev/null
grep -Fq 'Replacement content' "$BUNDLE/gamma/gamma.command.md"
test "$beta_before" = "$(cat "$BUNDLE/beta/beta.command.md")"
before="$(snapshot "$BUNDLE")"
run update --path gamma/gamma.command.md --route route-gamma --dry-run | grep -Fq 'status=dry-run'
assert_unchanged "$before"
run update --path gamma/gamma.command.md --route mixed --reasoning route-plan --execution route-run >/dev/null
grep -Fq $'gamma/gamma.command.md\tmixed\troute-plan\t-\troute-run\t-' "$BUNDLE/execution-routes.tsv"
before="$(snapshot "$BUNDLE")"
run rename --path alpha/alpha.command.md --new-path alpha/renamed.command.md --dry-run | grep -Fq 'status=dry-run'
assert_unchanged "$before"
run rename --path alpha/alpha.command.md --new-path alpha/renamed.command.md >/dev/null
grep -Fq 'alpha/renamed.command.md' "$BUNDLE/beta/beta.command.md"
printf 'renamed.command.md\n' > "$BUNDLE/ambiguous.md"
before="$(snapshot "$BUNDLE")"
fails rename --path alpha/renamed.command.md --new-path alpha/final.command.md
assert_unchanged "$before"
rm "$BUNDLE/ambiguous.md"
before="$(snapshot "$BUNDLE")"
fails delete --path beta/beta.command.md
assert_unchanged "$before"
run delete --yes --path beta/beta.command.md --dry-run | grep -Fq 'status=dry-run'
assert_unchanged "$before"
fails delete --yes --path alpha/renamed.command.md
assert_unchanged "$before"
run delete --yes --path beta/beta.command.md >/dev/null
test ! -e "$BUNDLE/beta/beta.command.md"
printf 'gamma/gamma.command.md\n' > "$BUNDLE/gamma-reference.md"
before="$(snapshot "$BUNDLE")"
fails delete --yes --path gamma/gamma.command.md
assert_unchanged "$before"
rm "$BUNDLE/gamma-reference.md"
fails create --path ../escape.command.md --route route-gamma
fails create --path /tmp/escape.command.md --route route-gamma
fails create --path invalid/invalid.command.md --route 'Invalid Route'
ln -s /tmp "$BUNDLE/link"
fails create --path link/escape.command.md --route route-gamma
rm "$BUNDLE/link"
before="$(snapshot "$BUNDLE")"
fails update --path gamma/gamma.command.md --route mixed --reasoning route-plan
assert_unchanged "$before"
before="$(snapshot "$BUNDLE")"
if COMMAND_CRUD_TEST_MODE=1 COMMAND_CRUD_TEST_FAIL_VALIDATE=after-prepare run create --path staged/staged.command.md --route route-stage >/dev/null 2>&1; then
  echo 'expected staged validator failure' >&2; exit 1
fi
assert_unchanged "$before"
before="$(snapshot "$BUNDLE")"
if COMMAND_CRUD_TEST_MODE=1 COMMAND_CRUD_TEST_FAIL_APPLY=after-first-write run rename --path alpha/renamed.command.md --new-path alpha/final.command.md >/dev/null 2>&1; then
  echo 'expected apply failure' >&2; exit 1
fi
assert_unchanged "$before"
run check >/dev/null
grep -Fq 'opaque normalized identifiers' "$COMMAND_DOC"
grep -Fq 'External configuration and policy own route interpretation' "$COMMAND_DOC"
echo 'command CRUD fixtures: PASS'
