#!/usr/bin/env bash
set -euo pipefail
readonly SCRIPT="$(cd "$(dirname "$0")" && pwd)/install-hermes.sh"
readonly COMMIT='fcbd1076a93841fa88855acce810e342a5b78101'
readonly SYSTEM_TMPDIR="${TMPDIR:-/tmp}"
tests=0
fail() { echo "not ok - $1" >&2; exit 1; }
fixture() { root="$(mktemp -d "${SYSTEM_TMPDIR}/install-hermes-test.XXXXXX")"; export HOME="${root}/home"; export HERMES_HOME="${HOME}/.hermes" TMPDIR="${root}/tmp"; mkdir -p "${HERMES_HOME}/hermes-agent/venv/bin" "${HOME}/.local/bin" "${root}/bin" "${TMPDIR}"; export PATH="${root}/bin:/usr/bin:/bin"; printf '#!/bin/sh\n[ "$1" = -s ] && echo Darwin || echo arm64\n' > "${root}/bin/uname"; printf '#!/bin/sh\ncase "$*" in *" status"*) exit 0 ;; *) echo "%s" ;; esac\n' "${COMMIT}" > "${root}/bin/git"; chmod +x "${root}/bin/uname" "${root}/bin/git"; }
wrapper() { local name="$1" entry="$2"; printf '#!/usr/bin/env bash\nunset PYTHONPATH\nunset PYTHONHOME\nexec "%s/venv/bin/python" "%s/%s" "$@"\n' "${HERMES_HOME}/hermes-agent" "${HERMES_HOME}/hermes-agent" "${entry}" > "${HOME}/.local/bin/${name}"; chmod +x "${HOME}/.local/bin/${name}"; }
valid_layout() { wrapper hermes hermes; wrapper hermes-agent run_agent.py; printf '#!/usr/bin/env bash\nunset PYTHONPATH\nunset PYTHONHOME\nexec "%s/venv/bin/python" "%s/hermes" acp "$@"\n' "${HERMES_HOME}/hermes-agent" "${HERMES_HOME}/hermes-agent" > "${HOME}/.local/bin/hermes-acp"; chmod +x "${HOME}/.local/bin/hermes-acp"; }
finish() { rm -rf -- "${root}"; tests=$((tests + 1)); echo "ok - $1"; }
fixture; printf '#!/bin/sh\necho Linux\n' > "${root}/bin/uname"; chmod +x "${root}/bin/uname"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail platform; finish 'unsupported platform'
fixture; valid_layout; echo keep > "${HERMES_HOME}/config.yaml"; mkdir -p "${HERMES_HOME}/sessions" "${HERMES_HOME}/logs"; echo keep > "${HERMES_HOME}/sessions/s"; echo keep > "${HERMES_HOME}/logs/l"; output="$(/bin/bash "${SCRIPT}" --dry-run)"; [[ "${output}" == *'Would remove installer-owned checkout'* ]] || fail dryrun; [[ -d "${HERMES_HOME}/hermes-agent" && "$(cat "${HERMES_HOME}/sessions/s")" == keep ]] || fail preserve; finish 'dry-run and preservation'
fixture; valid_layout; rm -rf "${HERMES_HOME}/hermes-agent"; ln -s "${HOME}" "${HERMES_HOME}/hermes-agent"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail checkout_escape; finish 'checkout symlink rejected'
fixture; valid_layout; rm "${HOME}/.local/bin/hermes"; ln -s /bin/sh "${HOME}/.local/bin/hermes"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail command_escape; finish 'command symlink rejected'
fixture; valid_layout; rm "${HOME}/.local/bin/hermes-acp"; ln -s "${HOME}/missing" "${HOME}/.local/bin/hermes-acp"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail dangling; [[ -d "${HERMES_HOME}/hermes-agent" ]] || fail atomic_dangling; finish 'dangling command rejected atomically'
fixture; valid_layout; printf '#!/bin/sh\nexec /tmp/foreign\n' > "${HOME}/.local/bin/hermes-agent"; chmod +x "${HOME}/.local/bin/hermes-agent"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail wrapper; [[ -f "${HOME}/.local/bin/hermes" ]] || fail mixed_atomic; finish 'unexpected wrapper rejects mixed set atomically'
fixture; valid_layout; mkdir "${HERMES_HOME}/.install-hermes.lock"; printf '%s\n' "$$" > "${HERMES_HOME}/.install-hermes.lock/pid"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail concurrent_lock; [[ -d "${HERMES_HOME}/hermes-agent" ]] || fail concurrent_mutation; finish 'concurrent lock refuses without mutation'
fixture; valid_layout; mkdir "${HERMES_HOME}/.install-hermes.lock"; echo 999999 > "${HERMES_HOME}/.install-hermes.lock/pid"; /bin/bash "${SCRIPT}" --dry-run >/dev/null; [[ ! -e "${HERMES_HOME}/.install-hermes.lock" ]] || fail stale_cleanup; finish 'stale lock is replaced and cleaned'
fixture; valid_layout; cat > "${root}/bin/ps" <<EOF
#!/bin/sh
cat <<'PROCESSES'
 401 1 ${HERMES_HOME}/hermes-agent/scripts/install.sh bash ${HERMES_HOME}/hermes-agent/scripts/install.sh
 402 401 /usr/bin/npm npm exec playwright install chromium
 403 402 /usr/bin/node node playwright install chromium
 501 1 /usr/bin/node node /unrelated/launcher.js --note=${HERMES_HOME}/hermes-agent
