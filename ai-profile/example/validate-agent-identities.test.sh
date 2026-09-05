#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="${ROOT}/validate-agent-identities.py"
SOURCE="${ROOT}/agent-identities.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

python3 "${VALIDATOR}" "${SOURCE}" example.com >/dev/null

duplicate="${TMP}/duplicate.yml"
cp "${SOURCE}" "${duplicate}"
printf '%s\n' 'enabled: false' >> "${duplicate}"
if python3 "${VALIDATOR}" "${duplicate}" example.com >/dev/null 2>&1; then
  echo 'Duplicate YAML key was accepted' >&2
  exit 1
fi

private_email="${TMP}/private-email.yml"
sed 's/admin@example\.com/admin@private\.invalid/' "${SOURCE}" > "${private_email}"
if python3 "${VALIDATOR}" "${private_email}" example.com >/dev/null 2>&1; then
  echo 'Private-domain role email was accepted' >&2
  exit 1
fi

duplicate_login="${TMP}/duplicate-login.yml"
sed 's/example-design/example-admin/' "${SOURCE}" > "${duplicate_login}"
if python3 "${VALIDATOR}" "${duplicate_login}" example.com >/dev/null 2>&1; then
  echo 'Duplicate provider login was accepted' >&2
  exit 1
fi

extra_key="${TMP}/extra-key.yml"
cp "${SOURCE}" "${extra_key}"
printf '%s\n' 'unexpected: value' >> "${extra_key}"
if python3 "${VALIDATOR}" "${extra_key}" example.com >/dev/null 2>&1; then
  echo 'Unexpected top-level key was accepted' >&2
  exit 1
fi

bad_mode="${TMP}/bad-mode.yml"
sed 's/public_repository_mode: provenance-only/public_repository_mode: provider-account/' "${SOURCE}" > "${bad_mode}"
if python3 "${VALIDATOR}" "${bad_mode}" example.com >/dev/null 2>&1; then
  echo 'Unsafe public repository mode was accepted' >&2
  exit 1
fi

empty_display="${TMP}/empty-display.yml"
perl -0pe 's/display_name: Admin/display_name: /' "${SOURCE}" > "${empty_display}"
if python3 "${VALIDATOR}" "${empty_display}" example.com >/dev/null 2>&1; then
  echo 'Empty display name was accepted' >&2
  exit 1
fi

echo 'Agent identity validator tests: PASS'
