#!/usr/bin/env bash
set -euo pipefail

required=(IMAGE_GENERATOR_INSTANCE IMAGE_RUNTIME_IMAGE IMAGE_HARNESS_DIR IMAGE_OUTPUT_DIR)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { printf 'ERROR: %s is required\n' "$name" >&2; exit 64; }
done

for name in IMAGE_HARNESS_DIR IMAGE_OUTPUT_DIR; do
  [[ "${!name}" == /* ]] || { printf 'ERROR: %s must be an absolute path\n' "$name" >&2; exit 64; }
done

[[ "$IMAGE_GENERATOR_INSTANCE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || {
  printf 'ERROR: invalid IMAGE_GENERATOR_INSTANCE\n' >&2
  exit 64
}

container="ai-image-generator-${IMAGE_GENERATOR_INSTANCE}"
accelerator="${IMAGE_ACCELERATOR:-nvidia}"
network_mode="${IMAGE_NETWORK_MODE:-host}"
[[ "$network_mode" == host || "$network_mode" == bridge ]] || {
  printf 'ERROR: IMAGE_NETWORK_MODE must be host or bridge\n' >&2
  exit 64
}

docker_args=(run --rm --name "$container" --network "$network_mode" --ipc host)
case "$accelerator" in
  nvidia) docker_args+=(--gpus all) ;;
  rocm) docker_args+=(--device /dev/kfd --device /dev/dri --group-add video) ;;
  cpu) ;;
  *) printf 'ERROR: IMAGE_ACCELERATOR must be nvidia, rocm, or cpu\n' >&2; exit 64 ;;
esac

mkdir -p -- "$IMAGE_OUTPUT_DIR"
docker_args+=(-v "$IMAGE_HARNESS_DIR:/benchmark:ro" -v "$IMAGE_OUTPUT_DIR:/outputs")
[[ -z "${IMAGE_MODELS_DIR:-}" ]] || docker_args+=(-v "$IMAGE_MODELS_DIR:/models:ro")
[[ -z "${IMAGE_CACHE_DIR:-}" ]] || docker_args+=(-v "$IMAGE_CACHE_DIR:/root/.cache/huggingface")
[[ -z "${IMAGE_POLICY_TOKEN_DIR:-}" ]] || docker_args+=(-v "$IMAGE_POLICY_TOKEN_DIR:/run/policy-tokens:ro")

forwarded=(
  IMAGE_MODEL_ID IMAGE_MODEL_REVISION IMAGE_MODEL_FILE IMAGE_PIPELINE_TYPE IMAGE_DTYPE
  IMAGE_DEFAULT_STEPS IMAGE_DEFAULT_GUIDANCE IMAGE_GUIDANCE_PARAMETER IMAGE_DEFAULT_NEGATIVE_PROMPT
  IMAGE_DEFAULT_SIZE IMAGE_MAX_WIDTH IMAGE_MAX_HEIGHT IMAGE_MAX_PIXELS IMAGE_MAX_STEPS
  IMAGE_MIN_AVAILABLE_BYTES IMAGE_EMERGENCY_AVAILABLE_BYTES IMAGE_MEMORY_POLL_SECONDS
  IMAGE_EXIT_ON_MEMORY_EMERGENCY IMAGE_RELEASE_CACHE_AFTER_GENERATION IMAGE_POLICY_PRESET
  IMAGE_POLICY_SEMANTIC_INPUT IMAGE_POLICY_SEMANTIC_OUTPUT IMAGE_POLICY_MODERATION_URL
  IMAGE_POLICY_MODERATION_TIMEOUT_SECONDS IMAGE_POLICY_MODERATION_AUTH_TOKEN_FILE IMAGE_PORT
)
for name in "${forwarded[@]}"; do
  docker_args+=(-e "$name")
done

exec /usr/bin/docker "${docker_args[@]}" --entrypoint python3 "$IMAGE_RUNTIME_IMAGE" /benchmark/serve.py
