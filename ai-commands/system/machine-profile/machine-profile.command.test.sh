#!/usr/bin/env bash
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
output="$($dir/machine-profile.command.sh --local)"
node -e 'const p=JSON.parse(process.argv[1]); if(p.schema!=="ai-machine-profile.v1" || p.target.kind!=="local" || !p.cpu.logical_cpus || !p.memory.total_kb) process.exit(1)' "$output"
grep -Fq 'Usage: machine-profile.command.sh' < <("$dir/machine-profile.command.sh" --help)
printf '%s\n' 'machine-profile tests: PASS'
