#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ -n "${AI_LOCAL_PROVIDER_LOG_DIR:-}" ]]; then
  log_dir="$AI_LOCAL_PROVIDER_LOG_DIR"
else
  log_dir="$command_dir/logs"
fi
mkdir -p "$log_dir"
run_log="$log_dir/ai-local-provider-$(date +%Y%m%dT%H%M%S)-$$.log"
touch "$run_log"
chmod 0600 "$run_log"
exec > >(tee -a "$run_log") 2>&1
printf 'Installation log: %s\n' "$run_log"
config_path="${AI_COMMAND_CONFIG_PATH:-}"
action="install"
box="" host="" ssh_user="" ssh_port="" ssh_key="" ssh_alias="" preset="" storage_volume="" dry_run=false
save_profile=false

usage() {
  cat <<'EOF'
Usage: install-ai-local-provider.sh [inspect|status|preflight|install] [options]
  --box ID          Select a box from the active profile command configuration
  --host HOST       Use a host for this invocation
  --user USER       SSH user for an explicit host
  --ssh-port PORT   SSH port (default: 22)
  --ssh-key PATH    Private-key reference (never key contents)
  --ssh-alias NAME  Use a host from the user's SSH configuration
  --preset ID       Model preset
  --storage-volume PATH  Existing filesystem used for models and download staging
  --dry-run         Show the validated plan without provisioning
  --save-profile    Save inspect JSON under the private profile command config
EOF
}

show_intro() {
  cat <<'EOF'
Install AI Local Provider (beta)

This command connects a profile to a local-model server. Remote SSH onboarding,
machine checks, provider status, and installation-plan validation are available.
Model provisioning starts only when the selected preset is complete and reviewed.

Passwords are never accepted as command options or stored in the profile. If a
server needs your public key, the command prints a safe ssh-copy-id instruction.
EOF
}

fail() { printf '%s\n' "$1" >&2; exit "${2:-2}"; }
plan_step() { printf '\n[%s] %s\n' "$1" "$2"; }
valid_id() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; }
valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535)); }

if [[ $# -eq 0 && -t 0 ]]; then
  show_intro
  printf '\nWhat would you like to do?\n'
  printf '  1. Check whether a machine is ready (recommended first run)\n'
  printf '  2. Show provider status\n'
  printf '  3. Validate an installation plan\n'
  printf '  4. Show command help\n'
  printf '  5. Exit\n'
  printf 'Choose [1-5]: '; read -r launch_choice
  case "$launch_choice" in
    1) action="preflight" ;;
    2) action="status" ;;
    3) action="install"; dry_run=true ;;
    4) printf '\n'; usage; exit 0 ;;
    5|'') printf 'CANCELLED: no changes made.\n'; exit 0 ;;
    *) fail "INVALID_SELECTION: choose a number from 1 to 5." ;;
  esac
elif [[ $# -gt 0 && "$1" != --* ]]; then action="$1"; shift; fi
case "$action" in inspect|status|preflight|install) ;; -h|--help|help) usage; exit 0 ;; *) fail "INVALID_ACTION: $action" ;; esac
while [[ $# -gt 0 ]]; do
  case "$1" in
    --box|--host|--user|--ssh-port|--ssh-key|--ssh-alias|--preset|--storage-volume)
      [[ $# -ge 2 ]] || fail "MISSING_VALUE: $1"
      case "$1" in --box) box="$2";; --host) host="$2";; --user) ssh_user="$2";; --ssh-port) ssh_port="$2";; --ssh-key) ssh_key="$2";; --ssh-alias) ssh_alias="$2";; --preset) preset="$2";; --storage-volume) storage_volume="$2";; esac
      shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    --save-profile) save_profile=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "UNKNOWN_OPTION: $1" ;;
  esac
done

config_value() { node "$command_dir/resolve-config.mjs" "$config_path" "$box" "$1"; }
if [[ -n "$box" ]]; then
  [[ -n "$config_path" && -f "$config_path" ]] || fail "CONFIGURATION_REQUIRED: --box requires the active profile's AI_COMMAND_CONFIG_PATH."
  valid_id "$box" || fail "CONFIGURATION_INVALID: invalid box ID."
  host="${host:-$(config_value host)}"; ssh_user="${ssh_user:-$(config_value user)}"
  ssh_port="${ssh_port:-$(config_value ssh_port)}"; ssh_key="${ssh_key:-$(config_value ssh_key)}"
  ssh_alias="${ssh_alias:-$(config_value ssh_alias)}"; preset="${preset:-$(config_value preset)}"
  storage_volume="${storage_volume:-$(config_value storage_volume)}"
