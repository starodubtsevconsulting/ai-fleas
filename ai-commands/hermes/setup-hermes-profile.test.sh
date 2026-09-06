#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly SETUP_SCRIPT="${SCRIPT_DIR}/setup-hermes-profile.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/setup-hermes-profile-test.XXXXXX")"
cleanup() { rm -rf -- "${test_root}"; }
trap cleanup EXIT INT TERM

mkdir -p "${test_root}/bin" "${test_root}/workspace" "${test_root}/commands/statements" "${test_root}/workflows/accounting"
printf '%s\n' '# Test agent instructions' >"${test_root}/instructions.md"
printf '%s\n' '# Statements command' >"${test_root}/commands/statements/statements.command.md"
printf '%s\n' '# Accounting workflow' >"${test_root}/workflows/accounting/accounting.workflow.md"
cat >"${test_root}/bin/hermes" <<'FAKE_HERMES'
#!/usr/bin/env bash
set -euo pipefail
root="${HERMES_HOME}"
if [[ "$1" == profile && "$2" == create ]]; then
  mkdir -p "${root}/profiles/$3"
  printf '{}\n' >"${root}/profiles/$3/config.yaml"
  exit 0
fi
if [[ "$1" == -p ]]; then
  profile="$2"; shift 2
  if [[ "$1" == config && "$2" == set ]]; then
    shift 2
    [[ "${1:-}" != --force ]] || shift
    printf '%s=%s\n' "$1" "$2" >>"${root}/profiles/${profile}/values"
    exit 0
  fi
  if [[ "$1" == config && "$2" == get ]]; then
    key="$3"
    case "${key}" in
      model.provider) value='example-box' ;;
      model.default) value='example-coder-model' ;;
      model.base_url) value='http://192.0.2.10:1234/v1' ;;
      model.context_length) value='65536' ;;
      compression.threshold) value='0.25' ;;
      compression.target_ratio) value='0.15' ;;
      compression.protect_last_n) value='8' ;;
      terminal.cwd) value="${TEST_WORKSPACE}" ;;
      *) exit 1 ;;
    esac
    printf '%s\n' "${value}"
    exit 0
  fi
fi
exit 1
FAKE_HERMES
chmod +x "${test_root}/bin/hermes"

cat >"${test_root}/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
printf '%s\n' '{"data":[{"id":"example-coder-model"}]}'
FAKE_CURL
chmod +x "${test_root}/bin/curl"

HERMES_HOME="${test_root}/hermes-home" \
HERMES_BIN="${test_root}/bin/hermes" \
HERMES_PROFILE='example-dev-service' \
HERMES_PROVIDER_ID='example-box' \
HERMES_PROVIDER_LABEL='Example box' \
HERMES_MODEL='example-coder-model' \
HERMES_ENDPOINT='http://192.0.2.10:1234/v1' \
HERMES_WORKSPACE="${test_root}/workspace" \
HERMES_AGENT_INSTRUCTIONS_PATH="${test_root}/instructions.md" \
HERMES_AI_COMMANDS_ROOT="${test_root}/commands" \
HERMES_WORKFLOW_INSTRUCTIONS_PATH="${test_root}/workflows/accounting/accounting.workflow.md" \
HERMES_WORKFLOW_COMMAND_IDS='statements' \
TEST_WORKSPACE="${test_root}/workspace" \
PATH="${test_root}/bin:${PATH}" \
  "${SETUP_SCRIPT}" --workspace "${test_root}/workspace" >"${test_root}/output"

profile_dir="${test_root}/hermes-home/profiles/example-dev-service"
grep -F 'providers.example-box=' "${profile_dir}/values" >/dev/null
grep -F 'model.provider=example-box' "${profile_dir}/values" >/dev/null
grep -F 'model.default=example-coder-model' "${profile_dir}/values" >/dev/null
grep -F 'model.context_length=65536' "${profile_dir}/values" >/dev/null
grep -F 'compression.threshold=0.25' "${profile_dir}/values" >/dev/null
grep -F 'compression.target_ratio=0.15' "${profile_dir}/values" >/dev/null
grep -F 'compression.protect_last_n=8' "${profile_dir}/values" >/dev/null
grep -F "terminal.cwd=${test_root}/workspace" "${profile_dir}/values" >/dev/null
grep -F "${test_root}/workspace" "${profile_dir}/SOUL.md" >/dev/null
grep -F "Your AI configuration instructions are \`${test_root}/instructions.md\`" "${profile_dir}/SOUL.md" >/dev/null
grep -F "Your active workflow contract is \`${test_root}/workflows/accounting/accounting.workflow.md\`" "${profile_dir}/SOUL.md" >/dev/null
grep -F "Your selected AI command catalog root is \`${test_root}/commands\`. The commands allowed by this workflow are: \`statements\`." "${profile_dir}/SOUL.md" >/dev/null
grep -F 'For every user request, first match the intent against those selected commands.' "${profile_dir}/SOUL.md" >/dev/null
grep -F 'Hermes bot ready: example-dev-service' "${test_root}/output" >/dev/null

echo 'setup-hermes-profile test passed'
