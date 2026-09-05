#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
COMMAND="$ROOT_DIR/ai-commands/source-control/source-control.command.md"

grep -Fq 'Execution route: `manager`.' "$COMMAND"
grep -Fq 'Command kind: `adapter`.' "$COMMAND"
grep -Fq 'Adapter layer: `provider-neutral`.' "$COMMAND"
grep -Fq '`source-control` is the provider-neutral command' "$COMMAND"
grep -Fq 'registered `git`' "$COMMAND"
grep -Fq 'commands/source-control/config.yml' "$COMMAND"

for profile_id in example sc; do
  profile="$ROOT_DIR/ai-profile/$profile_id/$profile_id-work-profile.yml"
  config="$ROOT_DIR/ai-profile/$profile_id/commands/source-control/config.yml"
  grep -Fq '  - id: source-control' "$profile"
  grep -Fq '    config: commands/source-control/config.yml' "$profile"
  grep -Fq 'command: source-control' "$config"
  grep -Fq 'capability: git' "$config"
  grep -Fq 'registered_command: git' "$config"
done

if rg -q '^source_control:' "$ROOT_DIR/ai-profile/example" "$ROOT_DIR/ai-profile/sc"; then
  echo 'profiles must bind the source-control command instead of defining a special source_control block' >&2
  exit 1
fi

echo 'source-control command contract: PASS'
