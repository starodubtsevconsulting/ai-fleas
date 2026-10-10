#!/usr/bin/env bash
set -euo pipefail

storage_volume="$1"; model_repository="$2"; model_file="$3"; model_sha256="$4"
runtime_repository="$5"; runtime_revision="$6"; context_size="$7"; gpu_layers="$8"
listen_address="$9"; provider_port="${10}"; service_name="${11}"; model_api_alias="${12}"; parallel_slots="${13}"
cache_key_type="${14}"; cache_value_type="${15}"
model_manifest="${16:-$model_file|0|$model_sha256}"; model_revision="${17:-main}"; lazy_mode="${18:-}"
architecture="${19:-amd64}"; cuda_toolkit_path="${20:-}"; cuda_architectures="${21:-}"
switch_from_user_service="${22:-}"; cuda_toolkit_major_version="${23:-}"; service_owner="${SUDO_USER:-}"
gateway_port="${24:-}"; gateway_service_name="${25:-}"; gateway_listen_address="${26:-}"
remote_gateway_script="${27:-}"; remote_gateway_ui="${28:-}"; switch_from_user_gateway_service="${29:-}"
install_root=/opt/ai-local-provider
source_root="$install_root/src/llama.cpp"; build_root="$install_root/build"; binary_root="$install_root/bin"
model_root="$storage_volume/ai-local-provider/models"; model_path="$model_root/$model_file"

