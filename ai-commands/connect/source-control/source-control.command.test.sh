#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)
COMMAND="$ROOT_DIR/ai-commands/connect/source-control/source-control.command.md"
EXECUTABLE="$ROOT_DIR/ai-commands/connect/source-control/source-control.command.sh"

grep -Fq 'Execution route: `manager`.' "$COMMAND"
grep -Fq 'Command kind: `adapter`.' "$COMMAND"
grep -Fq 'Adapter layer: `provider-neutral`.' "$COMMAND"
grep -Fq '`source-control` is the provider-neutral command' "$COMMAND"
grep -Fq 'registered `git`' "$COMMAND"
grep -Fq 'commands-config/source-control/config.yml' "$COMMAND"
grep -Fq 'credential-check --repo' "$COMMAND"
grep -Fq 'Git AskPass' "$COMMAND"

for profile_id in example; do
  profile="$ROOT_DIR/ai-profile/$profile_id/$profile_id-work-profile.yml"
  config="$ROOT_DIR/ai-profile/$profile_id/commands-config/source-control/config.yml"
  grep -Fq '  - id: source-control' "$profile"
  grep -Fq '    config: commands-config/source-control/config.yml' "$profile"
  grep -Fq 'command: source-control' "$config"
  grep -Fq 'capability: git' "$config"
  grep -Fq 'registered_command: git' "$config"
done

fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT
mkdir -p "$fixture_dir/repo/.git" "$fixture_dir/bin"
cat >"$fixture_dir/bin/git" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$SOURCE_CONTROL_TEST_ARGS"
case "$*" in
  *'rev-parse --show-toplevel') printf '%s\n' "$SOURCE_CONTROL_TEST_REPO" ;;
  *'remote get-url origin') printf '%s\n' 'https://github.example.invalid/example/private.git' ;;
  *'ls-remote --exit-code origin HEAD')
    [[ -n "${SOURCE_CONTROL_USERNAME:-}" && -n "${SOURCE_CONTROL_TOKEN:-}" ]]
    [[ "$GIT_TERMINAL_PROMPT" == 0 && -x "$GIT_ASKPASS" ]]
    ;;
  *) exit 64 ;;
esac
SH
chmod +x "$fixture_dir/bin/git"
output="$(
  AI_CONFIG_PROJECT="$ROOT_DIR" \
  AI_WORK_PROFILE_ID=example \
  AI_FLOW_WORKFLOW=dev.workflow.md \
  SOURCE_CONTROL_TEST_ARGS="$fixture_dir/git-args" \
  SOURCE_CONTROL_TEST_REPO="$fixture_dir/repo" \
  SOURCE_CONTROL_USERNAME=example-user \
  SOURCE_CONTROL_TOKEN=synthetic-secret-token \
  PATH="$fixture_dir/bin:$PATH" \
  "$EXECUTABLE" credential-check --repo "$fixture_dir/repo"
)"
[[ "$output" == 'source-control credentials accepted: host=github.example.invalid repository=repo' ]]
if grep -Fq 'synthetic-secret-token' "$fixture_dir/git-args"; then
  echo 'credential must not appear in git arguments' >&2
  exit 1
fi

if rg -q '^source_control:' "$ROOT_DIR/ai-profile/example"; then
  echo 'profiles must bind the source-control command instead of defining a special source_control block' >&2
  exit 1
fi

echo 'source-control command contract: PASS'
