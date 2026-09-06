#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONF_FILE="${JIRA_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"
source "$SCRIPT_DIR/jira-load-config.sh"
jira_load_machine_config "$CONF_FILE"
JIRA_CURRENT_SPRINT_BOARD_URL="${JIRA_CURRENT_SPRINT_BOARD_URL:-https://jira.example.invalid/secure/RapidBoard.jspa?rapidView=0&projectKey=EXAMPLE&quickFilter=0}"
printf 'JIRA_CURRENT_SPRINT_BOARD_URL: %s\n' "$JIRA_CURRENT_SPRINT_BOARD_URL"
printf 'Choose a relevant visible current-sprint issue as the clone source to preserve sprint membership.\n'
