#!/usr/bin/env bash
set -euo pipefail
# Run directly. Passing proves exact recorded routes are accepted and missing task evidence is rejected; it does not call a model.
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-aux-usage.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin" "$test_root/home/profiles/test-coder"
mkdir -p "$test_root/home/profiles/test-coder/logs"
cat >"$test_root/bin/hermes" <<'SH'
#!/usr/bin/env bash
case "$5" in
  auxiliary.*.provider) printf 'amd-provider\n' ;;
  auxiliary.*.model) printf 'qwen-aux\n' ;;
  auxiliary.*.base_url) printf 'http://10.0.0.27:8080/v1\n' ;;
esac
SH
chmod +x "$test_root/bin/hermes"
sqlite3 "$test_root/home/profiles/test-coder/state.db" <<'SQL'
CREATE TABLE session_model_usage(session_id TEXT, model TEXT, billing_provider TEXT, billing_base_url TEXT, task TEXT, api_call_count INTEGER, input_tokens INTEGER, output_tokens INTEGER, last_seen REAL);
INSERT INTO session_model_usage VALUES('session-1','qwen-aux','amd-provider','http://10.0.0.27:8080/v1/','compression',1,3009,6621,1);
SQL
cat >"$test_root/home/profiles/test-coder/logs/agent.log" <<'LOG'
2026-10-05 10:00:00 INFO [session-1] agent.turn_context: conversation turn
2026-10-05 10:00:01 INFO agent.auxiliary_client: Auxiliary goal_judge: using amd-provider (qwen-aux) at http://10.0.0.27:8080/v1/
2026-10-05 10:00:02 INFO hermes_cli.goals: goal judge: verdict=done reason=test passed
2026-10-05 10:00:03 INFO [session-1] agent.conversation_loop: Turn ended
LOG
HERMES_BIN="$test_root/bin/hermes" HERMES_HOME="$test_root/home" "$(dirname "$0")/../verify-auxiliary-usage.sh" --profile test-coder --session session-1 >/dev/null
if HERMES_BIN="$test_root/bin/hermes" HERMES_HOME="$test_root/home" "$(dirname "$0")/../verify-auxiliary-usage.sh" --profile test-coder --session missing --task compression >/dev/null 2>&1; then
  printf 'missing evidence unexpectedly passed\n' >&2; exit 1
fi
printf 'Hermes auxiliary usage verifier: PASS\n'
