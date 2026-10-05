# Workflow preflight, initialization, protected provider, reconcile, and reinitialize scenarios.
# Sourced by hermes-agents.command.test.sh after its shared fixture.
"${COMMAND}" initialize --work-profile example --workflow dev --project service >"${test_root}/output"
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/output" >/dev/null
grep -F 'Hermes bot ready: example-dev-coder' "${test_root}/output" >/dev/null
grep -F 'Hermes provider configured: profile=example-dev-admin provider=example-box endpoint=http://192.0.2.10:1234/v1 headers=none' "${test_root}/output" >/dev/null
grep -F 'Hermes group member ready: example-dev (example-dev-admin as Admin)' "${test_root}/output" >/dev/null
grep -F 'HERMES_WORKFLOW_PREFLIGHT: group=example-dev agents=2' "${test_root}/output" >/dev/null
grep -F 'HERMES_WORKFLOW_READY: group=example-dev agents=2 all_agents_ready=true profiles=example-dev-admin,example-dev-coder' "${test_root}/output" >/dev/null
grep -F 'HERMES_RUNTIME_NOTE: while Hermes Desktop is open, it may run one local Python backend per active profile' "${test_root}/output" >/dev/null
grep -F 'Your complete ordered project scope is:' "${HERMES_HOME}/profiles/example-dev-admin/SOUL.md" >/dev/null
grep -F "${test_root}/workspace" "${HERMES_HOME}/profiles/example-dev-admin/SOUL.md" >/dev/null
grep -F "${test_root}/web-workspace" "${HERMES_HOME}/profiles/example-dev-admin/SOUL.md" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-admin/profile.yaml" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-coder/profile.yaml" >/dev/null
"${COMMAND}" initialize --work-profile example --workflow dev --project service --instance remote-log --connection remote >"${test_root}/protected-output"
grep -F 'Hermes provider configured: profile=example-dev-remote-log-admin provider=example-box endpoint=https://example-model.invalid/v1 headers=protected' "${test_root}/protected-output" >/dev/null
grep -F '"CF-Access-Client-Secret": "${env:TEST_CF_ACCESS_CLIENT_SECRET}"' "${HERMES_TEST_PROVIDER_LOG}" >/dev/null || grep -F '"CF-Access-Client-Secret":"${env:TEST_CF_ACCESS_CLIENT_SECRET}"' "${HERMES_TEST_PROVIDER_LOG}" >/dev/null
if grep -F 'test-client-secret' "${HERMES_TEST_PROVIDER_LOG}" >/dev/null; then
  printf '%s\n' 'protected provider secret persisted in Hermes config' >&2
  exit 1
fi
if grep -F 'test-client-secret' "${test_root}/protected-output" >/dev/null; then
  printf '%s\n' 'protected provider secret leaked into initialization output' >&2
  exit 1
fi
export HERMES_TEST_FAIL_PROFILE=example-dev-coder
if "${COMMAND}" reconcile --work-profile example --workflow dev --project service >"${test_root}/partial-output" 2>"${test_root}/partial-error"; then
  printf '%s\n' 'reconcile unexpectedly succeeded after injected profile failure' >&2
  exit 1
fi
grep -F 'HERMES_WORKFLOW_PARTIAL_FAILURE: group=example-dev failed_profile=example-dev-coder completed_profiles=example-dev-admin; binding receipt was not written.' "${test_root}/partial-error" >/dev/null
unset HERMES_TEST_FAIL_PROFILE
"${COMMAND}" reconcile --work-profile example --workflow dev --project service >"${test_root}/reconcile-output"
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/reconcile-output" >/dev/null
if "${COMMAND}" reinitialize --work-profile example --workflow dev --project service >"${test_root}/reinitialize-without-confirm" 2>&1; then
  printf '%s\n' 'reinitialize unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_REINITIALIZE_CONFIRMATION_REQUIRED' "${test_root}/reinitialize-without-confirm" >/dev/null
"${COMMAND}" re-init --work-profile example --workflow dev --project service --confirm-reinitialize >"${test_root}/reinitialize-output"
grep -F 'HERMES_WORKFLOW_PREFLIGHT_READY: group=example-dev agents=2 no_profiles_changed=true' "${test_root}/reinitialize-output" >/dev/null
grep -F 'HERMES_WORKFLOW_DELETED: example-dev (service)' "${test_root}/reinitialize-output" >/dev/null
[[ "$(grep -nE 'HERMES_WORKFLOW_PREFLIGHT_READY|HERMES_WORKFLOW_DELETED' "${test_root}/reinitialize-output" | head -n 1)" == *HERMES_WORKFLOW_PREFLIGHT_READY* ]]
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/reinitialize-output" >/dev/null
grep -F 'Hermes bot ready: example-dev-coder' "${test_root}/reinitialize-output" >/dev/null
[[ "$(grep -Ec '^example-dev-(admin|coder)$' "${HERMES_TEST_STATE}")" -eq 2 ]]
