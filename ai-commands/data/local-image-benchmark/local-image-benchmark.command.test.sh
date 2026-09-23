#!/usr/bin/env bash
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
command="$dir/local-image-benchmark.command.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/local-image-benchmark-test.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT

out="$(bash "$command" help)"
grep -Fq 'files are internal workers' <<<"$out"
grep -Fq -- '--confirm-model-isolated' <<<"$out"
grep -Fq -- '--guidance-parameter guidance_scale|true_cfg_scale|none' <<<"$out"
grep -Fq -- '--policy-preset ID' <<<"$out"
grep -Fq -- '--deterministic-input true|false' <<<"$out"
grep -Fq -- '--semantic-input true|false' <<<"$out"
grep -Fq -- 'evaluate-policy --endpoint URL' <<<"$out"
python3 "$dir/runtime/test_safety.py"
python3 "$dir/runtime/test_generation_policy.py"
python3 "$dir/runtime/test_policy_moderation.py"
python3 "$dir/runtime/test_ollama_policy_service.py"
python3 -m py_compile "$dir/runtime/evaluate_policy_moderator.py"
grep -Fq 'Restart=on-failure' "$dir/assets/systemd/local-image-generator@.service"
grep -Fq 'IMAGE_GENERATOR_INSTANCE=%i' "$dir/assets/systemd/local-image-generator@.service"
grep -Fq 'IMAGE_EMERGENCY_AVAILABLE_BYTES' "$dir/runtime/run_image_generator_container.sh"
grep -Fq 'IMAGE_POLICY_MODERATION_URL' "$dir/runtime/run_image_generator_container.sh"
grep -Fq 'IMAGE_ACCELERATOR must be nvidia, rocm, or cpu' "$dir/runtime/run_image_generator_container.sh"
grep -Fq 'ollama_policy_service.py' "$dir/assets/systemd/ai-policy-evaluator.service"
grep -Fq 'IMAGE_DEFAULT_SIZE=1344x768' "$dir/assets/env/presets/qwen-image.env.example"
grep -Fq 'IMAGE_POLICY_PRESET=unrestricted' "$dir/assets/env/presets/qwen-image.env.example"
grep -Fq 'IMAGE_POLICY_SEMANTIC_INPUT=false' "$dir/assets/env/presets/qwen-image.env.example"

set +e
out="$(IMAGE_GENERATOR_INSTANCE=test IMAGE_RUNTIME_IMAGE=example/runtime IMAGE_HARNESS_DIR="$test_root" \
  IMAGE_OUTPUT_DIR="$test_root/outputs" IMAGE_ACCELERATOR=invalid \
  bash "$dir/runtime/run_image_generator_container.sh" 2>&1)"
code=$?
set -e
[[ $code -eq 64 ]]
grep -Fq 'IMAGE_ACCELERATOR must be nvidia, rocm, or cpu' <<<"$out"

out="$(bash "$command" candidates)"
grep -Fq 'qwen-image-bf16' <<<"$out"
grep -Fq 'Qwen/Qwen-Image' <<<"$out"
grep -Fq 'flux2-dev-bf16' <<<"$out"
grep -Fq 'evaluation only' <<<"$out"

private_label_pattern='m''ax([ -]anime)? workflow|workflow.{0,20}m''ax'
if grep -Eiq "$private_label_pattern" \
  "$dir/../../../notes/benchmarks/README.md" \
  "$dir/../../../notes/benchmarks/local-image-generation/README.md" \
  "$dir/../../../notes/benchmarks/local-image-generation/candidates.json" \
  "$dir/../../../notes/benchmarks/local-image-generation/cases.json"; then
  printf '%s\n' 'public benchmark metadata contains a private workflow label' >&2
  exit 1
fi

cat >"$test_root/results.jsonl" <<'EOF'
{"candidate_id":"example","case_id":"sample","generation_seconds":2.0,"generation_peak_system_used_bytes":1073741824,"torch_peak_reserved_bytes":536870912}
{"candidate_id":"example","case_id":"sample","generation_seconds":4.0,"generation_peak_system_used_bytes":2147483648,"torch_peak_reserved_bytes":1073741824}
EOF
out="$(bash "$command" summarize "$test_root/results.jsonl")"
grep -Fq '| example | sample | 2 | 3.00 s | 2.0 GiB | 1.0 GiB |' <<<"$out"

set +e
out="$(bash "$command" run --candidate flux2-dev-bf16 --output-root "$test_root" 2>&1)"
code=$?
set -e
[[ $code -eq 64 ]]
grep -Fq 'MODEL_ISOLATION_CONFIRMATION_REQUIRED' <<<"$out"

set +e
out="$(bash "$command" unknown 2>&1)"
code=$?
set -e
[[ $code -eq 64 ]]
grep -Fq 'unknown action' <<<"$out"

printf '%s\n' 'local-image-benchmark command tests: PASS'
