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

linux_output="$(env "${common_env[@]}" CLOUDFLARE_SERVICE_PLATFORM=Linux CLOUDFLARE_SERVICE_USER=example "$command_dir/controller-service.sh" render)"
[[ "$linux_output" == *'User=example'* ]]
[[ "$linux_output" == *'ExecStart='*'/service-runner.sh'* ]]
[[ "$linux_output" == *'Environment="CLOUDFLARE_UI_AUTOSTART=all"'* ]]
[[ "$linux_output" == *'Restart=always'* ]]
[[ "$linux_output" == *'WantedBy=multi-user.target'* ]]

printf 'Cloudflare controller service checks passed.\n'
