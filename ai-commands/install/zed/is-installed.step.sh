#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$root_dir/scripts/is-installed.step.sh" --cmd zed
