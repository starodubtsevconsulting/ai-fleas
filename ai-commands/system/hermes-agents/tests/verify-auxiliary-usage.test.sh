#!/usr/bin/env bash
set -euo pipefail
# Run directly. Passing proves profile-derived routes, independent task-session discovery, and missing evidence handling; it does not call a model.
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-aux-usage.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
profile='portable-profile'
mkdir -p "$test_root/bin" "$test_root/home/profiles/$profile/logs"
cat >"$test_root/bin/hermes" <<'SH'
#!/usr/bin/env bash
case "$5" in
  auxiliary.*.provider) printf 'fixture-provider\n' ;;
  auxiliary.*.model) printf 'fixture-aux-model\n' ;;
  auxiliary.*.base_url) printf 'https://fixture.invalid/v1\n' ;;
esac
SH
chmod +x "$test_root/bin/hermes"
sqlite3 "$test_root/home/profiles/$profile/state.db" <<'SQL'
CREATE TABLE session_model_usage(session_id TEXT, model TEXT, billing_provider TEXT, billing_base_url TEXT, task TEXT, api_call_count INTEGER, input_tokens INTEGER, output_tokens INTEGER, last_seen REAL);
INSERT INTO session_model_usage VALUES('compression-run','fixture-aux-model','fixture-provider','https://fixture.invalid/v1/','compression',2,1234,567,10);
INSERT INTO session_model_usage VALUES('goal-run','fixture-main-model','fixture-main-provider','https://main.fixture.invalid/v1/','',1,200,20,20);
SQL
cat >"$test_root/home/profiles/$profile/logs/agent.log" <<'LOG'
2026-01-01 10:00:00 INFO [goal-run] agent.turn_context: conversation turn
2026-01-01 10:00:01 INFO agent.auxiliary_client: Auxiliary goal_judge: using fixture-provider (fixture-aux-model) at https://fixture.invalid/v1/
2026-01-01 10:00:02 INFO hermes_cli.goals: goal judge: verdict=done reason=fixture passed
2026-01-01 10:00:03 INFO [goal-run] agent.conversation_loop: Turn ended
LOG
verifier="$(dirname "$0")/../verify-auxiliary-usage.sh"
common_env=(HERMES_BIN="$test_root/bin/hermes" HERMES_HOME="$test_root/home")
output="$(env "${common_env[@]}" "$verifier" --profile "$profile")"
grep -q 'session=compression-run task=compression' <<<"$output"
grep -q 'session=goal-run task=goal_judge' <<<"$output"
env "${common_env[@]}" "$verifier" --profile "$profile" --session compression-run --task compression >/dev/null
env "${common_env[@]}" "$verifier" --profile "$profile" --session goal-run --task goal_judge >/dev/null
if env "${common_env[@]}" "$verifier" --profile "$profile" --session missing --task compression >/dev/null 2>&1; then
  printf 'missing evidence unexpectedly passed\n' >&2
  exit 1
fi
printf 'Hermes auxiliary usage verifier: PASS\n'
