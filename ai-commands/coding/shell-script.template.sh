#!/usr/bin/env bash
set -euo pipefail

# User-tunable inputs (override via env)
APP_ID="${APP_ID:-example-app}"
APP_VERSION="${APP_VERSION:-1.0.0}"
ENV="${ENV:-local}"
BASE_URL="${BASE_URL:-}"

# Required inputs (fail fast)
if [[ -z "${APP_ID}" || -z "${APP_VERSION}" ]]; then
  echo "Missing required inputs. Set: APP_ID, APP_VERSION" >&2
  exit 1
fi

# Minimal env -> URL mapping (keep it small)
if [[ -z "${BASE_URL}" ]]; then
  case "${ENV}" in
    local) BASE_URL="http://127.0.0.1:8080" ;;
    dev)   BASE_URL="https://service.dev.example.com" ;;
    test)  BASE_URL="https://service.test.example.com" ;;
    *)     echo "Unknown ENV=${ENV}. Set BASE_URL explicitly." >&2; exit 1 ;;
  esac
fi

# Main logic (fail fast, concise output)
run_curl() {
  local label="$1"; shift
  local status
  status=$(curl -sS -o /tmp/script.out -w "%{http_code}" "$@" || true)
  printf "[%s] HTTP %s\n" "$label" "$status"
  if [[ "$status" -ge 400 ]]; then
    echo "Response body:"; sed -n '1,200p' /tmp/script.out
    exit 1
  fi
}

run_curl "Example GET" \
  -X GET "${BASE_URL}/health"
