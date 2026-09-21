#!/usr/bin/env bash
set -euo pipefail

cache_dir="${1:-}"
image="${2:-}"
[[ "$cache_dir" =~ ^/[-A-Za-z0-9._/]+$ ]] || { printf '%s\n' 'MODEL_AUTH_INVALID_CACHE_PATH' >&2; exit 2; }
[[ "$image" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]+$ ]] || { printf '%s\n' 'MODEL_AUTH_INVALID_IMAGE' >&2; exit 2; }
IFS= read -r token
[[ "$token" =~ ^hf_[A-Za-z0-9]+$ ]] || { printf '%s\n' 'MODEL_AUTH_INVALID_TOKEN' >&2; exit 2; }

mkdir -p "$cache_dir"
chmod 0700 "$cache_dir"
docker image inspect "$image" >/dev/null
export HF_TOKEN="$token"
unset token
docker run --rm \
  -e HF_TOKEN \
  -v "$cache_dir:/root/.cache/huggingface" \
  --entrypoint python3 \
  "$image" \
  -c 'import os; from huggingface_hub import HfApi, login; token = os.environ["HF_TOKEN"]; login(token=token, add_to_git_credential=False); account = HfApi().whoami(token=token); print("Authenticated Hugging Face account:", account.get("name", "unknown"))'
unset HF_TOKEN
host_uid="$(id -u)"; host_gid="$(id -g)"
docker run --rm \
  -v "$cache_dir:/hf-cache" \
  --entrypoint chown \
  "$image" \
  -R "$host_uid:$host_gid" /hf-cache
test -s "$cache_dir/token"
chmod 0600 "$cache_dir/token"
printf '%s\n' 'SUCCESS: Hugging Face read token authenticated and stored in the owner-only model cache.'