fi
if [[ -z "$box" && -z "$host" && -z "$ssh_alias" && -t 0 ]]; then
  if [[ -n "$config_path" && -f "$config_path" ]]; then
    printf 'Configured machines:\n'; node "$command_dir/resolve-config.mjs" "$config_path" '' list
    printf 'Choose a configured machine ID, or enter + to add/use another machine: '; read -r box
  else
    printf '\nNo profile-owned machine configuration is active.\n'
    printf 'You can use a machine once now. Later, copy the command example config\n'
    printf 'into your private profile and bind it through commands[].config.\n'
    box="+"
  fi
  if [[ -n "$box" && "$box" != "+" && -n "$config_path" && -f "$config_path" ]] && node "$command_dir/resolve-config.mjs" "$config_path" "$box" exists >/dev/null 2>&1; then
    host="$(config_value host)"; ssh_user="$(config_value user)"; ssh_port="$(config_value ssh_port)"
    ssh_key="$(config_value ssh_key)"; ssh_alias="$(config_value ssh_alias)"; preset="$(config_value preset)"
  else
    if [[ "$box" == "+" ]]; then
      printf 'Logical machine name (used only for this run): '; read -r box
    fi
    printf 'Host or IP: '; read -r host
    printf 'SSH user: '; read -r ssh_user
    printf 'SSH port [22]: '; read -r ssh_port
  fi
fi

[[ -z "$ssh_alias" || -z "$host$ssh_user$ssh_key" ]] || fail "CONFIGURATION_INVALID: ssh_alias conflicts with explicit SSH host, user, or key fields."
target="$ssh_alias"
if [[ -z "$target" ]]; then
  [[ -n "$host" && -n "$ssh_user" ]] || fail "CONFIGURATION_REQUIRED: select --box, --ssh-alias, or provide --host and --user."
  [[ "$host$ssh_user" != *$'\t'* && "$host$ssh_user" != *$'\n'* ]] || fail "CONFIGURATION_INVALID: SSH target contains control characters."
  target="$ssh_user@$host"
fi
ssh_port="${ssh_port:-22}"; valid_port "$ssh_port" || fail "CONFIGURATION_INVALID: invalid SSH port."
preset="${preset:-qwen3-coder-next}"; valid_id "$preset" || fail "CONFIGURATION_INVALID: invalid preset ID."
preset_file="$command_dir/presets/$preset.yml"; [[ -f "$preset_file" ]] || fail "PRESET_NOT_FOUND: $preset"
storage_volume="${storage_volume:-/}"
[[ "$storage_volume" == / || "$storage_volume" =~ ^/[-A-Za-z0-9._/]+$ ]] || fail "CONFIGURATION_INVALID: storage volume must be an absolute path without shell metacharacters."
plan_step AI-LOCAL-01 'Resolve configuration'

ssh_args=(-o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=yes)
if [[ -z "$ssh_alias" ]]; then ssh_args+=(-p "$ssh_port"); fi
expanded_key=""
if [[ -n "$ssh_key" ]]; then
  expanded_key="${ssh_key/#\~/$HOME}"
  [[ -r "$expanded_key" ]] || fail "SSH_IDENTITY_INVALID: unreadable key reference $ssh_key"
  ssh_args+=(-o IdentitiesOnly=yes -i "$expanded_key")
fi

if [[ "$action" != inspect ]]; then
  printf 'Target: %s%s\n' "${box:+$box -> }" "$target"
  printf 'Preset: %s\n' "$preset"