plan_step() { printf '\n[%s] %s\n' "$1" "$2"; }
[[ "$(id -u)" -eq 0 ]] || { echo 'PROVISION_REQUIRES_ROOT' >&2; exit 6; }
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04* ]] || { echo 'UNSUPPORTED_OS' >&2; exit 3; }
[[ -d "$storage_volume" ]] || { echo "STORAGE_VOLUME_MISSING: $storage_volume" >&2; exit 4; }
[[ "$model_api_alias" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { echo 'MODEL_API_ALIAS_INVALID' >&2; exit 4; }
[[ "$parallel_slots" =~ ^[1-9][0-9]*$ ]] || { echo 'PARALLEL_SLOTS_INVALID' >&2; exit 4; }
[[ "$cache_key_type" =~ ^(f16|bf16|q8_0|q4_0)$ ]] || { echo 'CACHE_KEY_TYPE_INVALID' >&2; exit 4; }
[[ "$cache_value_type" =~ ^(f16|bf16|q8_0|q4_0)$ ]] || { echo 'CACHE_VALUE_TYPE_INVALID' >&2; exit 4; }
[[ "$model_revision" =~ ^[A-Fa-f0-9]{40}$ || "$model_revision" == main ]] || { echo 'MODEL_REVISION_INVALID' >&2; exit 4; }
[[ -z "$lazy_mode" || "$lazy_mode" == on ]] || { echo 'LAZY_MODE_INVALID' >&2; exit 4; }
[[ "$architecture" == amd64 || "$architecture" == arm64 ]] || { echo 'ARCHITECTURE_INVALID' >&2; exit 4; }
if [[ -n "$cuda_toolkit_path" ]]; then
  [[ "$cuda_toolkit_path" =~ ^/[A-Za-z0-9._/-]+$ && "$cuda_toolkit_path" != *..* ]] || { echo 'CUDA_TOOLKIT_PATH_INVALID' >&2; exit 4; }
fi
[[ -z "$cuda_architectures" || "$cuda_architectures" =~ ^[0-9]+([;,][0-9]+)*$ ]] || { echo 'CUDA_ARCHITECTURES_INVALID' >&2; exit 4; }
[[ -z "$cuda_toolkit_major_version" || "$cuda_toolkit_major_version" =~ ^[1-9][0-9]*$ ]] || { echo 'CUDA_TOOLKIT_VERSION_INVALID' >&2; exit 4; }
if [[ -n "$gateway_port" ]]; then
  [[ "$gateway_port" =~ ^[0-9]+$ ]] && ((10#$gateway_port >= 1 && 10#$gateway_port <= 65535)) || { echo 'GATEWAY_PORT_INVALID' >&2; exit 4; }
  [[ "$gateway_service_name" =~ ^[A-Za-z0-9][A-Za-z0-9_.@-]*$ ]] || { echo 'GATEWAY_SERVICE_NAME_INVALID' >&2; exit 4; }
  [[ "$gateway_listen_address" =~ ^(0\.0\.0\.0|127\.0\.0\.1|::1)$ ]] || { echo 'GATEWAY_LISTEN_ADDRESS_INVALID' >&2; exit 4; }
  [[ "$remote_gateway_script" == /tmp/ai-local-provider-gateway.*.mjs && "$remote_gateway_ui" == /tmp/ai-local-provider-gateway.*.html && -r "$remote_gateway_script" && -r "$remote_gateway_ui" ]] || { echo 'GATEWAY_STAGING_INVALID' >&2; exit 4; }
fi
if [[ -n "$switch_from_user_service$switch_from_user_gateway_service" ]]; then
  [[ -z "$switch_from_user_service" || "$switch_from_user_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.@-]*\.service$ ]] || { echo 'USER_SERVICE_UNIT_INVALID' >&2; exit 4; }
  [[ -z "$switch_from_user_gateway_service" || "$switch_from_user_gateway_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.@-]*\.service$ ]] || { echo 'USER_GATEWAY_SERVICE_UNIT_INVALID' >&2; exit 4; }
  [[ "$service_owner" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] && id "$service_owner" >/dev/null 2>&1 || { echo 'SERVICE_OWNER_INVALID: SUDO_USER must identify the SSH user.' >&2; exit 4; }
  service_owner_uid="$(id -u "$service_owner")"
  user_runtime_dir="/run/user/$service_owner_uid"
  [[ -S "$user_runtime_dir/bus" ]] || { echo 'USER_SYSTEMD_BUS_UNAVAILABLE' >&2; exit 4; }
  user_systemctl() {
    runuser -u "$service_owner" -- env XDG_RUNTIME_DIR="$user_runtime_dir" DBUS_SESSION_BUS_ADDRESS="unix:path=$user_runtime_dir/bus" systemctl --user "$@"
  }
  if [[ -n "$switch_from_user_service" ]]; then
    user_systemctl is-active --quiet "$switch_from_user_service" || { echo 'USER_SERVICE_NOT_ACTIVE' >&2; exit 4; }
  fi
  if [[ -n "$switch_from_user_gateway_service" ]]; then
    user_systemctl is-active --quiet "$switch_from_user_gateway_service" || { echo 'USER_GATEWAY_SERVICE_NOT_ACTIVE' >&2; exit 4; }
  fi
fi
IFS=',' read -r -a model_entries <<< "$model_manifest"
(( ${#model_entries[@]} > 0 )) || { echo 'MODEL_MANIFEST_INVALID' >&2; exit 4; }
model_total_bytes=0
for model_entry in "${model_entries[@]}"; do
  IFS='|' read -r entry_file entry_size entry_sha extra <<< "$model_entry"
  [[ -z "${extra:-}" && "$entry_file" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.gguf$ && "$entry_size" =~ ^(0|[1-9][0-9]*)$ && "$entry_sha" =~ ^[a-f0-9]{64}$ ]] || { echo 'MODEL_MANIFEST_INVALID' >&2; exit 4; }
  model_total_bytes=$((model_total_bytes + entry_size))
done
[[ "${model_entries[0]%%|*}" == "$model_file" ]] || { echo 'MODEL_MANIFEST_ENTRYPOINT_MISMATCH' >&2; exit 4; }

switch_stopped=false; gateway_switch_stopped=false
install_success=false
restore_user_service() {
  if [[ "$install_success" != true ]]; then
    [[ -z "$gateway_port" ]] || systemctl disable --now "$gateway_service_name" >/dev/null 2>&1 || true
    if [[ "$gateway_switch_stopped" == true ]]; then
      echo "INSTALL_FAILED_RESTORING_USER_GATEWAY: $switch_from_user_gateway_service"
      user_systemctl start "$switch_from_user_gateway_service" || echo "USER_GATEWAY_RESTORE_FAILED: $switch_from_user_gateway_service" >&2
    fi
  fi
  if [[ "$switch_stopped" == true && "$install_success" != true ]]; then
    echo "INSTALL_FAILED_RESTORING_USER_SERVICE: $switch_from_user_service"
    systemctl stop "$service_name" >/dev/null 2>&1 || true
    user_systemctl start "$switch_from_user_service" || echo "USER_SERVICE_RESTORE_FAILED: $switch_from_user_service" >&2
  fi
}
trap restore_user_service EXIT

export DEBIAN_FRONTEND=noninteractive
plan_step AI-LOCAL-04 'Clean disposable system data'
systemd-tmpfiles --clean 2>/dev/null || true
journalctl --vacuum-time=14d >/dev/null 2>&1 || true
apt-get clean
find "$model_root" -maxdepth 1 -type f -name '*.part' -mtime +1 -delete 2>/dev/null || true

plan_step AI-LOCAL-05 'Install native CUDA dependencies'
apt-get update
apt_packages=(acl ca-certificates curl git build-essential cmake gcc-12 g++-12)
[[ -z "$gateway_port" ]] || apt_packages+=(nodejs)
if [[ -z "$cuda_toolkit_path" ]]; then apt_packages+=(nvidia-cuda-toolkit); fi
apt-get install -y "${apt_packages[@]}"
if ! command -v nvidia-smi >/dev/null 2>&1; then
  printf '\n    Installing the recommended NVIDIA driver\n'
  apt-get install -y ubuntu-drivers-common
  ubuntu-drivers install
  echo 'NVIDIA_DRIVER_INSTALLED_REBOOT_REQUIRED'
  exit 20
fi
nvidia-smi >/dev/null
if [[ -n "$cuda_toolkit_path" ]]; then
  [[ -x "$cuda_toolkit_path/bin/nvcc" ]] || { echo 'CUDA_TOOLKIT_NOT_FOUND' >&2; exit 4; }
  export PATH="$cuda_toolkit_path/bin:$PATH"
fi
command -v nvcc >/dev/null || { echo 'CUDA_COMPILER_NOT_FOUND' >&2; exit 4; }
nvcc_output="$(nvcc --version)"
printf '%s\n' "$nvcc_output"
if [[ -n "$cuda_toolkit_major_version" ]] && ! grep -Eq "release ${cuda_toolkit_major_version}([.]|,)" <<<"$nvcc_output"; then
  echo "CUDA_TOOLKIT_VERSION_MISMATCH: expected major $cuda_toolkit_major_version" >&2
  exit 4
fi

printf '\n    Preparing service identity and directories\n'
install -d -m 0755 "$install_root" "$binary_root" "$model_root"
if ! id ai-local-provider >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin ai-local-provider
fi

# Removable and user-mounted volumes commonly deny traversal above an otherwise
# readable model directory. Grant this service identity traversal only; do not
# broaden mode bits or expose sibling files to other users.
storage_parent="$storage_volume"
while [[ "$storage_parent" != / ]]; do
  setfacl -m u:ai-local-provider:--x "$storage_parent"
  storage_parent="$(dirname "$storage_parent")"
done
setfacl -m u:ai-local-provider:r-x "$storage_volume/ai-local-provider" "$model_root"

plan_step AI-LOCAL-06 'Build the pinned runtime'
printf '\n    Fetching pinned llama.cpp source\n'
if [[ ! -d "$source_root/.git" ]]; then
  install -d -m 0755 "$(dirname "$source_root")"
  git clone --filter=blob:none --no-checkout "$runtime_repository" "$source_root"
fi
git -C "$source_root" fetch --depth 1 origin "$runtime_revision"
git -C "$source_root" checkout --detach --force "$runtime_revision"
[[ "$(git -C "$source_root" rev-parse HEAD)" == "$runtime_revision" ]] || { echo 'RUNTIME_REVISION_MISMATCH' >&2; exit 8; }

printf '\n    Building llama.cpp with native CUDA support\n'
cmake_args=(-S "$source_root" -B "$build_root" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=/usr/bin/gcc-12 -DCMAKE_CXX_COMPILER=/usr/bin/g++-12 \
  -DCMAKE_CUDA_HOST_COMPILER=/usr/bin/gcc-12 -DGGML_CUDA=ON -DGGML_NATIVE=ON -DLLAMA_CURL=OFF)
if [[ -n "$cuda_architectures" ]]; then cmake_args+=("-DCMAKE_CUDA_ARCHITECTURES=$cuda_architectures"); fi
cmake "${cmake_args[@]}"
build_jobs="$(nproc)"; ((build_jobs > 16)) && build_jobs=16
cmake --build "$build_root" --config Release --target llama-server --parallel "$build_jobs"
install -m 0755 "$build_root/bin/llama-server" "$binary_root/llama-server"
if [[ -n "$gateway_port" ]]; then
  gateway_root="$install_root/gateway"
  install -d -m 0755 "$gateway_root"
  install -m 0755 "$remote_gateway_script" "$gateway_root/local-model-gateway.mjs"
  install -m 0644 "$remote_gateway_ui" "$gateway_root/index.html"
fi

plan_step AI-LOCAL-07 'Acquire and verify the model files'
for model_entry in "${model_entries[@]}"; do
  IFS='|' read -r entry_file entry_size entry_sha <<< "$model_entry"
  entry_path="$model_root/$entry_file"
  if [[ -f "$entry_path" ]] && { ((entry_size == 0)) || [[ "$(stat -c %s "$entry_path")" == "$entry_size" ]]; } && printf '%s  %s\n' "$entry_sha" "$entry_path" | sha256sum --check --status; then
    echo "MODEL_ALREADY_VERIFIED: $entry_file"
  else
    rm -f -- "$entry_path" 2>/dev/null || true
    curl --fail --location --retry 5 --continue-at - --output "$entry_path.part" \
      "https://huggingface.co/$model_repository/resolve/$model_revision/$entry_file"
    if ((entry_size > 0)); then
      if [[ "$(stat -c %s "$entry_path.part")" != "$entry_size" ]]; then
        rm -f -- "$entry_path.part"
        echo "MODEL_SIZE_MISMATCH: $entry_file" >&2
        exit 8
      fi
    fi
    printf '%s  %s\n' "$entry_sha" "$entry_path.part" | sha256sum --check --status || {
      rm -f -- "$entry_path.part"
      echo "MODEL_CHECKSUM_MISMATCH: $entry_file" >&2; exit 8;
    }
    mv -- "$entry_path.part" "$entry_path"
  fi
  chmod 0644 "$entry_path"
  setfacl -m u:ai-local-provider:r-- "$entry_path"
done

plan_step AI-LOCAL-08 'Reconcile the service'
cat >"/etc/systemd/system/$service_name.service" <<EOF
[Unit]
Description=AI Local Provider (native llama.cpp CUDA)
After=network-online.target

[Service]
User=ai-local-provider
Group=ai-local-provider
Restart=on-failure
RestartSec=5
ExecStart=$binary_root/llama-server -m $model_path --alias $model_api_alias --host $listen_address --port $provider_port -c $context_size -np $parallel_slots -ngl $gpu_layers -ctk $cache_key_type -ctv $cache_value_type${lazy_mode:+ --lazy-mode $lazy_mode}

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$service_name"
if [[ -n "$switch_from_user_service" ]]; then
  printf '\n    Stopping requested user service before provider startup: %s (%s)\n' "$switch_from_user_service" "$service_owner"
  switch_stopped=true
  user_systemctl stop "$switch_from_user_service"
fi
systemctl restart "$service_name"

plan_step AI-LOCAL-09 'Verify the result'
for _ in $(seq 1 90); do
  if curl -fs "http://127.0.0.1:$provider_port/health" >/dev/null; then
    response="$(curl -fsS --max-time 180 -H 'Content-Type: application/json' \
      -d '{"messages":[{"role":"user","content":"Reply with exactly READY"}],"temperature":0,"max_tokens":64,"chat_template_kwargs":{"enable_thinking":false}}' \
      "http://127.0.0.1:$provider_port/v1/chat/completions")"
    grep -q 'READY' <<<"$response" || { echo 'PROVIDER_INFERENCE_VERIFICATION_FAILED' >&2; exit 9; }
    if [[ -n "$gateway_port" ]]; then
      plan_step AI-LOCAL-10 'Reconcile the managed API gateway'
      node_binary="$(command -v node)" || { echo 'GATEWAY_NODE_NOT_FOUND' >&2; exit 9; }
      cat >"/etc/systemd/system/$gateway_service_name.service" <<EOF
[Unit]
Description=AI Local Provider gateway
After=$service_name.service
Requires=$service_name.service

[Service]
User=ai-local-provider
Group=ai-local-provider
Restart=on-failure
RestartSec=3
ExecStart=$node_binary $gateway_root/local-model-gateway.mjs --listen-host $gateway_listen_address --listen-port $gateway_port --upstream http://127.0.0.1:$provider_port --ui-file $gateway_root/index.html

[Install]
WantedBy=multi-user.target
EOF
      systemctl daemon-reload
      systemctl enable "$gateway_service_name"
      if [[ -n "$switch_from_user_gateway_service" ]]; then
        printf '\n    Replacing user gateway: %s (%s)\n' "$switch_from_user_gateway_service" "$service_owner"
        gateway_switch_stopped=true
        user_systemctl stop "$switch_from_user_gateway_service"
      fi
      systemctl restart "$gateway_service_name"
      for _ in $(seq 1 30); do
        if curl -fsS --max-time 5 "http://127.0.0.1:$gateway_port/gateway-health" | grep -q '"ready"'; then
          gateway_response="$(curl -fsS --max-time 180 -H 'Content-Type: application/json' -d '{"model":"'$model_api_alias'","messages":[{"role":"user","content":"Reply with exactly READY"}],"temperature":0,"max_tokens":64,"chat_template_kwargs":{"enable_thinking":false}}' "http://127.0.0.1:$gateway_port/v1/chat/completions")"
          grep -q 'READY' <<<"$gateway_response" || { echo 'GATEWAY_INFERENCE_VERIFICATION_FAILED' >&2; exit 9; }
          break
        fi
        sleep 2
      done
      curl -fsS --max-time 5 "http://127.0.0.1:$gateway_port/gateway-health" | grep -q '"ready"' || { echo 'GATEWAY_HEALTHCHECK_FAILED' >&2; exit 9; }
    fi
    systemctl --no-pager --full status "$service_name" | sed -n '1,12p'
    echo 'AI_LOCAL_PROVIDER_INSTALLED'
    install_success=true
    exit 0
  fi
  restart_count="$(systemctl show "$service_name" -p NRestarts --value 2>/dev/null || echo 0)"
  if [[ "$restart_count" =~ ^[0-9]+$ ]] && ((restart_count >= 3)) && ! systemctl is-active --quiet "$service_name"; then
    journalctl -u "$service_name" -n 80 --no-pager >&2
    echo 'PROVIDER_START_FAILED' >&2
    exit 9
  fi
  sleep 2
done
journalctl -u "$service_name" -n 80 --no-pager >&2
echo 'PROVIDER_HEALTHCHECK_FAILED' >&2
exit 9
