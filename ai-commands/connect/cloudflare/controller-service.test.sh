#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT
common_env=(
  AI_WORK_PROFILE_ID=example
  AI_FLOW_WORKFLOW=dev.workflow.md
  AI_CONFIG_PROJECT="$(cd "$command_dir/../../.." && pwd -P)"
)

mac_output="$(env "${common_env[@]}" CLOUDFLARE_SERVICE_PLATFORM=Darwin "$command_dir/controller-service.sh" render)"
[[ "$mac_output" == *'<key>RunAtLoad</key><true/>'* ]]
[[ "$mac_output" == *'<key>KeepAlive</key><true/>'* ]]
[[ "$mac_output" == *'CLOUDFLARE_UI_START_HIDDEN'* ]]
[[ "$mac_output" == *'<key>PATH</key><string>'* ]]
[[ "$mac_output" == *'<key>AI_CONFIG_PROJECT</key><string>'* ]]
[[ "$mac_output" == *"${common_env[2]#AI_CONFIG_PROJECT=}"* ]]

if env -u AI_CONFIG_PROJECT AI_WORK_PROFILE_ID=example AI_FLOW_WORKFLOW=dev.workflow.md \
  CLOUDFLARE_SERVICE_PLATFORM=Darwin "$command_dir/controller-service.sh" render >/dev/null 2>&1; then
  printf '%s\n' 'expected an implicit controller project binding to fail' >&2
  exit 1
fi

linux_output="$(env "${common_env[@]}" CLOUDFLARE_SERVICE_PLATFORM=Linux CLOUDFLARE_SERVICE_USER=example "$command_dir/controller-service.sh" render)"
[[ "$linux_output" == *'User=example'* ]]
[[ "$linux_output" == *'ExecStart='*'/service-runner.sh'* ]]
[[ "$linux_output" == *'Environment="CLOUDFLARE_UI_AUTOSTART=all"'* ]]
[[ "$linux_output" == *'Environment="AI_FLEAS_RUNTIME_LOCK_DIR=/run/ai-fleas-cloudflare-tunnels"'* ]]
[[ "$linux_output" == *'Environment="CLOUDFLARE_CONTROLLER_STATE_DIR=/var/lib/ai-fleas-cloudflare-tunnels"'* ]]
[[ "$linux_output" == *'Environment="PATH='* ]]
[[ "$linux_output" == *'Restart=always'* ]]
[[ "$linux_output" == *'RuntimeDirectory=ai-fleas-cloudflare-tunnels'* ]]
[[ "$linux_output" == *'RuntimeDirectoryMode=0700'* ]]
[[ "$linux_output" == *'StateDirectory=ai-fleas-cloudflare-tunnels'* ]]
[[ "$linux_output" == *'StateDirectoryMode=0700'* ]]
[[ "$linux_output" == *'WantedBy=multi-user.target'* ]]

grep -Fq 'X-GNOME-Autostart-enabled=true' "$command_dir/controller-service.sh"
grep -Fq 'CLOUDFLARE_UI_SERVICE_CONTROL=systemd' "$command_dir/controller-service.sh"
grep -Fq 'systemctl restart ai-fleas-cloudflare-tunnels.service' "$command_dir/controller-service.sh"

printf 'Cloudflare controller service checks passed.\n'
