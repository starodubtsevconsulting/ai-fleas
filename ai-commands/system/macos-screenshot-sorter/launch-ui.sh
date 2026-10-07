#!/usr/bin/env bash
# Launch the Screenshot Sorter app with proper config
# Usage: ./launch-ui.sh [--force]

set -euo pipefail

# Source the profile guard to get AI_COMMAND_CONFIG_PATH
source /Users/sergii/projects/sc/ai-fleas/ai-commands/_runtime/profile/command-profile.guard.sh

# Set profile context
AI_WORK_PROFILE_ID=sc
AI_FLOW_WORKFLOW=dev.workflow.md

# Only activate profile if not already set
if [[ -z "${AI_COMMAND_CONFIG_PATH:-}" ]]; then
  ai_command_require_profile_only macos-screenshot-sorter
fi

# Parse the config file to set environment variables
source /Users/sergii/projects/sc/ai-fleas/ai-commands/system/macos-screenshot-sorter/parse-config.sh "$AI_COMMAND_CONFIG_PATH"

# Get the command directory from the config
command_dir="/Users/sergii/projects/sc/ai-fleas/ai-commands/system/macos-screenshot-sorter"

# Set the command dir if not already set
if [[ -z "${SCREENSHOT_SORTER_COMMAND_DIR:-}" ]]; then
  export SCREENSHOT_SORTER_COMMAND_DIR="$command_dir"
fi

# Launch the app
# app.sh only accepts --force or no args; strip 'ui' if passed
args=()
for arg in "$@"; do
  if [[ "$arg" == "--force" ]]; then
    args+=("--force")
  fi
done
exec bash "$command_dir/app.sh" "${args[@]}"