fi
auth_error="$(mktemp "${TMPDIR:-/tmp}/ai-local-provider-ssh.XXXXXX")"
trap 'rm -f -- "$auth_error"' EXIT
plan_step AI-LOCAL-02 'Verify SSH access'
if ! ssh "${ssh_args[@]}" "$target" 'printf "AI_LOCAL_SSH_OK\\n"' >/dev/null 2>"$auth_error"; then
  if grep -Fq 'REMOTE HOST IDENTIFICATION HAS CHANGED' "$auth_error"; then
    fail "SSH_HOST_KEY_CHANGED: verify the server identity and repair its known_hosts entry manually."
  fi
  if grep -Eq 'Host key verification failed|No ED25519 host key is known' "$auth_error"; then
    printf 'SSH_HOST_KEY_VERIFICATION_REQUIRED: verify this fingerprint before trusting %s:\n' "$target" >&2
    scan_host="$host"; scan_port="$ssh_port"
    if [[ -n "$ssh_alias" ]]; then
      scan_host="$(ssh -G "$ssh_alias" 2>/dev/null | awk '$1 == "hostname" { print $2; exit }')"
      scan_port="$(ssh -G "$ssh_alias" 2>/dev/null | awk '$1 == "port" { print $2; exit }')"
    fi
    ssh-keyscan -T 5 -p "$scan_port" "$scan_host" 2>/dev/null | ssh-keygen -lf - >&2 || true
    exit 5
  fi
  public_key="${expanded_key:-$HOME/.ssh/id_ed25519}.pub"
  printf 'SSH_AUTHORIZATION_REQUIRED: public-key/agent login failed for %s.\n' "$target" >&2
  if [[ -r "$public_key" ]]; then
    if [[ -n "$ssh_alias" ]]; then
      printf 'Authorize this public key in a trusted terminal, then retry:\n  ssh-copy-id -i %q %q\n' "$public_key" "$target" >&2
    else
      printf 'Authorize this public key in a trusted terminal, then retry:\n  ssh-copy-id -i %q -p %q %q\n' "$public_key" "$ssh_port" "$target" >&2
    fi
  else
    printf 'Configure an SSH-agent identity or generate and authorize a dedicated key, then retry.\n' >&2
  fi
  exit 5
fi

plan_step AI-LOCAL-03 'Qualify the machine and plan'