PROCESSES
EOF
chmod +x "${root}/bin/ps"; output="$(/bin/bash "${SCRIPT}" --dry-run)"; [[ "${output}" == *'401'* && "${output}" == *'402'* && "${output}" == *'403'* && "${output}" != *'501'* ]] || fail ownership; finish 'exact owned ancestry excludes unrelated node'
fixture; valid_layout; echo keep > "${HERMES_HOME}/config.yaml"; cat > "${HERMES_HOME}/hermes-agent/owned-process.sh" <<'EOF'
#!/bin/bash
trap '' TERM
sleep 60 &
wait
EOF
chmod +x "${HERMES_HOME}/hermes-agent/owned-process.sh"; /bin/bash "${HERMES_HOME}/hermes-agent/owned-process.sh" & owned_pid=$!; sleep 1
cat > "${root}/bin/curl" <<'EOF'
#!/bin/sh
while [ "$#" -gt 0 ]; do [ "$1" = --output ] && { shift; echo installer > "$1"; exit; }; shift; done
EOF
cat > "${root}/bin/python3" <<EOF
#!/bin/sh
mkdir -p '${HERMES_HOME}/hermes-agent/.git' '${HERMES_HOME}/hermes-agent/venv/bin' '${HOME}/.local/bin'
cat > '${HOME}/.local/bin/hermes' <<'INNER'
#!/bin/sh
echo 'Hermes Agent v0.20.5 (2026.8.19)'
INNER
chmod +x '${HOME}/.local/bin/hermes'
exit 0
EOF
cat > "${root}/bin/git" <<EOF
#!/bin/sh
case "\$*" in *' status'*) exit 0 ;; *) echo '${COMMIT}' ;; esac
EOF
chmod +x "${root}/bin/curl" "${root}/bin/python3" "${root}/bin/git"
if ! output="$(/bin/bash "${SCRIPT}" 2>&1)"; then fail "smart install failed: ${output}"; fi; wait "${owned_pid}" 2>/dev/null || true; ! kill -0 "${owned_pid}" 2>/dev/null || fail owned_survived; [[ "$(cat "${HERMES_HOME}/config.yaml")" == keep ]] || fail smart_preserve; [[ "${output}" == *'Browser tooling: skipped'* ]] || fail browser_status; finish 'owned TERM/KILL cleanup and normal skip-browser completion'
fixture; valid_layout; echo keep > "${HERMES_HOME}/hermes-agent/config.yaml"; printf '#!/bin/sh\ncase "$*" in *" status"*) echo "?? config.yaml" ;; *) echo "%s" ;; esac\n' "${COMMIT}" > "${root}/bin/git"; chmod +x "${root}/bin/git"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail colocated; [[ "$(cat "${HERMES_HOME}/hermes-agent/config.yaml")" == keep ]] || fail lost; finish 'unclassified co-located data fails closed'
fixture; valid_layout; cat > "${root}/bin/curl" <<'EOF'
#!/bin/sh
while [ "$#" -gt 0 ]; do [ "$1" = --output ] && { shift; echo installer > "$1"; exit; }; shift; done
EOF
printf '#!/bin/sh\nexit 7\n' > "${root}/bin/bash"; chmod +x "${root}/bin/curl" "${root}/bin/bash"; before_wrapper="$(cat "${HOME}/.local/bin/hermes")"; ! /bin/bash "${SCRIPT}" >/dev/null 2>&1 || fail installer; [[ -d "${HERMES_HOME}/hermes-agent" ]] || fail rollback_checkout; [[ "$(cat "${HOME}/.local/bin/hermes")" == "${before_wrapper}" ]] || fail rollback_wrapper; [[ -z "$(find "${HERMES_HOME}" -maxdepth 1 -name '.install-hermes-backup.*' -print -quit)" ]] || fail rollback_backup; [[ -z "$(find "${TMPDIR}" -name 'install-hermes.*' -print -quit)" ]] || fail temp; finish 'installer failure restores exact checkout and wrappers'
fixture; valid_layout; printf '\n# contains expected paths but is not canonical\n' >> "${HOME}/.local/bin/hermes"; malformed_before="$(cat "${HOME}/.local/bin/hermes")"; ! /bin/bash "${SCRIPT}" --dry-run >/dev/null 2>&1 || fail malformed_wrapper; [[ "$(cat "${HOME}/.local/bin/hermes")" == "${malformed_before}" && -d "${HERMES_HOME}/hermes-agent" ]] || fail malformed_wrapper_mutation; finish 'malformed path-containing wrapper is refused unchanged'

fixture; valid_layout; cat > "${root}/bin/curl" <<'EOF'
#!/bin/sh
while [ "$#" -gt 0 ]; do [ "$1" = --output ] && { shift; echo installer > "$1"; exit; }; shift; done
EOF
cat > "${root}/bin/python3" <<'EOF'
#!/bin/sh
kill -TERM "$PPID"
exit 143
EOF
chmod +x "${root}/bin/curl" "${root}/bin/python3"; interrupt_wrapper="$(cat "${HOME}/.local/bin/hermes")"; ! /bin/bash "${SCRIPT}" >/dev/null 2>&1 || fail interrupt_status; [[ -d "${HERMES_HOME}/hermes-agent" ]] || fail interrupt_checkout; [[ "$(cat "${HOME}/.local/bin/hermes")" == "${interrupt_wrapper}" ]] || fail interrupt_wrapper; [[ -z "$(find "${HERMES_HOME}" -maxdepth 1 -name '.install-hermes-backup.*' -print -quit)" ]] || fail interrupt_backup; finish 'TERM after backup restores checkout and wrappers'

echo "1..${tests}"
