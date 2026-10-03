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
  if [[ "$branch" != "main" ]]; then
    print "AI Fleas source update skipped on ${branch:-detached checkout}; launching the checked-out version."
    return
  fi

  dirty="$("$git_bin" -C "$repository_root" status --porcelain)"
  if [[ -n "$dirty" ]]; then
    print "AI Fleas source update skipped: the visible checkout has local changes. Launching the checked-out version without altering them."
    return
  fi

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

ensure_gpt_runtime_dependencies() {
  if node -e 'const { createRequire } = require("node:module"); const load = createRequire(process.argv[1] + "/package.json"); process.exit(load("yaml/package.json").version === "2.9.0" ? 0 : 1)' "$gpt_agents_root" 2>/dev/null; then
    return
  fi
  command -v npm >/dev/null || {
    print -u2 "AI_FLEAS_GPT_BLOCKED: npm is required to install the GPT adapter's pinned YAML runtime."
    exit 1
  }
  npm ci --prefix "$gpt_agents_root" --omit=dev --ignore-scripts --no-audit
}

enable_trusted_chatgpt_updates() {
  "$defaults_bin" write com.openai.codex SUEnableAutomaticChecks -bool true
  "$defaults_bin" write com.openai.codex SUAutomaticallyUpdate -bool true
}

update_ai_fleas "$@"
ensure_gpt_runtime_dependencies
enable_trusted_chatgpt_updates

node "$launcher" setup --migrate "$@"
node "$launcher" doctor
exec node "$launcher" launch
