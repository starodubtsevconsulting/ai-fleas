#!/usr/bin/env bash
if [[ -n "${ROOT_DIR:-}" && "$(basename "$ROOT_DIR")" == "ai-commands" ]]; then
  ROOT_DIR="$(cd "$ROOT_DIR/.." && pwd -P)"
fi
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/runtime-paths.sh"
