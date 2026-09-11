#!/usr/bin/env bash
set -euo pipefail

storage_volume="$1"; model_repository="$2"; model_file="$3"; model_sha256="$4"
runtime_repository="$5"; runtime_revision="$6"; context_size="$7"; gpu_layers="$8"
listen_address="$9"; provider_port="${10}"; service_name="${11}"; model_api_alias="${12}"
install_root=/opt/ai-local-provider
source_root="$install_root/src/llama.cpp"; build_root="$install_root/build"; binary_root="$install_root/bin"
model_root="$storage_volume/ai-local-provider/models"; model_path="$model_root/$model_file"

plan_step() { printf '\n[%s] %s\n' "$1" "$2"; }
[[ "$(id -u)" -eq 0 ]] || { echo 'PROVISION_REQUIRES_ROOT' >&2; exit 6; }
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04* ]] || { echo 'UNSUPPORTED_OS' >&2; exit 3; }
[[ -d "$storage_volume" ]] || { echo "STORAGE_VOLUME_MISSING: $storage_volume" >&2; exit 4; }
[[ "$model_api_alias" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { echo 'MODEL_API_ALIAS_INVALID' >&2; exit 4; }

export DEBIAN_FRONTEND=noninteractive
plan_step AI-LOCAL-04 'Clean disposable system data'
systemd-tmpfiles --clean 2>/dev/null || true
journalctl --vacuum-time=14d >/dev/null 2>&1 || true
apt-get clean
find "$model_root" -maxdepth 1 -type f -name '*.part' -mtime +1 -delete 2>/dev/null || true

plan_step AI-LOCAL-05 'Install native CUDA dependencies'
apt-get update
apt-get install -y acl ca-certificates curl git build-essential cmake gcc-12 g++-12 nvidia-cuda-toolkit
if ! command -v nvidia-smi >/dev/null 2>&1; then
  printf '\n    Installing the recommended NVIDIA driver\n'
  apt-get install -y ubuntu-drivers-common
  ubuntu-drivers install
  echo 'NVIDIA_DRIVER_INSTALLED_REBOOT_REQUIRED'
  exit 20
fi
nvidia-smi >/dev/null
nvcc --version

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
cmake -S "$source_root" -B "$build_root" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=/usr/bin/gcc-12 -DCMAKE_CXX_COMPILER=/usr/bin/g++-12 \
  -DCMAKE_CUDA_HOST_COMPILER=/usr/bin/gcc-12 -DGGML_CUDA=ON -DGGML_NATIVE=ON -DLLAMA_CURL=OFF
build_jobs="$(nproc)"; ((build_jobs > 16)) && build_jobs=16
cmake --build "$build_root" --config Release --target llama-server --parallel "$build_jobs"
install -m 0755 "$build_root/bin/llama-server" "$binary_root/llama-server"

plan_step AI-LOCAL-07 'Acquire and verify the model'
if [[ -f "$model_path" ]] && printf '%s  %s\n' "$model_sha256" "$model_path" | sha256sum --check --status; then
  echo 'MODEL_ALREADY_VERIFIED'
else
  curl --fail --location --retry 5 --continue-at - --output "$model_path.part" \
    "https://huggingface.co/$model_repository/resolve/main/$model_file"
  printf '%s  %s\n' "$model_sha256" "$model_path.part" | sha256sum --check --status || {
    rm -f -- "$model_path.part"; echo 'MODEL_CHECKSUM_MISMATCH' >&2; exit 8;
  }
  mv -- "$model_path.part" "$model_path"
fi
chmod 0644 "$model_path"
setfacl -m u:ai-local-provider:r-- "$model_path"

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
ExecStart=$binary_root/llama-server -m $model_path --alias $model_api_alias --host $listen_address --port $provider_port -c $context_size -ngl $gpu_layers

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now "$service_name"

plan_step AI-LOCAL-09 'Verify the result'
for _ in $(seq 1 90); do
  if curl -fs "http://127.0.0.1:$provider_port/health" >/dev/null; then
    response="$(curl -fsS --max-time 180 -H 'Content-Type: application/json' \
      -d '{"messages":[{"role":"user","content":"Reply with exactly READY"}],"temperature":0,"max_tokens":8}' \
      "http://127.0.0.1:$provider_port/v1/chat/completions")"
    grep -q 'READY' <<<"$response" || { echo 'PROVIDER_INFERENCE_VERIFICATION_FAILED' >&2; exit 9; }
    systemctl --no-pager --full status "$service_name" | sed -n '1,12p'
    echo 'AI_LOCAL_PROVIDER_INSTALLED'
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
