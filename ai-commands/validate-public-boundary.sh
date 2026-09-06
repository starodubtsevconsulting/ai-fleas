#!/usr/bin/env bash
set -euo pipefail

readonly COMMANDS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

fail() {
  printf 'public command boundary: FAIL: %s\n' "$1" >&2
  exit 1
}

populated_configs="$({
  find "${COMMANDS_ROOT}" -type f \
    \( -name '*.config' -o -name '*.conf' -o -name '.env' -o -name '.env.*' \) \
    ! -name '*.example.config' \
    ! -path '*/node_modules/*' ! -path '*/.venv/*'
} || true)"
if [[ -n "${populated_configs}" ]]; then
  printf '%s\n' "${populated_configs}" >&2
  fail 'operational configuration found in reusable command catalog; move it to an AI Profile'
fi

while IFS= read -r example_config; do
  if ! head -n 3 "$example_config" | rg -Fq 'TEMPLATE ONLY: copy into the selected AI Profile'; then
    printf '%s\n' "$example_config" >&2
    fail 'command config example must say that it is a profile template and must not be populated in ai-commands'
  fi
  if awk -F= '
    BEGIN { IGNORECASE=1 }
    /^[[:space:]]*(API_KEY|TOKEN|PASSWORD|SECRET|PRIVATE_KEY|CLIENT_SECRET|USER_ID|RENTAL_ID)[[:space:]]*=/ {
      value=$0; sub(/^[^=]*=/, "", value); gsub(/^[[:space:]\"]+|[[:space:]\"]+$/, "", value)
      safe=(value == "" || value ~ /^\[(TODO|REDACTED|PLACEHOLDER)\]$/ || value ~ /^<[^>]+>$/ || value ~ /^(YOUR_|EXAMPLE|CHANGE_ME)/)
      if (!safe) exit 1
    }
  ' "$example_config"; then :; else
    printf '%s\n' "$example_config" >&2
    fail 'command config example appears to contain a populated identifier or secret'
  fi
done < <(find "${COMMANDS_ROOT}" -type f \
  \( -name '*.example.config' -o -name '*.example.env' \) \
  ! -path '*/node_modules/*' ! -path '*/.venv/*' | sort)

while IFS= read -r shell_entrypoint; do
  if ! head -n 8 "$shell_entrypoint" | rg -Fq 'ai_command_require_profile'; then
    printf '%s\n' "$shell_entrypoint" >&2
    fail 'shell command entrypoint does not enforce an activated AI Profile'
  fi
done < <(find "${COMMANDS_ROOT}" -type f -name '*.command.sh' \
  ! -path '*/node_modules/*' ! -path '*/.venv/*' | sort)

for module_entrypoint in \
  "${COMMANDS_ROOT}/kdenlive/kdenlive.command.mjs" \
  "${COMMANDS_ROOT}/lodgify/lodgify.command.mjs"; do
  rg -Fq 'requireCommandProfile' "$module_entrypoint" || {
    printf '%s\n' "$module_entrypoint" >&2
    fail 'module command entrypoint does not enforce an activated AI Profile'
  }
done

if rg -n -S '(SCRIPT_DIR|script_dir|commandDirectory)[^\n]*(command\.(config|conf)|lodgify\.config)' \
  "${COMMANDS_ROOT}" \
  --glob '*.{sh,mjs,cjs,py}' \
  --glob '!*.test.*' \
  --glob '!**/node_modules/**' \
  --glob '!**/.venv/**'; then
  fail 'command-local operational config discovery found; resolve configuration through the active AI Profile'
fi

if rg -n -i -S \
  '(starodub|siriusxm|\bsxm\b|\bsc-services\b|locusesse|\bai-fleas-platform\b|/users/|/home/sergii|10\.0\.0\.|192\.168\.|incorparated)' \
  "${COMMANDS_ROOT}" \
  --glob '!validate-public-boundary.sh' \
  --glob '!**/.venv/**' \
  --glob '!**/node_modules/**'; then
  fail 'private organization, project, machine, network, or user-specific content found'
fi

if rg -n -S 'rules/commands/|\./commands/' \
  "${COMMANDS_ROOT}" \
  --glob '!validate-public-boundary.sh' \
  --glob '!**/.venv/**' \
  --glob '!**/node_modules/**'; then
  fail 'legacy command-root reference found; use ai-commands/'
fi

if rg -n -S 'ai-commands/projects/|projects-registry\.ya?ml' \
  "${COMMANDS_ROOT}" \
  --glob '!validate-public-boundary.sh' \
  --glob '!**/.venv/**' \
  --glob '!**/node_modules/**'; then
  fail 'command-owned project registry found; resolve one project through AI_PROFILE_PROJECT_FILE'
fi

legacy_markdown="$({
  rg -n -S 'commands/' "${COMMANDS_ROOT}" --glob '*.md' \
    | rg -v 'ai-commands/|commands/queries|commands:[[:space:]]*$|config: commands/source-control/config.yml'
} || true)"
if [[ -n "${legacy_markdown}" ]]; then
  printf '%s\n' "${legacy_markdown}" >&2
  fail 'ambiguous commands/ path found in Markdown; use ai-commands/'
fi

node "${COMMANDS_ROOT}/validate-structure.mjs"

printf '%s\n' 'public command boundary: PASS'
