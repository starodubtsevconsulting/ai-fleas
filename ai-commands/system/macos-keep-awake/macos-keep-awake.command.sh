#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: macos-keep-awake.command.sh [--help | --check | run | ui]
Keep this Mac awake in the foreground until Ctrl-C, after interactive confirmation.
--help   Print help without profile checks or power assertions.
ui       Open the human UI with safe defaults; no profile needed.
--check  Validate selected profile/workflow, macOS and caffeinate; no assertion.
run      Default. Requires terminal stdin and literal KEEP AWAKE confirmation.
HELP
}

[[ $# -le 1 ]] || { usage >&2; exit 64; }
mode="${1:-run}"
case "$mode" in
  --help) usage; exit 0 ;;
  ui) command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"; exec "$command_dir/app.sh" ;;
  --check|run) ;;
  *) usage >&2; exit 64 ;;
esac
command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$command_dir/../../_runtime/profile/command-profile.guard.sh"
ai_command_require_profile macos-keep-awake
[[ "$(uname -s)" == Darwin ]] || { printf 'MACOS_REQUIRED\n' >&2; exit 1; }
[[ -x /usr/bin/caffeinate ]] || { printf 'CAFFEINATE_UNAVAILABLE\n' >&2; exit 1; }
if [[ "$mode" == --check ]]; then
  printf 'MACOS_KEEP_AWAKE_READY: no assertion started\n'
  exit 0
fi
[[ -t 0 ]] || { printf 'INTERACTIVE_STDIN_REQUIRED: no assertion started\n' >&2; exit 64; }
cat <<'NOTICE'
Keeping the display and system awake can leave this Mac accessible to people nearby.
No password or permanent setting change is needed. Keep this terminal foreground;
Ctrl-C stops the assertion. This cannot prevent manual locking, lid closure, reboot
or enforced policy. The user-activity assertion is brief (default five seconds),
while display/idle/system assertions last for this process; system sleep prevention
applies on AC power. Type exactly KEEP AWAKE to continue; anything else cancels.
NOTICE
confirmation=''
if ! IFS= read -r confirmation || [[ "$confirmation" != 'KEEP AWAKE' ]]; then
  printf 'CANCELLED: no assertion started\n'
  exit 0
fi
exec /usr/bin/caffeinate -disu
