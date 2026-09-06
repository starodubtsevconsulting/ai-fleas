#!/usr/bin/env bash
set -euo pipefail
readonly HERMES_INSTALLER_URL='https://hermes-agent.nousresearch.com/install.sh'
readonly HERMES_COMMIT='fcbd1076a93841fa88855acce810e342a5b78101'
readonly HERMES_VERSION='Hermes Agent v0.20.5 (2026.8.19)'
readonly HERMES_ROOT="${HERMES_HOME:-${HOME}/.hermes}"
readonly HERMES_CHECKOUT="${HERMES_ROOT}/hermes-agent"
readonly COMMAND_ROOT="${HOME}/.local/bin"
readonly COMMAND_NAMES=(hermes hermes-agent hermes-acp)
readonly LOCK_DIR="${HERMES_ROOT}/.install-hermes.lock"
readonly WATCHDOG_SECONDS="${HERMES_INSTALL_TIMEOUT_SECONDS:-1800}"
dry_run=false
case "${1:-}" in '') ;; --dry-run) dry_run=true ;; -h|--help) echo 'Usage: install-hermes.sh [--dry-run]'; exit 0 ;; *) exit 2 ;; esac
if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then echo 'Hermes developer bootstrap supports macOS Apple Silicon (Darwin arm64) only.' >&2; exit 2; fi

