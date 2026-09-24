#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
fixture_dir="$(mktemp -d)"
runner_pid=''
cleanup() {
  [[ -z "$runner_pid" ]] || kill -TERM "$runner_pid" 2>/dev/null || true
  wait "$runner_pid" 2>/dev/null || true
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

cat >"$fixture_dir/fake-cloudflare" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  list-targets) printf 'example-node\n' ;;
  controller-state)
    if [[ -e "$FAKE_STATE_ROOT/stopped" ]]; then
      printf 'controller desired: stopped server=example-node\n'
    else
      printf 'controller desired: running server=example-node\n'
    fi
    ;;
  run-tunnel)
    printf '%s\n' "$$" >"$FAKE_STATE_ROOT/connector-pid"
    printf 'start\n' >>"$FAKE_STATE_ROOT/events"
    trap 'exit 0' TERM INT
    while true; do sleep 1; done
    ;;
  *) exit 64 ;;
esac
SH
chmod +x "$fixture_dir/fake-cloudflare"
mkdir -p "$fixture_dir/state"
: >"$fixture_dir/state/stopped"

FAKE_STATE_ROOT="$fixture_dir/state" \
  CLOUDFLARE_COMMAND_PATH="$fixture_dir/fake-cloudflare" \
  "$command_dir/service-runner.sh" >"$fixture_dir/runner.out" 2>"$fixture_dir/runner.err" &
runner_pid=$!

sleep 1.2
[[ ! -e "$fixture_dir/state/events" ]]
rm "$fixture_dir/state/stopped"
for _ in $(seq 1 50); do
  [[ -s "$fixture_dir/state/connector-pid" ]] && break
  sleep 0.05
done
[[ "$(wc -l <"$fixture_dir/state/events" | tr -d ' ')" == 1 ]]

: >"$fixture_dir/state/stopped"
kill -TERM "$(<"$fixture_dir/state/connector-pid")"
sleep 1.2
[[ "$(wc -l <"$fixture_dir/state/events" | tr -d ' ')" == 1 ]]
grep -Fq 'intentionally stopped; waiting for Start' "$fixture_dir/runner.out"

printf 'Cloudflare desired-state runner checks passed.\n'
