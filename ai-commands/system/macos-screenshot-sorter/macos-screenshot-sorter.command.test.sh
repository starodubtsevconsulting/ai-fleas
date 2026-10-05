#!/usr/bin/env bash
# Run: bash macos-screenshot-sorter.command.test.sh
# A passing result verifies deterministic sorting, collision allocation, and plist
# rendering. It does not verify macOS TCC, a GUI login, or a real screenshot capture.
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$dir/../../.." && pwd -P)"
work="$dir/test-work"
source_dir="$work/source"
destination_dir="$work/destination"
rm -rf "$work"
mkdir -p "$source_dir" "$destination_dir/2026-10-05"
trap 'rm -rf "$work"' EXIT

printf 'first' >"$source_dir/Screenshot 2026-10-05 at 10.00.00.png"
printf 'second' >"$source_dir/Screen Shot 2026-10-05 at 10.00.01.png"
printf 'unrelated' >"$source_dir/holiday.png"
printf 'existing' >"$destination_dir/2026-10-05/Screenshot 2026-10-05 at 10.00.00.png"
touch -t 202610051200 "$source_dir/holiday.png"

"${PYTHON:-python3}" "$dir/macos-screenshot-sorter.py" --source-dir "$source_dir" --destination-dir "$destination_dir" >"$work/result.jsonl"
[[ -f "$destination_dir/2026-10-05/Screenshot 2026-10-05 at 10.00.00 (1).png" ]]
[[ -f "$destination_dir/2026-10-05/Screen Shot 2026-10-05 at 10.00.01.png" ]]
[[ "$(<"$destination_dir/2026-10-05/Screenshot 2026-10-05 at 10.00.00.png")" == existing ]]
[[ -f "$source_dir/holiday.png" ]]
[[ ! -e "$source_dir/Screenshot 2026-10-05 at 10.00.00.png" ]]
"${PYTHON:-python3}" "$dir/macos-screenshot-sorter.py" --source-dir "$source_dir" --destination-dir "$destination_dir" | grep -Fq '"moved": 0'
grep -Fq 'requestSingleInstanceLock' "$dir/launcher/electron/main.cjs"
grep -Fq 'app.exit(0)' "$dir/launcher/electron/main.cjs"
grep -Fq '2026-09-18-ai-fleas-human-led-demo-header.png' "$dir/launcher/renderer/index.html"
grep -Fq 'A person and an AI Fleas robot working together at a desk' "$dir/launcher/renderer/index.html"
grep -Fq 'Run against any authorized profile' "$dir/macos-screenshot-sorter.command.md"
grep -Fq 'ui --force' "$dir/macos-screenshot-sorter.command.md"
grep -Fq 'exact existing Screenshot Sorter process' "$dir/macos-screenshot-sorter.command.md"
grep -Fq "pattern='[m]acos-screenshot-sorter/launcher/electron/main\\\\.cjs'" "$dir/app.sh"
grep -Fq 'Do not bypass these checks by exporting `AI_COMMAND_CONFIG_PATH` directly.' "$dir/macos-screenshot-sorter.command.md"
grep -Fq "ipcMain.handle('sorter:library', screenshotLibrary)" "$dir/launcher/electron/main.cjs"
grep -Fq "ipcMain.handle('sorter:thumbnail', screenshotThumbnail)" "$dir/launcher/electron/main.cjs"
grep -Fq 'data-tab="library"' "$dir/launcher/renderer/index.html"
grep -Fq "thumbnail: (id) => ipcRenderer.invoke('sorter:thumbnail', id)" "$dir/launcher/electron/preload.cjs"

mkdir -p "$work/ai-profile/test"
touch "$work/marker"
cat >"$work/ai-profile/test/test-work-profile.yml" <<EOF
name: test
default_workflow: test.workflow.md
platforms:
  default: codex-cli
  available:
    - codex-cli
ai_commands_root: $dir/../..
ai_workflows_root: $dir/../../../ai-workflows
ai_platforms_root: $repo_root/platforms
governance_rules_repository: test
governance_rules_surface:
  - marker
commands:
  - id: macos-screenshot-sorter
    config: config.env
workflows:
  - path: test.workflow.md
    platform: codex-cli
    commands:
      - macos-screenshot-sorter
EOF
cat >"$work/ai-profile/test/config.env" <<EOF
SCREENSHOT_SORTER_SOURCE_DIR="$source_dir"
SCREENSHOT_SORTER_DESTINATION_DIR="$destination_dir"
SCREENSHOT_SORTER_LABEL="org.example.test"
SCREENSHOT_SORTER_LAUNCH_AGENTS_DIR="$work/LaunchAgents"
SCREENSHOT_SORTER_LOG_DIR="$work/logs"
SCREENSHOT_SORTER_PYTHON="/usr/bin/python3"
SCREENSHOT_SORTER_SETTLE_SECONDS=0
SCREENSHOT_SORTER_START_INTERVAL_SECONDS=10
EOF
rendered="$work/candidate.plist"
AI_CONFIG_PROJECT="$work" AI_WORK_PROFILE_ID=test AI_FLOW_WORKFLOW=test.workflow.md AI_AGENT_PLATFORM=codex-cli \
  bash "$dir/macos-screenshot-sorter.command.sh" render-launchagent >"$rendered"
if command -v plutil >/dev/null 2>&1; then plutil -lint "$rendered" >/dev/null; fi
grep -Fq "$dir/macos-screenshot-sorter.py" "$rendered"
grep -Fq "$source_dir" "$rendered"
grep -Fq "$destination_dir" "$rendered"
grep -Fq '<key>StartInterval</key><integer>10</integer>' "$rendered"
probe="$work/probe.txt"
AI_CONFIG_PROJECT="$work" AI_WORK_PROFILE_ID=test AI_FLOW_WORKFLOW=test.workflow.md AI_AGENT_PLATFORM=codex-cli \
  bash "$dir/macos-screenshot-sorter.command.sh" probe >"$probe"
grep -Fqx "source_dir=$source_dir" "$probe"
grep -Fqx "destination_dir=$destination_dir" "$probe"
grep -Fqx 'candidate_label=org.example.test' "$probe"
grep -Fqx 'settle_seconds=0' "$probe"
grep -Fqx 'start_interval_seconds=10' "$probe"
printf '%s\n' 'macos-screenshot-sorter tests: PASS'
