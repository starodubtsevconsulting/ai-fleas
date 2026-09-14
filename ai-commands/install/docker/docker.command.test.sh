#!/usr/bin/env bash
set -euo pipefail

install_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/docker-command-test.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT INT TERM
mkdir -p "$test_root/bin"

cat >"$test_root/bin/docker" <<'SH'
#!/usr/bin/env bash
case "${1:-}" in
  --version) printf '%s\n' 'Docker version 99.0.0, build test' ;;
  compose) printf '%s\n' 'Docker Compose version v99.0.0' ;;
  info) exit 0 ;;
  *) exit 2 ;;
esac
SH
chmod +x "$test_root/bin/docker"

status="$(PATH="$test_root/bin:$PATH" "$install_dir/docker/lifecycle.sh" status)"
grep -Fq 'DOCKER_INSTALLED:' <<<"$status"
grep -Fq 'Docker Compose version v99.0.0' <<<"$status"
PATH="$test_root/bin:$PATH" "$install_dir/docker/lifecycle.sh" smoke-test | grep -Fq 'DOCKER_SMOKE_PASS'

set +e
guard_output="$("$install_dir/install.sh" docker status 2>&1)"
guard_status=$?
unsupported="$(PATH="$test_root/bin:$PATH" "$install_dir/docker/lifecycle.sh" install 2>&1)"
unsupported_status=$?
set -e
[[ $guard_status -eq 64 ]]
grep -Fq 'PROFILE_REQUIRED' <<<"$guard_output"
if [[ "$(uname -s)" != Linux ]]; then
  [[ $unsupported_status -eq 3 ]]
  grep -Fq 'DOCKER_INSTALL_UNAVAILABLE' <<<"$unsupported"
fi

printf '%s\n' 'docker command lifecycle: PASS'
