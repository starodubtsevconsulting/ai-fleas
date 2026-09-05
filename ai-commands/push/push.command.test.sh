#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMMAND_SH="$SCRIPT_DIR/push.command.sh"
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
CURRENT_EMAIL=$(git -C "$REPO_ROOT" config user.email)
CURRENT_NAME=$(git -C "$REPO_ROOT" config user.name)
CURRENT_DOMAIN=${CURRENT_EMAIL##*@}
FIXTURE_ROOT=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

bash -n "$COMMAND_SH"

mkdir -p "$FIXTURE_ROOT/ai-commands/push" \
  "$FIXTURE_ROOT/ai-profile/push-test/commands/source-control" \
  "$FIXTURE_ROOT/ai-profile/fixture-push/commands/source-control"
cp "$COMMAND_SH" "$FIXTURE_ROOT/ai-commands/push/push.command.sh"
printf '%s\n' \
  'version: 3' \
  'name: push-test' \
  "projects_root_path: $REPO_ROOT" \
  "org_domain: $CURRENT_DOMAIN" \
  'commands:' \
  '  - id: source-control' \
  '    config: commands/source-control/config.yml' \
  'workflows:' \
  '  - path: dev.workflow.md' \
  > "$FIXTURE_ROOT/ai-profile/push-test/push-test-work-profile.yml"
printf '%s\n' \
  'version: 1' \
  'command: source-control' \
  'capability: git' \
  'registered_command: git' \
  'command_path: git/git.command.sh' \
  "identity_name: $CURRENT_NAME" \
  "identity_email: $CURRENT_EMAIL" \
  'credential_scope: remote_host' \
  'allowed_remote_url_patterns: []' \
  > "$FIXTURE_ROOT/ai-profile/push-test/commands/source-control/config.yml"

output=$(AI_WORK_PROFILE_ID=push-test AI_WORKFLOW_ID=dev "$FIXTURE_ROOT/ai-commands/push/push.command.sh" --check)
grep -Fq "Git user.email domain matches expected profile 'push-test' ($CURRENT_DOMAIN)." <<< "$output"
grep -Fq "Push preflight passed for $REPO_ROOT." <<< "$output"

FIXTURE_COMMAND="$FIXTURE_ROOT/ai-commands/push/push.command.sh"
FIXTURE_REPOS="$FIXTURE_ROOT/repos"
mkdir -p "$FIXTURE_REPOS"
printf '%s\n' \
  'version: 3' \
  'name: fixture-push' \
  "projects_root_path: $FIXTURE_REPOS" \
  "org_domain: $CURRENT_DOMAIN" \
  'commands:' \
  '  - id: source-control' \
  '    config: commands/source-control/config.yml' \
  'workflows:' \
  '  - path: dev.workflow.md' \
  > "$FIXTURE_ROOT/ai-profile/fixture-push/fixture-push-work-profile.yml"
printf '%s\n' \
  'version: 1' \
  'command: source-control' \
  'capability: git' \
  'registered_command: git' \
  'command_path: git/git.command.sh' \
  'identity_name: Push Test' \
  "identity_email: $CURRENT_EMAIL" \
  'credential_scope: remote_host' \
  'allowed_remote_url_patterns: []' \
  > "$FIXTURE_ROOT/ai-profile/fixture-push/commands/source-control/config.yml"

create_repo() {
  local name repo remote
  name="$1"
  repo="$FIXTURE_REPOS/$name"
  remote="$FIXTURE_ROOT/$name.git"
  git init --bare "$remote" >/dev/null
  git init "$repo" >/dev/null
  git -C "$repo" config user.email "$CURRENT_EMAIL"
  git -C "$repo" config user.name 'Push Test'
  printf '%s\n' "$name" > "$repo/file.txt"
  git -C "$repo" add file.txt
  git -C "$repo" commit -m initial >/dev/null
  git -C "$repo" remote add origin "$remote"
  printf '%s\n' "$repo"
}

run_push() {
  local repo
  repo="$1"
  (
    cd "$repo"
    AI_PROFILE_ROOT="$FIXTURE_ROOT/ai-profile" AI_WORK_PROFILE_ID=fixture-push AI_WORKFLOW_ID=dev "$FIXTURE_COMMAND"
  )
}

existing_repo=$(create_repo existing-upstream)
git -C "$existing_repo" push --set-upstream origin HEAD >/dev/null
printf '%s\n' existing >> "$existing_repo/file.txt"
git -C "$existing_repo" commit -am existing >/dev/null
run_push "$existing_repo"
git -C "$existing_repo" rev-parse '@{upstream}' >/dev/null

first_repo=$(create_repo first-push)
run_push "$first_repo"
git -C "$first_repo" rev-parse '@{upstream}' >/dev/null

detached_repo=$(create_repo detached)
git -C "$detached_repo" checkout --detach >/dev/null
if run_push "$detached_repo"; then
  echo 'detached HEAD unexpectedly pushed' >&2
  exit 1
fi

failure_repo=$(create_repo push-failure)
git -C "$failure_repo" remote set-url origin "$FIXTURE_ROOT/missing.git"
if run_push "$failure_repo"; then
  echo 'push failure unexpectedly succeeded' >&2
  exit 1
fi

check_repo=$(create_repo check-only)
(
  cd "$check_repo"
  AI_PROFILE_ROOT="$FIXTURE_ROOT/ai-profile" AI_WORK_PROFILE_ID=fixture-push AI_WORKFLOW_ID=dev "$FIXTURE_COMMAND" --check
)
if git -C "$check_repo" rev-parse '@{upstream}' >/dev/null 2>&1; then
  echo 'check-only unexpectedly established an upstream' >&2
  exit 1
fi

echo 'push command contract: PASS'
