#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Darwin ]] || { printf 'SCREENSHOT_SORTER_BLOCKED: macOS is required\n' >&2; exit 2; }
command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$command_dir/../../_runtime/profile/command-profile.guard.sh"
ai_command_require_profile macos-screenshot-sorter

# Profile-owned configuration selects the private source, destination, label,
# and log paths. This public command never embeds a machine-specific path.
# The config file may be YAML (.yml/.yaml) or shell .env format - parse accordingly.
ai_config_path="$AI_COMMAND_CONFIG_PATH"
case "$ai_config_path" in
  *.yml|*.yaml)
    # Try to detect if it's shell format (key=value) or actual YAML (key: value)
    # Parse as shell .env format with comments, extract KEY=VALUE pairs
    while IFS= read -r line || [[ -n "$line" ]]; do
      # Skip empty lines and comments (lines starting with #)
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      # Skip lines that don't match KEY=VALUE pattern (for YAML compatibility)
      [[ "$line" =~ ^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*= ]] || continue
      # Extract key and value, handling quoted values
      key="${line%%=*}"
      value="${line#*=}"
      # Remove surrounding quotes if present (handle both " and ')
      case "$value" in
        \"*\") value="${value:1:${#value}-2}" ;;
        \'*\') value="${value:1:${#value}-2}" ;;
      esac
      export "$key=$value"
    done < "$ai_config_path"
    ;;
  *)
    # Shell .env format - source directly
    # shellcheck disable=SC1090
    source "$ai_config_path"
    ;;
esac

: "${SCREENSHOT_SORTER_SOURCE_DIR:?profile config must set SCREENSHOT_SORTER_SOURCE_DIR}"
: "${SCREENSHOT_SORTER_DESTINATION_DIR:?profile config must set SCREENSHOT_SORTER_DESTINATION_DIR}"
: "${SCREENSHOT_SORTER_LABEL:?profile config must set SCREENSHOT_SORTER_LABEL}"
: "${SCREENSHOT_SORTER_LAUNCH_AGENTS_DIR:?profile config must set SCREENSHOT_SORTER_LAUNCH_AGENTS_DIR}"
: "${SCREENSHOT_SORTER_LOG_DIR:?profile config must set SCREENSHOT_SORTER_LOG_DIR}"
: "${SCREENSHOT_SORTER_PYTHON:?profile config must set SCREENSHOT_SORTER_PYTHON}"
: "${SCREENSHOT_SORTER_SETTLE_SECONDS:?profile config must set SCREENSHOT_SORTER_SETTLE_SECONDS}"
: "${SCREENSHOT_SORTER_START_INTERVAL_SECONDS:?profile config must set SCREENSHOT_SORTER_START_INTERVAL_SECONDS}"
label="$SCREENSHOT_SORTER_LABEL"
launch_agents_dir="$SCREENSHOT_SORTER_LAUNCH_AGENTS_DIR"
log_dir="$SCREENSHOT_SORTER_LOG_DIR"
plist="$launch_agents_dir/$label.plist"
python_bin="$SCREENSHOT_SORTER_PYTHON"
settle_seconds="$SCREENSHOT_SORTER_SETTLE_SECONDS"
start_interval_seconds="$SCREENSHOT_SORTER_START_INTERVAL_SECONDS"
legacy_label="${SCREENSHOT_SORTER_LEGACY_LABEL:-}"
legacy_plist="${SCREENSHOT_SORTER_LEGACY_PLIST:-}"

fail() { printf 'SCREENSHOT_SORTER_BLOCKED: %s\n' "$1" >&2; exit 2; }
xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
domain="gui/$(id -u)"
[[ "$start_interval_seconds" =~ ^[0-9]+$ ]] || fail 'start interval must be an integer'
[[ "$start_interval_seconds" == 0 || ( "$start_interval_seconds" -ge 10 && "$start_interval_seconds" -le 3600 ) ]] || fail 'start interval must be 0 or 10–3600 seconds'
[[ "$settle_seconds" =~ ^[0-9]+$ ]] || fail 'settle delay must be an integer'
[[ "$settle_seconds" -ge 0 && "$settle_seconds" -le 60 ]] || fail 'settle delay must be 0–60 seconds'

render() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$(xml "$label")</string>
  <key>ProgramArguments</key><array>
    <string>$(xml "$python_bin")</string><string>$(xml "$command_dir/macos-screenshot-sorter.py")</string>
    <string>--source-dir</string><string>$(xml "$SCREENSHOT_SORTER_SOURCE_DIR")</string>
    <string>--destination-dir</string><string>$(xml "$SCREENSHOT_SORTER_DESTINATION_DIR")</string>
    <string>--settle-seconds</string><string>$(xml "$settle_seconds")</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>WatchPaths</key><array><string>$(xml "$SCREENSHOT_SORTER_SOURCE_DIR")</string></array>
$(if [[ "$start_interval_seconds" != 0 ]]; then printf '  <key>StartInterval</key><integer>%s</integer>\n' "$start_interval_seconds"; fi)
  <key>StandardOutPath</key><string>$(xml "$log_dir/$label.out.log")</string>
  <key>StandardErrorPath</key><string>$(xml "$log_dir/$label.err.log")</string>
</dict></plist>
EOF
}

