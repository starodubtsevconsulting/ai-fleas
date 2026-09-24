#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
script="$command_dir/cloudflare-connector.command.sh"
commands_root="$(cd "$command_dir/../.." && pwd -P)"
repository_root="$(cd "$commands_root/.." && pwd -P)"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

export AI_PROFILE_FILE="$repository_root/ai-profile/example/example-work-profile.yml"
export AI_WORK_PROFILE_ID=example
export AI_FLOW_WORKFLOW=dev.workflow.md
export AI_COMMANDS_ROOT="$commands_root"

grep -q 'install requires the exact --apply flag' "$script"
grep -q 'brew install cloudflared' "$script"
grep -q 'apt-get install -y cloudflared' "$script"
grep -q 'https://pkg.cloudflare.com/cloudflare-main.gpg' "$script"
grep -q 'ai_command_require_profile "cloudflare-connector"' "$script"
grep -q 'Installation does not start a connector' "$command_dir/cloudflare-connector.command.md"

mkdir -p "$fixture_dir/bin"
cat >"$fixture_dir/bin/brew" <<'BREW'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == 'install cloudflared' ]]
cat >"$(dirname "$0")/cloudflared" <<'CLOUDFLARED'
#!/usr/bin/env bash
if [[ "${1:-}" == '--version' ]]; then
  printf 'cloudflared version synthetic-test\n'
fi
CLOUDFLARED
chmod +x "$(dirname "$0")/cloudflared"
BREW
chmod +x "$fixture_dir/bin/brew"

test_path="$fixture_dir/bin:/usr/bin:/bin"
if PATH="$test_path" "$script" status >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  printf 'expected clean-machine status to report missing cloudflared\n' >&2
  exit 1
fi
grep -F 'cloudflared missing' "$fixture_dir/err" >/dev/null

PATH="$test_path" "$script" install --apply >"$fixture_dir/out"
grep -F 'cloudflared installed:' "$fixture_dir/out" >/dev/null
grep -F 'synthetic-test' "$fixture_dir/out" >/dev/null
PATH="$test_path" "$script" install --apply >"$fixture_dir/idempotent-out"
grep -F 'cloudflared installed:' "$fixture_dir/idempotent-out" >/dev/null

printf 'cloudflare-connector command tests passed\n'
