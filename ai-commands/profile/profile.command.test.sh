#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base="$($SCRIPT_DIR/profile.command.sh --profile example --workflow dev.workflow.md --command source-control)"
grep -Fq 'PROFILE_ID=example' <<< "$base"
grep -Fq 'LOGICAL_PROJECT_ID=example-dev' <<< "$base"
grep -Fq 'AI_AGENT_PLATFORM=gpt-app' <<< "$base"
grep -Fq 'AI_AGENT_PLATFORM_CONTRACT=' <<< "$base"
grep -Fq '/platforms/gpt-app/platform.yml' <<< "$base"
grep -Fq 'AI_GOVERNANCE_RULES_REPOSITORY=example-governance-rules' <<< "$base"
instance="$($SCRIPT_DIR/profile.command.sh --profile example --workflow dev.workflow.md --instance SC-1234)"
grep -Fq 'WORKFLOW_INSTANCE_ID=SC-1234' <<< "$instance"
grep -Fq 'LOGICAL_PROJECT_ID=example-dev-SC-1234' <<< "$instance"
if "$SCRIPT_DIR/profile.command.sh" --profile example --workflow dev.workflow.md --instance '../unsafe' >/dev/null 2>&1; then
  echo 'unsafe workflow instance was accepted' >&2; exit 1
fi
echo 'profile command tests passed'
