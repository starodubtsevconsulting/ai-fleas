#!/usr/bin/env bash

# Load optional machine-local Jira settings without overriding canonical values
# already resolved and exported from the active profile.
jira_load_machine_config() {
  local config_file="$1"
  [[ -f "$config_file" ]] || return 0

  local -a profile_owned=(
    JIRA_BASE_URL
    JIRA_BROWSE_BASE_URL
    JIRA_ISSUE_KEY_PATTERN
    JIRA_STORY_POINTS_FIELD_ID
    JIRA_BROWSER_MODE
    JIRA_CURRENT_SPRINT_BOARD_URL
    JIRA_DESCRIPTION_TEMPLATE_FILE
  )
  local -a saved_names=()
  local -a saved_values=()
  local name
  for name in "${profile_owned[@]}"; do
    if [[ -n "${!name+x}" ]]; then
      saved_names+=("$name")
      saved_values+=("${!name}")
    fi
  done

  # shellcheck disable=SC1090
  source "$config_file"

  local index
  for ((index = 0; index < ${#saved_names[@]}; index += 1)); do
    name="${saved_names[$index]}"
    printf -v "$name" '%s' "${saved_values[$index]}"
    export "$name"
  done
}
