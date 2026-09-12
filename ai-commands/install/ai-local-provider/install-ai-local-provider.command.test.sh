#!/usr/bin/env bash
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
bash "$dir/verify-plan-sync.sh" >/dev/null
test_root="$(mktemp -d "${TMPDIR:-/tmp}/ai-local-provider-test.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin" "$test_root/home/.ssh"
printf 'test-public-key\n' >"$test_root/home/.ssh/id_ed25519.pub"
cat >"$test_root/config.yml" <<'EOF'
defaults:
  ssh_port: 22
  preset: qwen3-coder-next
boxes:
  lab:
    host: 10.20.30.40
    user: tester
EOF
cat >"$test_root/bin/ssh" <<'EOF'
#!/usr/bin/env bash
if [[ "${TEST_SSH_AUTH:-ok}" == fail ]]; then exit 255; fi
if [[ "${TEST_SSH_AUTH:-ok}" == unknown-host ]]; then echo 'Host key verification failed.' >&2; exit 255; fi
case "$*" in
  *AI_LOCAL_SSH_OK*) printf 'AI_LOCAL_SSH_OK\n' ;;
  *) cat <<'OUT'
user=tester
os_id=ubuntu
os_version=24.04
arch=x86_64
memory_kb=100663296
runtime_root_available_kb=100000000
storage_total_kb=200000000
storage_available_kb=180000000
storage_volume=/
sudo=noninteractive
service=absent
OUT
esac
EOF
cat >"$test_root/bin/ssh-keyscan" <<'EOF'
#!/usr/bin/env bash
printf 'example ssh-ed25519 AAAATEST\n'
EOF
cat >"$test_root/bin/ssh-keygen" <<'EOF'
#!/usr/bin/env bash
printf '256 SHA256:test example (ED25519)\n'
EOF
chmod +x "$test_root/bin/ssh"
chmod +x "$test_root/bin/ssh-keyscan" "$test_root/bin/ssh-keygen"
export PATH="$test_root/bin:$PATH" HOME="$test_root/home" AI_COMMAND_CONFIG_PATH="$test_root/config.yml"
export AI_LOCAL_PROVIDER_LOG_DIR="$test_root/logs"

out="$($dir/install-ai-local-provider.sh preflight --box lab)"
grep -Fq 'SUCCESS: machine is compatible' <<<"$out"
out="$($dir/install-ai-local-provider.sh status --host 10.20.30.40 --user tester)"
grep -Fq 'service=absent' <<<"$out"
out="$($dir/../install.sh ai-local-provider preflight --box lab)"
grep -Fq 'SUCCESS: machine is compatible' <<<"$out"
set +e
out="$(TEST_SSH_AUTH=fail $dir/install-ai-local-provider.sh preflight --box lab 2>&1)"; code=$?
set -e
[[ $code -eq 5 ]]; grep -Fq 'SSH_AUTHORIZATION_REQUIRED' <<<"$out"; grep -Fq 'ssh-copy-id' <<<"$out"
set +e
out="$(TEST_SSH_AUTH=unknown-host $dir/install-ai-local-provider.sh preflight --box lab 2>&1)"; code=$?
set -e
[[ $code -eq 5 ]]; grep -Fq 'SSH_HOST_KEY_VERIFICATION_REQUIRED' <<<"$out"; grep -Fq 'SHA256:test' <<<"$out"
set +e
out="$($dir/install-ai-local-provider.sh install --box lab --dry-run 2>&1)"; code=$?
set -e
[[ $code -eq 0 ]]; grep -Fq 'SUCCESS: dry-run plan validated' <<<"$out"
compgen -G "$test_root/logs/ai-local-provider-*.log" >/dev/null
if grep -Fq 'sudo bash $(printf' "$dir/install-ai-local-provider.sh" && grep -Fq '") -- $(printf' "$dir/install-ai-local-provider.sh"; then
  printf '%s\n' 'installer must not pass a literal -- as provisioner argument 1' >&2
  exit 1
fi
grep -Fq 'if [[ -t 0 ]]; then ssh_provision_args+=(-tt); fi' "$dir/install-ai-local-provider.sh"
grep -Fq 'setfacl -m u:ai-local-provider:--x "$storage_parent"' "$dir/provision-ubuntu.sh"
grep -Fq 'setfacl -m u:ai-local-provider:r-- "$model_path"' "$dir/provision-ubuntu.sh"
grep -Fq -- '--alias $model_api_alias' "$dir/provision-ubuntu.sh"
grep -Fq -- '-c $context_size -np $parallel_slots' "$dir/provision-ubuntu.sh"
grep -Fq -- '-ctk $cache_key_type -ctv $cache_value_type' "$dir/provision-ubuntu.sh"
grep -Fq 'systemctl restart "$service_name"' "$dir/provision-ubuntu.sh"
grep -Fq 'Removed inactive model after successful replacement' "$dir/provision-ubuntu.sh"
printf '%s\n' 'install-ai-local-provider tests: PASS'
