#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
fixture_dir="$script_dir/fixtures/hermes-file-tools"

if [[ $# -ne 4 ]]; then
  printf 'usage: %s RUN_DIRECTORY MODEL PROVIDER ENDPOINT\n' "$0" >&2
  exit 2
fi

run_dir="$1"
model="$2"
provider="$3"
endpoint="$4"
pi_bin="${PI_BIN:-pi}"

mkdir -p "$run_dir/.pi-benchmark"
cp "$fixture_dir/INPUT.txt" "$fixture_dir/TASK.md" "$run_dir/"
rm -f "$run_dir/NORMALIZED.txt" "$run_dir/REPORT.txt" "$run_dir/pi-events.jsonl" "$run_dir/wall-time-seconds.txt"

node - "$run_dir/.pi-benchmark/models.json" "$provider" "$model" "$endpoint" <<'NODE'
const fs = require('node:fs');
const [file, provider, model, endpoint] = process.argv.slice(2);
const url = new URL(endpoint);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) process.exit(2);
fs.writeFileSync(file, JSON.stringify({ providers: { [provider]: { baseUrl: url.toString().replace(/\/$/, ''), api: 'openai-completions', apiKey: 'local', models: [{ id: model, contextWindow: 8192 }] } } }, null, 2) + '\n', { mode: 0o600 });
NODE
printf '%s\n' '{"defaultThinkingLevel":"low"}' >"$run_dir/.pi-benchmark/settings.json"

prompt="$(<"$run_dir/TASK.md")"
time_output="$run_dir/.pi-benchmark/time.txt"
/usr/bin/time -p -o "$time_output" env PI_CODING_AGENT_DIR="$run_dir/.pi-benchmark" \
  bash -c 'cd "$1" && exec "$2" --print --mode json --no-session --no-extensions --no-mcp --no-skills --no-prompt-templates --no-context-files --approve --provider "$3" --model "$4" --thinking low --tools "read,bash,edit,write" -- "$5"' \
  _ "$run_dir" "$pi_bin" "$provider" "$model" "$prompt" >"$run_dir/pi-events.jsonl"

awk '$1 == "real" { print $2; found=1 } END { if (!found) exit 1 }' "$time_output" >"$run_dir/wall-time-seconds.txt"
"$fixture_dir/verify.sh" "$run_dir"
printf 'wall_time_seconds=%s\n' "$(<"$run_dir/wall-time-seconds.txt")"
