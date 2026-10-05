# Secrets-binding preflight scenarios; a pass proves failure happens before Hermes mutation.
# Sourced by hermes-agents.command.test.sh after its shared fixture.
# A workflow selecting secrets validates its profile binding before any Hermes mutation.
mkdir -p "${test_root}/commands/connect/secrets" "${test_root}/ai-profile/example/commands-config"
printf '%s\n' '# Secrets command' >"${test_root}/commands/connect/secrets/secrets.command.md"
printf '%s\n' 'provider: none' >"${test_root}/ai-profile/example/commands-config/secrets.yml"
cat >"${test_root}/commands/connect/secrets/secrets.command.sh" <<'SH'
#!/usr/bin/env bash
[[ "${1:-}" == validate && "${HERMES_TEST_SECRETS_FAIL:-}" != 1 ]] || exit 2
printf '%s\n' 'secrets configuration valid'
SH
chmod +x "${test_root}/commands/connect/secrets/secrets.command.sh"
python3 - "${test_root}/ai-profile/example/example-work-profile.yml" <<'PY'
from pathlib import Path
import sys
target = Path(sys.argv[1])
source = target.read_text()
source = source.replace('  - id: hermes-agents\n    config: commands-config/hermes-agents/config.yml\n',
                        '  - id: hermes-agents\n    config: commands-config/hermes-agents/config.yml\n  - id: secrets\n    config: commands-config/secrets.yml\n', 1)
source = source.replace('      - hermes-agents\n', '      - hermes-agents\n      - secrets\n', 1)
target.write_text(source)
PY
profiles_before="$(cat "${HERMES_TEST_STATE}")"
if HERMES_TEST_SECRETS_FAIL=1 "${COMMAND}" initialize --work-profile example --workflow dev --project service --preflight-only >"${test_root}/secrets-failed-output" 2>"${test_root}/secrets-failed-error"; then
  printf '%s\n' 'initialize accepted an invalid secrets binding' >&2
  exit 1
fi
grep -F 'HERMES_SECRETS_PREFLIGHT_FAILED:' "${test_root}/secrets-failed-error" >/dev/null
[[ "$(cat "${HERMES_TEST_STATE}")" == "${profiles_before}" ]]
"${COMMAND}" initialize --work-profile example --workflow dev --project service --preflight-only >"${test_root}/secrets-preflight-output"
grep -F 'HERMES_SECRETS_CONFIG_READY: profile=example workflow=dev; configuration only, provider and consumer access not tested.' "${test_root}/secrets-preflight-output" >/dev/null
[[ "$(cat "${HERMES_TEST_STATE}")" == "${profiles_before}" ]]
