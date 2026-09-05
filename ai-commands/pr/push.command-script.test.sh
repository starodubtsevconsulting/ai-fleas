#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

git -C "$WORK_DIR" init -q --bare remote.git
git -C "$WORK_DIR" init -q seed
git -C "$WORK_DIR/seed" config user.email test@example.com
git -C "$WORK_DIR/seed" config user.name Test
printf 'base\n' > "$WORK_DIR/seed/base.txt"
git -C "$WORK_DIR/seed" add base.txt
git -C "$WORK_DIR/seed" commit -qm base
git -C "$WORK_DIR/seed" branch -M main
git -C "$WORK_DIR/seed" remote add origin "$WORK_DIR/remote.git"
git -C "$WORK_DIR/seed" push -q -u origin main

git -C "$WORK_DIR/seed" switch -qc feature
printf 'feature\n' > "$WORK_DIR/seed/feature.txt"
git -C "$WORK_DIR/seed" add feature.txt
git -C "$WORK_DIR/seed" commit -qm feature
git -C "$WORK_DIR/seed" switch -q main
printf 'later\n' > "$WORK_DIR/seed/later.txt"
git -C "$WORK_DIR/seed" add later.txt
git -C "$WORK_DIR/seed" commit -qm later
git -C "$WORK_DIR/seed" push -q origin main
git -C "$WORK_DIR/seed" switch -q feature

receipt="$($SCRIPT_DIR/push.command-script.sh --project-dir "$WORK_DIR/seed" --branch feature --base main 2>&1)"
case "$receipt" in
  *"GIT_BASE_REFRESHED: origin/main"*"GIT_BRANCH_REBASED: feature onto origin/main"*) ;;
  *) echo "Expected mandatory base refresh and rebase receipts" >&2; exit 1 ;;
esac
git -C "$WORK_DIR/seed" merge-base --is-ancestor origin/main feature

printf 'dirty\n' > "$WORK_DIR/seed/dirty.txt"
if "$SCRIPT_DIR/push.command-script.sh" --project-dir "$WORK_DIR/seed" --branch feature --base main >/dev/null 2>&1; then
  echo "Expected dirty-worktree push to fail" >&2
  exit 1
fi

echo "push command tests passed"
