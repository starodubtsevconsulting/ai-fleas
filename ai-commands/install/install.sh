#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "install.sh" "$root_dir"

include_installed="${CONFS_SETUP_INCLUDE_INSTALLED:-}"

normalize_name() {
  printf "%s" "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+//g'
}

is_module_installed() {
  local module_dir="$1"
  local check_script="$module_dir/is-installed.step.sh"
  local fallback_check_script

  fallback_check_script="$root_dir/scripts/is-installed.common.step.sh"

  if [ -f "$check_script" ]; then
    bash "$check_script"
    return $?
  fi

  if [ -f "$fallback_check_script" ]; then
    bash "$fallback_check_script" "$module_dir"
    return $?
  fi

  return 1
}

# Find all install.sh scripts under subdirectories (exclude root)
mapfile -t scripts < <(find "$root_dir" -mindepth 2 -type f -name "install.sh" | sort)

if [ ${#scripts[@]} -eq 0 ]; then
  echo "No install.sh scripts found under $root_dir"
  exit 0
fi

run_all=false
any_ran=false

missing_scripts=()
module_names=()
module_scripts=()

for script in "${scripts[@]}"; do
  rel="${script#$root_dir/}"
  module="${rel%%/*}"
  module_names+=("$module")
  module_scripts+=("$script")
done

for script in "${scripts[@]}"; do
  rel="${script#$root_dir/}"

  module_dir="$root_dir/${rel%%/*}"
  if [ -z "$include_installed" ] && is_module_installed "$module_dir"; then
    continue
  fi

  missing_scripts+=("$script")

done

# Show current status before any installs
if [ -x "$root_dir/check.sh" ]; then
  "$root_dir/check.sh"
fi

run_scripts=("${scripts[@]}")

if [ -z "$include_installed" ] && [ ${#missing_scripts[@]} -eq 0 ]; then
  echo
  echo "Nothing to install."
  echo "1) Reinstall particular item(s)"
  echo "2) Reinstall all"
  printf "Choose [1/2] or press Enter to exit: "
  read -r choice
  case "$choice" in
    1)
      printf "Enter names (comma-separated, e.g. Node.js, VS Code): "
      read -r selection
      if [ -z "${selection// }" ]; then
        exit 0
      fi

      IFS=',' read -r -a requested <<< "$selection"
      selected_scripts=()
      unknown=()

      for raw in "${requested[@]}"; do
        name="$(echo "$raw" | xargs)"
        [ -z "$name" ] && continue
        req_norm="$(normalize_name "$name")"
        case "$req_norm" in
          visualstudiocode|vscode|code)
            req_norm="vscode"
            ;;
        esac

        match=""
        for i in "${!module_names[@]}"; do
          mod_norm="$(normalize_name "${module_names[$i]}")"
          if [ "$req_norm" = "$mod_norm" ]; then
            match="${module_scripts[$i]}"
            break
          fi
        done

        if [ -n "$match" ]; then
          selected_scripts+=("$match")
        else
          unknown+=("$name")
        fi
      done

      if [ ${#unknown[@]} -gt 0 ]; then
        printf "Unknown module(s): %s\n" "$(IFS=", "; echo "${unknown[*]}")"
        exit 1
      fi
      if [ ${#selected_scripts[@]} -eq 0 ]; then
        echo "No valid modules selected."
        exit 1
      fi

      include_installed=1
      run_scripts=("${selected_scripts[@]}")
      ;;
    2)
      include_installed=1
      run_scripts=("${scripts[@]}")
      ;;
    "")
      exit 0
      ;;
    *)
      echo "Invalid choice."
      exit 1
      ;;
  esac
fi

if [ -z "$include_installed" ] && [ ${#missing_scripts[@]} -gt 0 ]; then
  run_scripts=("${missing_scripts[@]}")
fi

if [ -x "$root_dir/check.sh" ]; then
  echo
  if [ ${#run_scripts[@]} -gt 0 ]; then
    names=()
    for script in "${run_scripts[@]}"; do
      rel="${script#$root_dir/}"
      names+=("${rel%%/*}")
    done
    printf "Continue with install for: %s? [Y/NO]: " "$(IFS=", "; echo "${names[*]}")"
  else
    printf "Continue with install? [Y/NO]: "
  fi
  read -r proceed
  if [ "${proceed^^}" != "Y" ]; then
    if [ -n "$proceed" ]; then
      req_norm="$(normalize_name "$proceed")"
      case "$req_norm" in
        visualstudiocode|vscode|code)
          req_norm="vscode"
          ;;
      esac
      picked=""
      for script in "${run_scripts[@]}"; do
        rel="${script#$root_dir/}"
        mod="${rel%%/*}"
        if [ "$req_norm" = "$(normalize_name "$mod")" ]; then
          picked="$script"
          break
        fi
      done
      if [ -n "$picked" ]; then
        run_scripts=("$picked")
      else
        echo "Aborting."
        exit 0
      fi
    else
      echo "Aborting."
      exit 0
    fi
  fi
fi

for script in "${run_scripts[@]}"; do
  rel="${script#$root_dir/}"

  module_dir="$root_dir/${rel%%/*}"
  if [ -z "$include_installed" ] && is_module_installed "$module_dir"; then
    echo "Skipping $rel (already installed)"
    continue
  fi

  if [ "$run_all" = false ]; then
    while true; do
      printf "Run %s? [Y/NO/DONOTASK]: " "$rel"
      read -r choice
      case "${choice^^}" in
        Y)
          break
          ;;
        NO)
          echo "Skipping $rel"
          script=""
          break
          ;;
        DONOTASK)
          run_all=true
          break
          ;;
        *)
          echo "Please enter Y, NO, or DONOTASK."
          ;;
      esac
    done
  fi

  if [ -n "$script" ]; then
    echo "Running $rel"
    bash "$script"
    any_ran=true
  fi

done

echo
echo "=== README ==="
cat "$root_dir/README.md"
