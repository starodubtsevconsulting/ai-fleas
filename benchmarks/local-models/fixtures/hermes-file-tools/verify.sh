#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
run_dir=${1:?usage: verify.sh RUN_DIRECTORY}

cmp "$script_dir/EXPECTED_NORMALIZED.txt" "$run_dir/NORMALIZED.txt"
cmp "$script_dir/EXPECTED_REPORT.txt" "$run_dir/REPORT.txt"

printf '%s\n' 'PASS: generated files match the benchmark fixture'
