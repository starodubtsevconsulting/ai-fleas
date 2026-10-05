# System profile resolution, protected connection, receipt, and validation scenarios.
# Sourced by hermes-agents.command.test.sh after its shared fixture.
"${COMMAND}" initialize-system --work-profile example --validate-only >"${test_root}/system-local-preflight-output"
grep -F 'HERMES_SYSTEM_REINITIALIZE_PREFLIGHT_READY: profile=example-system watch=example-dev; no System changes were made.' "${test_root}/system-local-preflight-output" >/dev/null
if node "${SOURCE_DIR}/resolve-system-scope.mjs" "${test_root}/ai-profile" example remote >"${test_root}/system-remote-missing-secret-output" 2>&1; then
  printf '%s\n' 'System resolver unexpectedly accepted a protected remote connection without credentials' >&2
  exit 1
fi
grep -F 'connection requires secret environment variable TEST_CF_ACCESS_CLIENT_ID' "${test_root}/system-remote-missing-secret-output" >/dev/null
export TEST_CF_ACCESS_CLIENT_ID=test-client-id TEST_CF_ACCESS_CLIENT_SECRET=test-client-secret
remote_system_scope="$(node "${SOURCE_DIR}/resolve-system-scope.mjs" "${test_root}/ai-profile" example remote)"
[[ "${remote_system_scope}" == *$'\thttps://example-model.invalid/v1\t'* ]]
remote_headers_b64="$(cut -f7 <<<"${remote_system_scope}")"
[[ "$(printf '%s' "${remote_headers_b64}" | base64 --decode)" == '{"CF-Access-Client-Id":"test-client-id","CF-Access-Client-Secret":"test-client-secret"}' ]]
remote_stored_headers_b64="$(cut -f8 <<<"${remote_system_scope}")"
[[ "$(printf '%s' "${remote_stored_headers_b64}" | base64 --decode)" == '{"CF-Access-Client-Id":"${env:TEST_CF_ACCESS_CLIENT_ID}","CF-Access-Client-Secret":"${env:TEST_CF_ACCESS_CLIENT_SECRET}"}' ]]
"${COMMAND}" initialize-system --work-profile example --instance 2 --connection remote --validate-only >"${test_root}/system-remote-preflight-output"
grep -F 'HERMES_SYSTEM_REINITIALIZE_PREFLIGHT_READY: profile=example-system-2 watch=example-dev; no System changes were made.' "${test_root}/system-remote-preflight-output" >/dev/null
receipt_test_path="${test_root}/system-receipts.yml"
receipt_python="${HERMES_RECEIPT_TEST_PYTHON:-${HOME}/.hermes/hermes-agent/venv/bin/python}"
[[ -x "${receipt_python}" ]] || receipt_python=python3
"${receipt_python}" "${SOURCE_DIR}/write-system-receipt.py" --path "${receipt_test_path}" --profile example-system --title example-system --provider example-box --model example-model --every 10m --scheduler-id canonical-job --watch-group example-dev
"${receipt_python}" "${SOURCE_DIR}/write-system-receipt.py" --path "${receipt_test_path}" --profile example-system-2 --instance 2 --title example-system-2 --provider example-box --model example-model --every 10m --scheduler-id test-job --watch-group example-dev
RECEIPT_PATH="${receipt_test_path}" "${receipt_python}" -c 'import os,yaml; d=yaml.safe_load(open(os.environ["RECEIPT_PATH"])); assert d["system"]["profile_id"] == "example-system"; assert d["system_instances"]["example-system-2"]["profile_id"] == "example-system-2"'
unset AI_FLOW_WORKFLOW
if "${COMMAND}" reinitialize-system --work-profile example >"${test_root}/system-reinitialize-without-confirm" 2>&1; then
  printf '%s\n' 'reinitialize-system unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_SYSTEM_REINITIALIZE_CONFIRMATION_REQUIRED' "${test_root}/system-reinitialize-without-confirm" >/dev/null
if "${COMMAND}" initialize-system --work-profile example --watch-group other-dev >"${test_root}/cross-profile-watch-output" 2>&1; then
  printf '%s\n' 'initialize-system unexpectedly accepted a cross-profile watch group' >&2
  exit 1
fi
grep -F "HERMES_SYSTEM_WATCH_SCOPE_INVALID: System for work profile 'example' cannot watch 'other-dev'; allowed Hermes workflow groups: example-dev. No System changes were made." "${test_root}/cross-profile-watch-output" >/dev/null
export AI_FLOW_WORKFLOW=dev.workflow.md
export HERMES_TEST_ADVERTISED_MODEL=different-model
profiles_before="$(cat "${HERMES_TEST_STATE}")"
if "${COMMAND}" initialize --work-profile example --workflow dev --project service >"${test_root}/missing-model-output" 2>"${test_root}/missing-model-error"; then
  printf '%s\n' 'initialize unexpectedly succeeded with an unadvertised model' >&2
  exit 1
fi
[[ "$(grep -c '^HERMES_MODEL_NOT_ADVERTISED:' "${test_root}/missing-model-error")" -eq 2 ]]
grep -F 'profile=example-dev-admin provider=example-box model=example-coder-model; advertised=different-model; no profile changes were made.' "${test_root}/missing-model-error" >/dev/null
grep -F 'profile=example-dev-coder provider=example-box model=example-coder-model; advertised=different-model; no profile changes were made.' "${test_root}/missing-model-error" >/dev/null
grep -F 'HERMES_WORKFLOW_PREFLIGHT_FAILED: group=example-dev agents=2 failed_agents=2 failed_profiles=example-dev-admin,example-dev-coder; all provider/model errors are listed above; no workflow profiles were changed.' "${test_root}/missing-model-error" >/dev/null
[[ "$(cat "${HERMES_TEST_STATE}")" == "${profiles_before}" ]]
unset HERMES_TEST_ADVERTISED_MODEL
unset AI_FLOW_WORKFLOW
if "${COMMAND}" status-system --work-profile example >"${test_root}/system-status-output" 2>&1; then
  printf '%s\n' 'status-system unexpectedly succeeded without a System receipt' >&2
  exit 1
fi
grep -F 'HERMES_SYSTEM_NOT_INITIALIZED: example' "${test_root}/system-status-output" >/dev/null
if grep -F 'select a workflow' "${test_root}/system-status-output" >/dev/null; then
  printf '%s\n' 'profile-scoped System command incorrectly required a workflow' >&2
  exit 1
fi
export AI_FLOW_WORKFLOW=dev.workflow.md
"${COMMAND}" check-update >"${test_root}/check-update-output"
grep -F 'Installed: v2026.8.19' "${test_root}/check-update-output" >/dev/null
grep -F 'Latest stable: v2026.8.31' "${test_root}/check-update-output" >/dev/null
grep -F 'HERMES_UPDATE_AVAILABLE' "${test_root}/check-update-output" >/dev/null
