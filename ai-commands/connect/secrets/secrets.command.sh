#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "secrets" || exit $?
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/secrets.command.mjs" "$@"