probe="$(ssh "${ssh_args[@]}" "$target" 'set -eu; printf "hostname=%s\nuser=%s\n" "$(hostname)" "$(id -un)"; . /etc/os-release; printf "os_id=%s\nos_version=%s\n" "$ID" "$VERSION_ID"; printf "kernel=%s\narch=%s\n" "$(uname -r)" "$(uname -m)"; lscpu | awk -F: "/^Model name:/{sub(/^[ \\t]+/,\"\",\$2); print \"cpu_model=\" \$2} /^CPU\\(s\\):/{sub(/^[ \\t]+/,\"\",\$2); print \"cpu_logical=\" \$2} /^Core\\(s\\) per socket:/{sub(/^[ \\t]+/,\"\",\$2); print \"cpu_cores_per_socket=\" \$2} /^Socket\\(s\\):/{sub(/^[ \\t]+/,\"\",\$2); print \"cpu_sockets=\" \$2} /^NUMA node\\(s\\):/{sub(/^[ \\t]+/,\"\",\$2); print \"numa_nodes=\" \$2}"; awk "/MemTotal/{printf \"memory_kb=%s\\n\", \$2}" /proc/meminfo; df -Pk / | awk "NR==2{printf \"runtime_root_available_kb=%s\\n\", \$4}"; df -Pk '"$storage_volume"' | awk "NR==2{printf \"storage_total_kb=%s\\nstorage_available_kb=%s\\n\", \$2, \$4}"; printf "storage_volume=%s\n" '"$storage_volume"'; if command -v nvidia-smi >/dev/null 2>&1; then nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits | head -1 | awk -F", " "{print \"gpu_name=\" \$1; print \"gpu_vram_mb=\" \$2; print \"gpu_driver=\" \$3}"; else echo gpu_name=none; fi; command -v cmake >/dev/null 2>&1 && echo native_build=ready || echo native_build=missing; command -v nvcc >/dev/null 2>&1 && echo cuda_toolkit=ready || echo cuda_toolkit=missing; if sudo -n true 2>/dev/null; then echo sudo=noninteractive; elif id -nG | tr " " "\n" | grep -qx sudo; then echo sudo=interactive-required; else echo sudo=unavailable; fi; if systemctl is-active --quiet ai-local-provider 2>/dev/null; then echo service=active; elif systemctl cat ai-local-provider >/dev/null 2>&1; then echo service=inactive; else echo service=absent; fi')"
if [[ "$action" == inspect ]]; then
  inventory_args=("$box" "$target" "$preset")
  if [[ "$save_profile" == true ]]; then
    [[ -n "$box" && -n "$config_path" && -f "$config_path" ]] || fail "CONFIGURATION_REQUIRED: --save-profile requires a configured --box."
    inventory_args+=("$config_path")
  fi
  printf '%s\n' "$probe" | node "$command_dir/machine-inventory.mjs" "${inventory_args[@]}"
  exit 0
fi
printf '%s\n' "$probe"
grep -qx 'os_id=ubuntu' <<<"$probe" || fail "UNSUPPORTED_OS: remote target must be Ubuntu."
grep -Eq '^os_version=24\.04([.]|$)' <<<"$probe" || fail "UNSUPPORTED_OS: remote target must be Ubuntu 24.04."
grep -Eq '^arch=(x86_64|amd64)$' <<<"$probe" || fail "UNSUPPORTED_ARCHITECTURE: remote target must be AMD64/x86_64."
memory_kb="$(awk -F= '$1 == "memory_kb" {print $2}' <<<"$probe")"
disk_kb="$(awk -F= '$1 == "storage_available_kb" {print $2}' <<<"$probe")"
runtime_root_kb="$(awk -F= '$1 == "runtime_root_available_kb" {print $2}' <<<"$probe")"
minimum_memory_gb="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:requirements.memory.minimum_gb' 2>/dev/null || true)"
minimum_disk_gb="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:requirements.disk.minimum_free_gb' 2>/dev/null || true)"
recommended_disk_gb="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:requirements.disk.recommended_free_gb' 2>/dev/null || true)"
runtime_root_gb="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:requirements.disk.runtime_root_free_gb' 2>/dev/null || true)"
model_size_bytes="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:model.size_bytes' 2>/dev/null || true)"
if [[ "$model_size_bytes" =~ ^[0-9]+$ ]]; then
  model_size_gib=$(((model_size_bytes + 1073741823) / 1073741824))
  available_gib=$((disk_kb / 1024 / 1024))
  printf 'Storage assessment: volume=%s available=%s GiB model=%s GiB minimum=%s GiB recommended=%s GiB estimated-after=%s GiB\n' "$storage_volume" "$available_gib" "$model_size_gib" "${minimum_disk_gb:-unknown}" "${recommended_disk_gb:-unknown}" "$((available_gib - model_size_gib))"
  if [[ "$recommended_disk_gb" =~ ^[0-9]+$ ]] && ((available_gib >= recommended_disk_gb)); then
    printf 'Storage recommendation: recommended — enough room for this model, staging, and the configured reserve.\n'
  elif [[ "$minimum_disk_gb" =~ ^[0-9]+$ ]] && ((available_gib >= minimum_disk_gb)); then
    printf 'Storage recommendation: workable but tight — install only after reviewing cache and upgrade-retention needs.\n'
  else
    printf 'Storage recommendation: insufficient — choose a smaller model, another volume, or free space first.\n'
  fi
fi
requirement_failures=()
if [[ "$minimum_memory_gb" =~ ^[0-9]+$ ]] && ((memory_kb < minimum_memory_gb * 1024 * 1024)); then
  requirement_failures+=("memory requires ${minimum_memory_gb} GiB; detected $((memory_kb / 1024 / 1024)) GiB")
fi
if [[ "$minimum_disk_gb" =~ ^[0-9]+$ ]] && ((disk_kb < minimum_disk_gb * 1024 * 1024)); then
  requirement_failures+=("free disk requires ${minimum_disk_gb} GiB; detected $((disk_kb / 1024 / 1024)) GiB")
fi
if [[ "$runtime_root_gb" =~ ^[0-9]+$ ]] && ((runtime_root_kb < runtime_root_gb * 1024 * 1024)); then
  requirement_failures+=("runtime root requires ${runtime_root_gb} GiB free; detected $((runtime_root_kb / 1024 / 1024)) GiB")
fi
if ((${#requirement_failures[@]})); then
  printf 'REQUIREMENTS_NOT_MET: preset %s is incompatible with this machine:\n' "$preset" >&2
  printf '  - %s\n' "${requirement_failures[@]}" >&2
  exit 4
fi
sudo_mode="$(awk -F= '$1 == "sudo" {print $2}' <<<"$probe")"
grep -qx 'native_build=ready' <<<"$probe" || printf 'Will install: native compiler and CMake toolchain\n'
grep -qx 'cuda_toolkit=ready' <<<"$probe" || printf 'Will install: CUDA Toolkit\n'
if [[ "$action" == status ]]; then printf 'SUCCESS: remote provider status inspected.\n'; exit 0; fi
if [[ "$action" == preflight ]]; then
  [[ "$sudo_mode" != unavailable ]] || fail "INSUFFICIENT_PRIVILEGES: SSH user is not authorized for sudo provisioning."
  printf 'SUCCESS: machine is compatible; the install action can provision missing prerequisites.\n'
  exit 0
fi
node "$command_dir/resolve-config.mjs" "$preset_file" '' preset-ready >/dev/null || fail "PRESET_NOT_READY: $preset does not pin a model repository, file, and quantization."
[[ "$sudo_mode" != unavailable ]] || fail "INSUFFICIENT_PRIVILEGES: SSH user is not authorized for sudo provisioning."
model_repository="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:model.repository')"
model_file="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:model.file')"
model_api_alias="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:model.api_alias')"
model_sha256="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:model.sha256')"
runtime_repository="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:runtime.source_repository')"
runtime_revision="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:runtime.source_revision')"
context_size="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:model.context')"
gpu_layers="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:runtime.gpu_layers')"
listen_address="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:service.listen_address')"
provider_port="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:service.port')"
service_name="$(node "$command_dir/resolve-config.mjs" "$preset_file" '' 'preset-field:service.name')"
printf 'Plan: clean disposable system data, install the native CUDA toolchain, build pinned llama.cpp, download and verify the pinned model, and provision systemd on %s.\n' "$target"
if [[ "$dry_run" == true ]]; then printf 'SUCCESS: dry-run plan validated; no changes made.\n'; exit 0; fi
provision_script="$command_dir/provision-ubuntu.sh"
[[ -r "$provision_script" ]] || fail 'RUNTIME_INSTALL_FAILED: missing Ubuntu provisioning adapter.'
ssh_provision_args=("${ssh_args[@]}")
# stdout is intentionally routed through tee for the transcript, so stdin is
# the authoritative indication that a human terminal is available for sudo.
if [[ -t 0 ]]; then ssh_provision_args+=(-tt); fi
remote_provision_script="$(ssh "${ssh_args[@]}" "$target" 'mktemp /tmp/ai-local-provider-provision.XXXXXX.sh')"
[[ "$remote_provision_script" == /tmp/ai-local-provider-provision.*.sh ]] || fail 'RUNTIME_INSTALL_FAILED: unsafe remote staging path.'
scp_args=(-q -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=yes)
if [[ -z "$ssh_alias" ]]; then scp_args+=(-P "$ssh_port"); fi
if [[ -n "$expanded_key" ]]; then scp_args+=(-o IdentitiesOnly=yes -i "$expanded_key"); fi
scp "${scp_args[@]}" "$provision_script" "$target:$remote_provision_script" || fail 'RUNTIME_INSTALL_FAILED: could not stage provisioning adapter.'
trap 'rm -f -- "$auth_error"' EXIT
set +e
ssh "${ssh_provision_args[@]}" "$target" \
  "sudo bash $(printf '%q' "$remote_provision_script") $(printf '%q ' "$storage_volume" "$model_repository" "$model_file" "$model_sha256" "$runtime_repository" "$runtime_revision" "$context_size" "$gpu_layers" "$listen_address" "$provider_port" "$service_name" "$model_api_alias")"
provision_code=$?
set -e
ssh "${ssh_args[@]}" "$target" "rm -f -- $(printf '%q' "$remote_provision_script")" >/dev/null 2>&1 || true
if [[ $provision_code -eq 20 ]]; then
  fail 'REBOOT_REQUIRED: NVIDIA driver was installed. Reboot the server, then run this command again; it will resume safely.' 20
fi
[[ $provision_code -eq 0 ]] || fail "RUNTIME_INSTALL_FAILED: remote provisioning exited with code $provision_code." 9
printf 'SUCCESS: AI Local Provider installed and health-checked on %s.\n' "$target"
