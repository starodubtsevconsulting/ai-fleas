#!/usr/bin/env bash
set -euo pipefail
# Per-agent AI provider resolution is performed by resolve-profile-scope.mjs.
# The lifecycle command will consume that resolved role metadata as part of the
# focused implementation; unrelated lifecycle behavior remains unchanged.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "hermes-app" || exit $?

readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SETUP_SCRIPT="${COMMAND_DIR}/setup-hermes-profile.sh"
readonly PROFILE_ROOT="${AI_PROFILE_ROOT:-$(dirname "$(dirname "${AI_PROFILE_FILE}")")}"
readonly PROFILE_RESOLVER="${COMMAND_DIR}/resolve-profile-scope.mjs"

printf '%s\n' 'HERMES_PROVIDER_BRANCH_INCOMPLETE: lifecycle integration is under review; use main for operational Hermes lifecycle.' >&2
exit 1
