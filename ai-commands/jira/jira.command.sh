#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "jira" || exit $?
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  cat <<'USAGE'
Usage:
  jira.command.sh template
  jira.command.sh current-sprint
  jira.command.sh get ISSUE-KEY --output-dir DIR
  jira.command.sh search --project KEY --issue-type TYPE --summary-exact TEXT --label LABEL --output-dir DIR
  jira.command.sh list-by-status --project KEY --status STATUS --output-dir DIR
  jira.command.sh create [ticket options]
  jira.command.sh clone ISSUE-KEY [ticket options]
  jira.command.sh update ISSUE-KEY --description-file FILE [--summary TEXT] [--submit|--validate-only]
  jira.command.sh comment ISSUE-KEY (--body TEXT|--comment-file FILE) [--mention USER] [--link "LABEL|URL"] [--skip-if-link-exists] [--submit|--validate-only]
  jira.command.sh set-in-progress ISSUE-KEY [--submit|--validate-only]
  jira.command.sh delete-owned-comment ISSUE-KEY --comment-id ID [--submit|--validate-only]
  jira.command.sh sync-plan [ISSUE-KEY] [--session-plan FILE] [--submit|--validate-only]

Legacy flag-based create/clone/update arguments remain supported.
USAGE
}

case "${1:-}" in
  list-by-status)
    shift
    exec bash "$SCRIPT_DIR/jira-list-by-status.sh" "$@"
    ;;
  search)
    shift
    exec "$SCRIPT_DIR/jira-ticket-search.sh" "$@"
    ;;
  get)
    shift
    ISSUE_KEY="${1:-}"
    [[ "$ISSUE_KEY" =~ ^[A-Z][A-Z0-9_]*-[0-9]+$ ]] || { echo "get requires a valid ISSUE-KEY" >&2; exit 2; }
    shift
    exec "$SCRIPT_DIR/jira-ticket-read.sh" "$ISSUE_KEY" "$@"
    ;;
  current-sprint)
    [[ $# -eq 1 ]] || { echo "The current-sprint subcommand does not accept arguments." >&2; exit 2; }
    exec "$SCRIPT_DIR/current-sprint.sh"
    ;;
  template|--template)
    if [[ $# -ne 1 ]]; then
      echo "The template subcommand does not accept ticket arguments." >&2
      exit 2
    fi
    CONF_FILE="${JIRA_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"
    source "$SCRIPT_DIR/jira-load-config.sh"
    jira_load_machine_config "$CONF_FILE"
    TEMPLATE_FILE="${JIRA_DESCRIPTION_TEMPLATE_FILE:-}"
    if [[ -z "$TEMPLATE_FILE" || ! -f "$TEMPLATE_FILE" ]]; then
      echo "Jira ticket formatting belongs to the active profile; configure JIRA_DESCRIPTION_TEMPLATE_FILE." >&2
      exit 2
    fi
    cat "$TEMPLATE_FILE"
    ;;
  create)
    shift
    exec "$SCRIPT_DIR/create-ticket.sh" "$@"
    ;;
  clone)
    shift
    exec "$SCRIPT_DIR/clone-ticket.sh" "$@"
    ;;
  update)
    shift
    exec "$SCRIPT_DIR/update-ticket.sh" "$@"
    ;;
  comment)
    shift
    exec "$SCRIPT_DIR/add-comment.sh" "$@"
    ;;
  set-in-progress)
    shift
    ISSUE_KEY="${1:-}"
    [[ -n "$ISSUE_KEY" && "$ISSUE_KEY" != --* ]] || { echo "set-in-progress requires ISSUE-KEY" >&2; exit 2; }
    shift
    exec "$SCRIPT_DIR/set-in-progress.sh" --issue "$ISSUE_KEY" "$@"
    ;;
  delete-owned-comment)
    shift
    ISSUE_KEY="${1:-}"
    [[ -n "$ISSUE_KEY" && "$ISSUE_KEY" != --* ]] || { echo "delete-owned-comment requires ISSUE-KEY" >&2; exit 2; }
    shift
    exec "$SCRIPT_DIR/delete-owned-comment.sh" --issue "$ISSUE_KEY" "$@"
    ;;
  sync-plan)
    shift
    exec "$SCRIPT_DIR/sync-plan.sh" "$@"
    ;;
  --help|-h)
    usage
    ;;
  '')
    usage >&2
    exit 2
    ;;
  *)
    # Backward compatibility for existing scripts using --project, --clone, or --update.
    exec "$SCRIPT_DIR/jira-ticket-runner.sh" "$@"
    ;;
esac