installer=''; work_dir=''; backup_root=''; backup_pending=false
OWNED_PIDS=(''); OWNED_COUNT=0
cleanup() { trap - EXIT INT TERM; if ${backup_pending}; then restore_backup || true; fi; [[ -z "${installer}" ]] || rm -f -- "${installer}"; [[ -z "${work_dir}" ]] || rm -rf -- "${work_dir}"; if [[ -d "${LOCK_DIR}" && -f "${LOCK_DIR}/pid" && "$(cat "${LOCK_DIR}/pid" 2>/dev/null)" == "$$" ]]; then rm -rf -- "${LOCK_DIR}"; fi; }
trap cleanup EXIT INT TERM
acquire_lock() { mkdir -p "${HERMES_ROOT}"; if mkdir "${LOCK_DIR}" 2>/dev/null; then printf '%s\n' "$$" > "${LOCK_DIR}/pid"; return; fi; [[ -f "${LOCK_DIR}/pid" ]] || { echo 'Hermes install lock exists without owner metadata.' >&2; exit 1; }; lock_pid="$(cat "${LOCK_DIR}/pid")"; if [[ "${lock_pid}" =~ ^[0-9]+$ ]] && kill -0 "${lock_pid}" 2>/dev/null; then echo "Another Hermes install is active (PID ${lock_pid})." >&2; exit 1; fi; rm -rf -- "${LOCK_DIR}"; mkdir "${LOCK_DIR}" || exit 1; printf '%s\n' "$$" > "${LOCK_DIR}/pid"; }
acquire_lock
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/install-hermes-work.XXXXXX")"
discover_owned_processes() { OWNED_PIDS=(''); OWNED_COUNT=0; ps -axo pid=,ppid=,comm=,command= > "${work_dir}/ps"; while read -r pid ppid executable command; do [[ "${pid}" != "$$" && "${pid}" != "${PPID}" ]] || continue; process_cwd=''; if command -v lsof >/dev/null 2>&1; then process_cwd="$(lsof -a -p "${pid}" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | sed -n '1p')"; fi; case "${executable}:${process_cwd}" in "${HERMES_CHECKOUT}"/*:*|"${installer}":*|*:"${HERMES_CHECKOUT}"|*:"${HERMES_CHECKOUT}"/*) OWNED_PIDS[OWNED_COUNT]="${pid}"; OWNED_COUNT=$((OWNED_COUNT + 1)) ;; esac; done < "${work_dir}/ps"; changed=true; while ${changed}; do changed=false; while read -r pid ppid executable command; do [[ " ${OWNED_PIDS[*]} " != *" ${pid} "* ]] || continue; if [[ " ${OWNED_PIDS[*]} " == *" ${ppid} "* ]]; then OWNED_PIDS[OWNED_COUNT]="${pid}"; OWNED_COUNT=$((OWNED_COUNT + 1)); changed=true; fi; done < "${work_dir}/ps"; done; }
pid_is_running() { state="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ')"; [[ -n "${state}" && "${state}" != Z* ]]; }
stop_owned_processes() { discover_owned_processes; for ((index=OWNED_COUNT-1; index>=0; index--)); do kill -TERM "${OWNED_PIDS[index]}" 2>/dev/null || true; done; for _ in 1 2 3 4 5; do survivors=(''); survivor_count=0; for ((index=0; index<OWNED_COUNT; index++)); do pid="${OWNED_PIDS[index]}"; if pid_is_running "${pid}"; then survivors[survivor_count]="${pid}"; survivor_count=$((survivor_count + 1)); fi; done; ((survivor_count == 0)) && return 0; sleep 1; done; for ((index=survivor_count-1; index>=0; index--)); do kill -KILL "${survivors[index]}" 2>/dev/null || true; done; for ((index=0; index<survivor_count; index++)); do pid="${survivors[index]}"; pid_is_running "${pid}" && { echo "Owned Hermes process ${pid} did not exit." >&2; exit 1; }; done; return 0; }

require_owned_checkout() {
  local resolved_root resolved_checkout
  mkdir -p "${HERMES_ROOT}"
  resolved_root="$(cd "${HERMES_ROOT}" && pwd -P)"
  [[ "$(dirname "${HERMES_CHECKOUT}")" == "${HERMES_ROOT}" ]] || return 1
  if [[ -e "${HERMES_CHECKOUT}" || -L "${HERMES_CHECKOUT}" ]]; then
    [[ -d "${HERMES_CHECKOUT}" && ! -L "${HERMES_CHECKOUT}" ]] || return 1
    resolved_checkout="$(cd "${HERMES_CHECKOUT}" && pwd -P)"
    [[ "${resolved_checkout}" == "${resolved_root}/hermes-agent" ]] || return 1
    checkout_status="$(git -C "${HERMES_CHECKOUT}" status --porcelain --untracked-files=all 2>/dev/null)" || return 1
    while IFS= read -r status_entry; do
      [[ -z "${status_entry}" ]] && continue
      status_path="${status_entry:3}"
      case "${status_path}" in
        .hermes-bootstrap-complete|.install_method) ;;
        *) echo "Refusing clean reinstall: unclassified checkout data must be preserved: ${status_path}." >&2; return 1 ;;
      esac
    done <<< "${checkout_status}"
  fi
}
validate_command() {
  local command_path="$1" expected_name="$2"
  [[ ! -e "${command_path}" && ! -L "${command_path}" ]] && return 0
  [[ -f "${command_path}" && ! -L "${command_path}" ]] || return 1
 case "${expected_name}" in hermes) expected_entry='hermes' ;; hermes-agent) expected_entry='run_agent.py' ;; hermes-acp) expected_entry='hermes' ;; *) return 1 ;; esac
 if [[ "${expected_name}" == hermes-acp ]]; then
   expected_content="$(printf '#!/usr/bin/env bash\nunset PYTHONPATH\nunset PYTHONHOME\nexec "%s/venv/bin/python" "%s/%s" acp "$@"' "${HERMES_CHECKOUT}" "${HERMES_CHECKOUT}" "${expected_entry}")"
 else
   expected_content="$(printf '#!/usr/bin/env bash\nunset PYTHONPATH\nunset PYTHONHOME\nexec "%s/venv/bin/python" "%s/%s" "$@"' "${HERMES_CHECKOUT}" "${HERMES_CHECKOUT}" "${expected_entry}")"
 fi
 actual_content="$(cat "${command_path}")"
 [[ "${actual_content}" == "${expected_content}" ]]
}
require_owned_checkout || { echo 'Refusing clean reinstall: unexpected Hermes checkout layout.' >&2; exit 1; }
for command_name in "${COMMAND_NAMES[@]}"; do command_path="${COMMAND_ROOT}/${command_name}"; validate_command "${command_path}" "${command_name}" || { echo "Refusing clean reinstall: unexpected command entry ${command_path}." >&2; exit 1; }; done
restore_backup() {
  local restore_failed=false command_name command_path
  ${backup_pending} || return 0
  [[ ! -e "${HERMES_CHECKOUT}" && ! -L "${HERMES_CHECKOUT}" ]] || rm -rf -- "${HERMES_CHECKOUT}" || restore_failed=true
  for command_name in "${COMMAND_NAMES[@]}"; do
    command_path="${COMMAND_ROOT}/${command_name}"
    [[ ! -e "${command_path}" && ! -L "${command_path}" ]] || rm -f -- "${command_path}" || restore_failed=true
  done
  if [[ -d "${backup_root}/checkout" ]]; then mv -- "${backup_root}/checkout" "${HERMES_CHECKOUT}" || restore_failed=true; fi
  for command_name in "${COMMAND_NAMES[@]}"; do
    if [[ -e "${backup_root}/${command_name}" || -L "${backup_root}/${command_name}" ]]; then
      mv -- "${backup_root}/${command_name}" "${COMMAND_ROOT}/${command_name}" || restore_failed=true
    fi
  done
  if ${restore_failed}; then
    echo "Hermes rollback failed; recoverable backup retained at ${backup_root}." >&2
    return 1
  fi
  backup_pending=false
  rm -rf -- "${backup_root}"
}
fail_and_restore() {
  local message="$1"
  echo "${message}" >&2
  restore_backup || true
  exit 1
}
if ${dry_run}; then
  discover_owned_processes
  for ((index=0; index<OWNED_COUNT; index++)); do echo "Would stop installer-owned process: ${OWNED_PIDS[index]}"; done
  [[ ! -d "${HERMES_CHECKOUT}" ]] || echo "Would remove installer-owned checkout: ${HERMES_CHECKOUT}"
  for command_name in "${COMMAND_NAMES[@]}"; do [[ ! -e "${COMMAND_ROOT}/${command_name}" ]] || echo "Would remove installer-owned command: ${COMMAND_ROOT}/${command_name}"; done
  echo "Would download ${HERMES_INSTALLER_URL} and install commit ${HERMES_COMMIT} with --skip-setup."
  exit 0
fi
installer="$(mktemp "${TMPDIR:-/tmp}/install-hermes.XXXXXX")"
curl --fail --silent --show-error --location "${HERMES_INSTALLER_URL}" --output "${installer}"
chmod 0700 "${installer}"
stop_owned_processes
backup_root="${HERMES_ROOT}/.install-hermes-backup.$$"
mkdir "${backup_root}"
backup_pending=true
if [[ -d "${HERMES_CHECKOUT}" ]]; then mv -- "${HERMES_CHECKOUT}" "${backup_root}/checkout"; fi
for command_name in "${COMMAND_NAMES[@]}"; do
  command_path="${COMMAND_ROOT}/${command_name}"
  if [[ -e "${command_path}" || -L "${command_path}" ]]; then mv -- "${command_path}" "${backup_root}/${command_name}"; fi
done
if ! python3 "$(cd "$(dirname "$0")" && pwd)/run-hermes-installer.py" "${WATCHDOG_SECONDS}" bash "${installer}" --commit "${HERMES_COMMIT}" --skip-setup --skip-browser; then
  fail_and_restore 'Hermes installer failed; restored the prior installation.'
fi
hermes_executable="${COMMAND_ROOT}/hermes"
[[ -x "${hermes_executable}" ]] || fail_and_restore 'Hermes installer did not create the expected command; restored the prior installation.'
actual_version="$(${hermes_executable} --version 2>/dev/null | sed -n '1p')"
[[ "${actual_version}" == "${HERMES_VERSION}" ]] || fail_and_restore "Hermes version verification failed: ${actual_version}; restored the prior installation."
actual_commit="$(git -C "${HERMES_CHECKOUT}" rev-parse HEAD 2>/dev/null)"
[[ "${actual_commit}" == "${HERMES_COMMIT}" ]] || fail_and_restore "Hermes commit verification failed: ${actual_commit}; restored the prior installation."
discover_owned_processes
((OWNED_COUNT == 0)) || fail_and_restore 'Hermes installer left owned processes running; restored the prior installation.'
backup_pending=false
rm -rf -- "${backup_root}"
echo "Verified clean reinstall of ${HERMES_VERSION} at ${hermes_executable}."
echo 'Browser tooling: skipped by official --skip-browser (not required for Stage 2).'
case ":${PATH}:" in *":${COMMAND_ROOT}:"*) ;; *) echo "Add ${COMMAND_ROOT} to PATH to invoke hermes directly." ;; esac
