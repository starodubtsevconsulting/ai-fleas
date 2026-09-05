#!/usr/bin/env bash
# This wrapper exists because `apt update` can fail if the system has a broken
# apt source configured (common after OS upgrades, e.g. a PPA that does not
# publish a Release file for the current Ubuntu codename).
#
# Behavior:
# - Runs `sudo apt update`.
# - If it fails with "does not have a Release file", it parses the failing repo
#   URL + suite from apt's error message and tries to locate the corresponding
#   entry under /etc/apt/sources.list(.d).
# - By default it prints the offending file(s) and exits non-zero so the user
#   can fix them manually.
# - If `CONFS_AUTO_DISABLE_BROKEN_APT_SOURCES=1` is set, it will rename the
#   offending file(s) to `*.disabled.<timestamp>` and retry `apt update`.
# - If run interactively (stdin is a TTY) and `CONFS_AUTO_DISABLE_BROKEN_APT_SOURCES`
#   is not set, it will prompt whether to disable the offending file(s) and retry.
#
# This script may modify system state only in auto-disable mode.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "scripts/apt-update.sh" "$root_dir"

AUTO_DISABLE_BROKEN_APT_SOURCES="${CONFS_AUTO_DISABLE_BROKEN_APT_SOURCES:-}"

run_update() {
  sudo apt update
}

find_offending_source_files() {
  local url="$1"
  local suite="$2"

  sudo grep -RIl --fixed-strings "$url" /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null | while IFS= read -r f; do
    if sudo grep -q --fixed-strings "$suite" "$f" 2>/dev/null; then
      echo "$f"
    fi
  done
}

disable_source_file() {
  local f="$1"
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  case "$f" in
    *.sources)
      sudo mv "$f" "${f%.sources}.disabled.${ts}.sources"
      ;;
    *.list)
      sudo mv "$f" "${f%.list}.disabled.${ts}.list"
      ;;
    *)
      sudo mv "$f" "${f}.disabled.${ts}"
      ;;
  esac
}

prompt_auto_disable() {
  local tty_in
  tty_in="/dev/tty"

  if [ -r "$tty_in" ]; then
    printf "Disable the offending apt source file(s) and retry? [Y/NO]: " >"$tty_in"
    read -r choice <"$tty_in"
  elif [ -t 0 ]; then
    printf "Disable the offending apt source file(s) and retry? [Y/NO]: " >&2
    read -r choice
  else
    return 1
  fi
  if [ "${choice^^}" = "Y" ]; then
    return 0
  fi
  return 1
}

attempt=1
while true; do
  tmp="$(mktemp)"
  if run_update 2>&1 | tee "$tmp"; then
    rm -f "$tmp"
    exit 0
  fi

  if ! grep -q "does not have a Release file" "$tmp"; then
    echo "apt update failed. Output saved in: $tmp" >&2
    exit 1
  fi

  line="$(grep -m1 "does not have a Release file" "$tmp" || true)"
  rm -f "$tmp"

  url="$(printf "%s" "$line" | sed -nE "s/.*'([^ ]+) ([^ ]+) Release'.*/\1/p")"
  suite="$(printf "%s" "$line" | sed -nE "s/.*'([^ ]+) ([^ ]+) Release'.*/\2/p")"

  if [ -z "$url" ] || [ -z "$suite" ]; then
    echo "apt update failed due to a repository without a Release file, but parsing failed." >&2
    echo "$line" >&2
    exit 1
  fi

  echo "Broken apt repository detected: $url ($suite)" >&2

  mapfile -t files < <(find_offending_source_files "$url" "$suite" | sort -u)
  if [ ${#files[@]} -eq 0 ]; then
    echo "Could not locate the apt source file that contains: $url ($suite)" >&2
    echo "Hint: grep -RIn --fixed-strings '$url' /etc/apt/sources.list /etc/apt/sources.list.d" >&2
    exit 1
  fi

  echo "Offending apt source files:" >&2
  for f in "${files[@]}"; do
    echo "- $f" >&2
  done

  if [ -z "$AUTO_DISABLE_BROKEN_APT_SOURCES" ]; then
    if prompt_auto_disable; then
      AUTO_DISABLE_BROKEN_APT_SOURCES=1
    else
      echo "To auto-disable them and retry, rerun with: CONFS_AUTO_DISABLE_BROKEN_APT_SOURCES=1" >&2
      exit 1
    fi
  fi

  for f in "${files[@]}"; do
    disable_source_file "$f"
  done

  attempt=$((attempt + 1))
  if [ $attempt -gt 3 ]; then
    echo "apt update still failing after disabling sources." >&2
    exit 1
  fi

done