case "${1:-sort}" in
  probe)
    [[ $# -eq 1 ]] || fail 'probe takes no options'
    printf 'source_dir=%s\n' "$SCREENSHOT_SORTER_SOURCE_DIR"
    printf 'destination_dir=%s\n' "$SCREENSHOT_SORTER_DESTINATION_DIR"
    printf 'candidate_label=%s\n' "$label"
    printf 'candidate_plist=%s\n' "$plist"
    printf 'candidate_stdout=%s\n' "$log_dir/$label.out.log"
    printf 'candidate_stderr=%s\n' "$log_dir/$label.err.log"
    printf 'settle_seconds=%s\n' "$settle_seconds"
    printf 'start_interval_seconds=%s\n' "$start_interval_seconds"
    printf 'legacy_label=%s\n' "$legacy_label"
    printf 'legacy_plist=%s\n' "$legacy_plist"
    ;;
  ui)
    [[ $# -eq 1 || ( $# -eq 2 && "$2" == '--force' ) ]] || fail 'ui takes no options except --force'
    : "${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN for the UI}"
    export SCREENSHOT_SORTER_ELECTRON_BIN
    export AI_COMMAND_CONFIG_PATH
    if [[ $# -eq 2 ]]; then exec "$command_dir/app.sh" --force; fi
    exec "$command_dir/app.sh"
    ;;
  install-app)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || fail 'install-app requires the exact --apply flag'
    : "${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN for the UI}"
    export SCREENSHOT_SORTER_ELECTRON_BIN
    exec "$command_dir/launcher/install-macos-app.sh"
    ;;
  build-app)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || fail 'build-app requires the exact --apply flag'
    : "${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN for the UI}"
    export SCREENSHOT_SORTER_ELECTRON_BIN
    exec "$command_dir/launcher/build-macos.sh" --output "$HOME/Applications/Screenshot Sorter.app" --replace
    ;;
  sort|migrate)
    shift || true
    exec "$python_bin" "$command_dir/macos-screenshot-sorter.py" --source-dir "$SCREENSHOT_SORTER_SOURCE_DIR" --destination-dir "$SCREENSHOT_SORTER_DESTINATION_DIR" --settle-seconds "$settle_seconds" "$@"
    ;;
  render-launchagent)
    [[ $# -eq 1 ]] || fail 'render-launchagent takes no options'
    render
    ;;
  install)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || fail 'install requires the exact --apply flag'
    [[ "$(uname -s)" == Darwin ]] || fail 'install supports macOS only'
    mkdir -p "$launch_agents_dir" "$log_dir"
    candidate="$plist.candidate"
    render >"$candidate"
    plutil -lint "$candidate" >/dev/null || { rm -f "$candidate"; fail 'generated LaunchAgent plist is invalid'; }
    mv -f "$candidate" "$plist"
    launchctl bootout "$domain/$label" 2>/dev/null || true
    launchctl bootstrap "$domain" "$plist"
    printf 'Installed candidate LaunchAgent: %s\n' "$plist"
    ;;
  uninstall)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || fail 'uninstall requires the exact --apply flag'
    launchctl bootout "$domain/$label" 2>/dev/null || true
    rm -f "$plist"
    printf 'Removed candidate LaunchAgent: %s\n' "$plist"
    ;;
  suspend-legacy)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || fail 'suspend-legacy requires the exact --apply flag'
    [[ -n "$legacy_label" ]] || fail 'profile config must set SCREENSHOT_SORTER_LEGACY_LABEL'
    launchctl bootout "$domain/$legacy_label"
    printf 'Suspended legacy LaunchAgent without deleting its plist: %s\n' "$legacy_label"
    ;;
  restore-legacy)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || fail 'restore-legacy requires the exact --apply flag'
    [[ -n "$legacy_label" && -n "$legacy_plist" ]] || fail 'profile config must set legacy label and plist'
    [[ -f "$legacy_plist" ]] || fail 'configured legacy plist does not exist'
    launchctl bootstrap "$domain" "$legacy_plist"
    printf 'Restored legacy LaunchAgent: %s\n' "$legacy_label"
    ;;
  *)
    fail 'usage: macos-screenshot-sorter.command.sh [probe|ui [--force]|install-app --apply|build-app --apply|sort|migrate|render-launchagent|install --apply|uninstall --apply|suspend-legacy --apply|restore-legacy --apply]'
    ;;
esac
