#!/usr/bin/env bash
set -euo pipefail

source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d "${TMPDIR:-/tmp}/sdd-guard-test.XXXXXX")"
fixture="$(cd "$fixture" && pwd -P)"
cleanup() { rm -rf "$fixture"; }
trap cleanup EXIT

mkdir -p "$fixture/ai-commands/sdd" "$fixture/ai-profile/example/.local/work-session-state" \
  "$fixture/memory" "$fixture/scripts"
cp "$source_root/sdd/sdd.command-guard.sh" "$fixture/ai-commands/sdd/"
cp "$source_root/runtime-paths.sh" "$fixture/ai-commands/"
git -C "$fixture" init -q
git -C "$fixture" config user.email test@example.invalid
git -C "$fixture" config user.name test
printf 'baseline\n' > "$fixture/README.md"
git -C "$fixture" add README.md
git -C "$fixture" commit -qm baseline

plan="$fixture/ai-profile/example/.local/work-session-state/plan.md"
pointer="$fixture/ai-profile/example/.local/work-session-state/.current-plan-path"
cat > "$plan" <<'PLAN'
Task Scope: focused SDD guard regression
Project: AI Workflow Suite / test
## Progress
- [x] contract guard fixture #test
PLAN
printf '%s\n' "$plan" > "$pointer"
repo_key="$(printf '%s' "$fixture" | sed 's#[/ ]#_#g')"
state="$fixture/memory/sdd-resync-${repo_key}.state"
cat > "$state" <<STATE
plan_path=$plan
head=$(git -C "$fixture" rev-parse HEAD)
resynced_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
STATE

printf 'managed helper\n' > "$fixture/scripts/runtime-paths.sh"
git -C "$fixture" add scripts/runtime-paths.sh
CODEX_MEMORY_DIR="$fixture/memory" AI_WORK_PROFILE_ID=example bash "$fixture/ai-commands/sdd/sdd.command-guard.sh" --staged-only >/dev/null

git -C "$fixture" reset -q
printf 'agent governance\n' > "$fixture/AGENTS.md"
printf 'future integration\n' > "$fixture/IDEA.md"
git -C "$fixture" add AGENTS.md IDEA.md
CODEX_MEMORY_DIR="$fixture/memory" AI_WORK_PROFILE_ID=example bash "$fixture/ai-commands/sdd/sdd.command-guard.sh" --staged-only >/dev/null

git -C "$fixture" reset -q
printf 'unrelated\n' > "$fixture/scripts/unrelated.sh"
git -C "$fixture" add scripts/unrelated.sh
if CODEX_MEMORY_DIR="$fixture/memory" AI_WORK_PROFILE_ID=example bash "$fixture/ai-commands/sdd/sdd.command-guard.sh" --staged-only >"$fixture/out" 2>"$fixture/err"; then
  echo 'expected unrelated root script to be rejected' >&2
  exit 1
fi
grep -Fq "scripts/unrelated.sh' is outside allowed scope" "$fixture/err"

echo 'SDD guard path regression: PASS'
