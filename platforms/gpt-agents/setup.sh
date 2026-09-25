#!/bin/zsh
set -euo pipefail

gpt_agents_root="$(cd "$(dirname "$0")" && pwd -P)"
repository_root="$(cd "$gpt_agents_root/../.." && pwd -P)"
launcher="$gpt_agents_root/launcher.mjs"
git_bin="${AI_FLEAS_GIT_BIN:-git}"
defaults_bin="${AI_FLEAS_DEFAULTS_BIN:-defaults}"

update_ai_fleas() {
  if [[ "${AI_FLEAS_SKIP_SOURCE_UPDATE:-0}" == "1" ]]; then
    return
  fi

  local branch dirty before after
  branch="$("$git_bin" -C "$repository_root" branch --show-current)"
  [[ "$branch" == "main" ]] || {
    print -u2 "AI_FLEAS_GPT_BLOCKED: automatic updates require the main branch; current branch is ${branch:-detached}."
    exit 1
  }

  dirty="$("$git_bin" -C "$repository_root" status --porcelain)"
  [[ -z "$dirty" ]] || {
    print -u2 "AI_FLEAS_GPT_BLOCKED: automatic updates require a clean AI Fleas checkout."
    exit 1
  }

  before="$("$git_bin" -C "$repository_root" rev-parse HEAD)"
  "$git_bin" -C "$repository_root" fetch origin main
  "$git_bin" -C "$repository_root" merge-base --is-ancestor HEAD origin/main || {
    print -u2 "AI_FLEAS_GPT_BLOCKED: local main has commits or divergence; review it before updating."
    exit 1
  }
  "$git_bin" -C "$repository_root" merge --ff-only origin/main
  after="$("$git_bin" -C "$repository_root" rev-parse HEAD)"

  if [[ "$before" != "$after" ]]; then
    AI_FLEAS_SKIP_SOURCE_UPDATE=1 exec "$repository_root/platforms/gpt-agents/setup.sh" "$@"
  fi
}

enable_trusted_chatgpt_updates() {
  "$defaults_bin" write com.openai.codex SUEnableAutomaticChecks -bool true
  "$defaults_bin" write com.openai.codex SUAutomaticallyUpdate -bool true
}

update_ai_fleas "$@"
enable_trusted_chatgpt_updates

node "$launcher" setup --migrate "$@"
node "$launcher" doctor
exec node "$launcher" launch
