# Individual profile status and workflow deletion scenarios.
# Sourced by hermes-agents.command.test.sh after its shared fixture.
"${COMMAND}" status example-dev-admin | grep -F 'HERMES_READY' >/dev/null
cat >"${HERMES_HOME}/profiles/example-dev-admin/config.yaml" <<'YAML'
providers:
  example-box:
    extra_headers:
      CF-Access-Client-Id: ${env:TEST_CF_ACCESS_CLIENT_ID}
      CF-Access-Client-Secret: ${env:TEST_CF_ACCESS_CLIENT_SECRET}
YAML
if env -u TEST_CF_ACCESS_CLIENT_SECRET HERMES_PYTHON_BIN="${receipt_python}" "${COMMAND}" status example-dev-admin >"${test_root}/status-missing-header" 2>&1; then
  printf '%s\n' 'Protected Hermes status unexpectedly succeeded without its secret' >&2
  exit 1
fi
grep -F 'HERMES_STATUS_HEADER_UNAVAILABLE' "${test_root}/status-missing-header" >/dev/null
HERMES_PYTHON_BIN="${receipt_python}" "${COMMAND}" status example-dev-admin >"${test_root}/status-protected-output" 2>&1
grep -F 'HERMES_READY' "${test_root}/status-protected-output" >/dev/null
if grep -F -e 'test-client-id' -e 'test-client-secret' "${test_root}/status-protected-output" >/dev/null; then
  printf '%s\n' 'Protected Hermes status exposed a header value' >&2
  exit 1
fi
"${COMMAND}" delete throwaway --confirm-delete | grep -F 'HERMES_PROFILE_DELETED: throwaway' >/dev/null
if "${COMMAND}" delete-workflow --work-profile example --workflow dev --project service >"${test_root}/delete-without-confirm" 2>&1; then
  printf '%s\n' 'delete-workflow unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_DELETE_CONFIRMATION_REQUIRED' "${test_root}/delete-without-confirm" >/dev/null
"${COMMAND}" delete-workflow --work-profile example --workflow dev --project service --confirm-delete >"${test_root}/delete-workflow-output"
grep -F 'HERMES_PROFILE_DELETED: example-dev-admin' "${test_root}/delete-workflow-output" >/dev/null
grep -F 'HERMES_PROFILE_DELETED: example-dev-coder' "${test_root}/delete-workflow-output" >/dev/null
grep -F 'HERMES_WORKFLOW_DELETED: example-dev (service)' "${test_root}/delete-workflow-output" >/dev/null
grep -Fx 'default' "${HERMES_TEST_STATE}" >/dev/null
if grep -E '^example-dev-(admin|coder)$' "${HERMES_TEST_STATE}" >/dev/null; then
  printf '%s\n' 'delete-workflow left a declared role profile behind' >&2
  exit 1
fi
