#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../../.." && pwd -P)"
operation="${1:-}"
apply="${2:-}"
platform="${CLOUDFLARE_SERVICE_PLATFORM:-$(uname -s)}"
service_id="com.aifleas.cloudflare-tunnels"
profile_id="${AI_WORK_PROFILE_ID:-${WORK_PROFILE_ID:-}}"
workflow="${AI_FLOW_WORKFLOW:-}"
config_project="${AI_CONFIG_PROJECT:-}"
autostart="${CLOUDFLARE_UI_AUTOSTART:-all}"
service_path="${CLOUDFLARE_SERVICE_PATH:-$PATH}"

fail() { printf 'BLOCKED_CLOUDFLARE_SERVICE: %s\n' "$1" >&2; exit 2; }
quote_xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
quote_systemd() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

[[ -n "$profile_id" && -n "$workflow" ]] || fail 'an activated profile and workflow are required'
[[ "$profile_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'profile ID is unsafe'
[[ "$workflow" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'workflow name is unsafe'
[[ "$config_project" == /* && -d "$config_project" ]] || fail 'AI_CONFIG_PROJECT must be an explicit absolute directory'

render_launchd() {
  local app="$script_dir/app.sh"
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$service_id</string>
  <key>ProgramArguments</key><array><string>$(quote_xml "$app")</string></array>
  <key>WorkingDirectory</key><string>$(quote_xml "$repo_root")</string>
  <key>EnvironmentVariables</key><dict>
    <key>AI_CONFIG_PROJECT</key><string>$(quote_xml "$config_project")</string>
    <key>AI_WORK_PROFILE_ID</key><string>$(quote_xml "$profile_id")</string>
    <key>AI_FLOW_WORKFLOW</key><string>$(quote_xml "$workflow")</string>
    <key>CLOUDFLARE_UI_AUTOSTART</key><string>$(quote_xml "$autostart")</string>
    <key>CLOUDFLARE_UI_START_HIDDEN</key><string>true</string>
    <key>PATH</key><string>$(quote_xml "$service_path")</string>
  </dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$(quote_xml "${CLOUDFLARE_SERVICE_LOG_DIR:-$HOME/Library/Logs/AI Fleas}/cloudflare-controller.out.log")</string>
  <key>StandardErrorPath</key><string>$(quote_xml "${CLOUDFLARE_SERVICE_LOG_DIR:-$HOME/Library/Logs/AI Fleas}/cloudflare-controller.err.log")</string>
</dict></plist>
EOF
}

render_systemd() {
  local user_name="${CLOUDFLARE_SERVICE_USER:-${SUDO_USER:-$(id -un)}}"
  [[ "$user_name" =~ ^[a-z_][a-z0-9_-]*$ ]] || fail 'service user is unsafe'
  cat <<EOF
[Unit]
Description=AI Fleas profile-aware Cloudflare tunnel controller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(quote_systemd "$user_name")
WorkingDirectory=$(quote_systemd "$repo_root")
Environment="AI_CONFIG_PROJECT=$(quote_systemd "$config_project")"
Environment="AI_WORK_PROFILE_ID=$(quote_systemd "$profile_id")"
Environment="AI_FLOW_WORKFLOW=$(quote_systemd "$workflow")"
Environment="CLOUDFLARE_UI_AUTOSTART=$(quote_systemd "$autostart")"
Environment="PATH=$(quote_systemd "$service_path")"
ExecStart=$(quote_systemd "$script_dir/service-runner.sh")
Restart=always
RestartSec=3
KillMode=control-group

[Install]
WantedBy=multi-user.target
EOF
}

case "$operation" in
  render)
    case "$platform" in Darwin) render_launchd ;; Linux) render_systemd ;; *) fail "unsupported platform: $platform" ;; esac
    ;;
  install)
    [[ "$apply" == '--apply' && $# -eq 2 ]] || fail 'install requires the exact --apply flag'
    case "$platform" in
      Darwin)
        target="${CLOUDFLARE_LAUNCHD_DIR:-$HOME/Library/LaunchAgents}/$service_id.plist"
        log_dir="${CLOUDFLARE_SERVICE_LOG_DIR:-$HOME/Library/Logs/AI Fleas}"
        mkdir -p "$(dirname "$target")" "$log_dir"
        temp="$(mktemp)"; trap 'rm -f "$temp"' EXIT
        render_launchd >"$temp"
        plutil -lint "$temp" >/dev/null
        launchctl bootout "gui/$(id -u)/$service_id" 2>/dev/null || true
        install -m 600 "$temp" "$target"
        launchctl bootstrap "gui/$(id -u)" "$target"
        printf 'Installed macOS LaunchAgent: %s\n' "$target"
        ;;
      Linux)
        [[ -r /etc/os-release ]] || fail 'Linux distribution cannot be identified'
        # shellcheck disable=SC1091
        source /etc/os-release
        [[ "${ID:-}" == ubuntu ]] || fail 'automatic Linux service installation currently supports Ubuntu only'
        target="${CLOUDFLARE_SYSTEMD_DIR:-/etc/systemd/system}/ai-fleas-cloudflare-tunnels.service"
        temp="$(mktemp)"; trap 'rm -f "$temp"' EXIT
        render_systemd >"$temp"
        if [[ -n "${CLOUDFLARE_SYSTEMD_DIR:-}" ]]; then
          mkdir -p "$CLOUDFLARE_SYSTEMD_DIR"; install -m 644 "$temp" "$target"
        else
          command -v sudo >/dev/null 2>&1 || fail 'sudo is required for system service installation'
          sudo install -m 644 "$temp" "$target"
          sudo systemctl daemon-reload
          sudo systemctl enable --now ai-fleas-cloudflare-tunnels.service
        fi
        printf 'Installed Ubuntu systemd service: %s\n' "$target"
        ;;
      *) fail "unsupported platform: $platform" ;;
    esac
    ;;
  *) fail 'usage: controller-service.sh render | install --apply' ;;
esac
