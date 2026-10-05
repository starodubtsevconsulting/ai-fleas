#!/usr/bin/env bash
# Runs the complete Hermes command lifecycle suite. A pass verifies the focused component checks
# and all sourced lifecycle scenarios against one isolated synthetic Hermes home; it does not call a model.
set -euo pipefail
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${TEST_DIR}/fixtures/command-lifecycle-fixture.sh"
source "${TEST_DIR}/cases/system-lifecycle.sh"
source "${TEST_DIR}/cases/workflow-lifecycle.sh"
source "${TEST_DIR}/cases/profile-lifecycle.sh"
source "${TEST_DIR}/cases/secrets-preflight.sh"

printf '%s\n' 'hermes command test passed'
