#!/bin/bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "push" || exit $?

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMMANDS_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
WORKSPACE_ROOT=$(cd "$COMMANDS_ROOT/.." && pwd)
CONFIG_ROOT=${AI_PROFILE_ROOT:-${AI_CONFIG_ROOT:-"$WORKSPACE_ROOT/ai-profile"}}

CONFIG_READER="$COMMANDS_ROOT/read-config.sh"
if [ -f "$CONFIG_READER" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_READER" git
fi

PUSH_PROFILE_CONFIRM=${PUSH_PROFILE_CONFIRM:-on}

CHECK_ONLY=0
BOUND_PROFILE_ID=${AI_WORK_PROFILE_ID:-}
BOUND_WORKFLOW_ID=${AI_WORKFLOW_ID:-}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1; shift ;;
    --profile) BOUND_PROFILE_ID=${2:-}; shift 2 ;;
    --workflow) BOUND_WORKFLOW_ID=${2:-}; shift 2 ;;
    *) echo "Usage: $0 [--check] --profile ID --workflow ID" >&2; exit 2 ;;
  esac
done
if [ -z "$BOUND_PROFILE_ID" ] || [ -z "$BOUND_WORKFLOW_ID" ]; then
  echo "Git execution requires explicit profile and workflow coordinates." >&2
  exit 2
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$repo_root" ]; then
  echo "Not inside a git repository."
  exit 1
fi

current_email=$(git config user.email 2>/dev/null || true)
current_domain="${current_email##*@}"

trim() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

unquote() {
  local value
  value=$(trim "$1")
  value=$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  printf '%s\n' "$value"
}

resolve_profile_path() {
  local profile_file raw_path base_dir
  profile_file="$1"
  raw_path=$(unquote "$2")
  if [ -z "$raw_path" ]; then
    return 1
  fi
  if [[ "$raw_path" = /* ]]; then
    printf '%s\n' "$raw_path"
    return 0
  fi
  base_dir=$(cd "$(dirname "$profile_file")" && pwd)
  (cd "$base_dir" 2>/dev/null && cd "$raw_path" 2>/dev/null && pwd) || return 1
}

resolve_profile_file() {
  local profile_file raw_path base_dir target_dir file_name
  profile_file="$1"
  raw_path=$(unquote "$2")
  if [ -z "$raw_path" ] || [[ "$raw_path" = /* ]] || [[ "/$raw_path/" = *"/../"* ]]; then
    return 1
  fi
  base_dir=$(cd "$(dirname "$profile_file")" && pwd -P)
  target_dir=$(cd "$base_dir/$(dirname "$raw_path")" 2>/dev/null && pwd -P) || return 1
  case "$target_dir/" in
    "$base_dir/"*) ;;
    *) return 1 ;;
  esac
  file_name=$(basename "$raw_path")
  [ -n "$file_name" ] && [ "$file_name" != "." ] && [ "$file_name" != ".." ] || return 1
  [ ! -L "$target_dir/$file_name" ] || return 1
  printf '%s\n' "$target_dir/$file_name"
}

resolve_registry_ref() {
  local profile_file raw_ref base_dir
  profile_file="$1"
  raw_ref=$(unquote "$2")
  if [ -z "$raw_ref" ]; then
    return 1
  fi
  if [[ "$raw_ref" = /* ]]; then
    printf '%s\n' "$raw_ref"
  else
    base_dir=$(cd "$(dirname "$profile_file")" && pwd)
    printf '%s\n' "$base_dir/$raw_ref"
  fi
}

resolve_project_path_from_registry() {
  local project_file raw_path base_dir
  project_file="$1"
  raw_path=$(awk '/^path:[[:space:]]*/ { sub(/^path:[[:space:]]*/, "", $0); print; exit } /^repo_path:[[:space:]]*/ { sub(/^repo_path:[[:space:]]*/, "", $0); print; exit }' "$project_file")
  raw_path=$(unquote "$raw_path")
  if [ -z "$raw_path" ]; then
    return 1
  fi
  if [[ "$raw_path" = /* ]]; then
    printf '%s\n' "$raw_path"
    return 0
  fi
  base_dir=$(cd "$(dirname "$project_file")" && pwd)
  (cd "$base_dir" 2>/dev/null && cd "$raw_path" 2>/dev/null && pwd) || return 1
}

profile_supports_repo() {
  local profile_file repo_root root_path_raw root_path candidate_path registry_ref project_file
  profile_file="$1"
  repo_root="$2"

  root_path_raw=$(grep -E '^projects_root_path:' "$profile_file" | head -n1 | sed 's/^projects_root_path:[[:space:]]*//')
  if [ -n "$root_path_raw" ]; then
    root_path=""
    if [[ "$root_path_raw" = /* ]]; then
      root_path="$root_path_raw"
    else
      root_path="$(resolve_profile_path "$profile_file" "$root_path_raw" || true)"
    fi
    if [ -n "$root_path" ]; then
      case "$repo_root/" in
        "${root_path%/}/"*)
          return 0
          ;;
      esac
    fi
  fi

  while IFS= read -r candidate_path; do
    [ -n "$candidate_path" ] || continue
    case "$repo_root/" in
      "${candidate_path%/}/"*)
        return 0
        ;;
    esac
  done < <(
    awk '
      /^projects:[[:space:]]*$/ { in_projects=1; next }
      in_projects && /^[^[:space:]]/ { exit }
      in_projects && /^[[:space:]]+path:[[:space:]]*/ {
        sub(/^[[:space:]]+path:[[:space:]]*/, "", $0)
        print "PATH:" $0
      }
      in_projects && /^[[:space:]]+ref:[[:space:]]*/ {
        sub(/^[[:space:]]+ref:[[:space:]]*/, "", $0)
        print "REF:" $0
      }
      /^[[:space:]]+-[[:space:]]+ref:[[:space:]]*/ {
        sub(/^[[:space:]]+-[[:space:]]+ref:[[:space:]]*/, "", $0)
        print "REF:" $0
      }
    ' "$profile_file" | while IFS= read -r project_spec; do
      # macOS Bash 3.2 misparses a case statement in this nested
      # process-substitution pipeline. Prefix checks are equivalent and portable.
      if [[ "$project_spec" == PATH:* ]]; then
        resolve_profile_path "$profile_file" "${project_spec#PATH:}" || true
      elif [[ "$project_spec" == REF:* ]]; then
        registry_ref=$(resolve_registry_ref "$profile_file" "${project_spec#REF:}" || true)
        if [ -n "$registry_ref" ] && [ -f "$registry_ref" ]; then
          resolve_project_path_from_registry "$registry_ref" || true
        fi
      fi
    done
  )

  return 1
}

expected_profile=""
expected_domain=""
expected_profile_file=""

while IFS= read -r profile_file; do
  profile_name=$(grep -E '^name:' "$profile_file" | head -n1 | sed 's/^name:[[:space:]]*//')
  org_domain=$(grep -E '^org_domain:' "$profile_file" | head -n1 | sed 's/^org_domain:[[:space:]]*//')

  if [ "$profile_name" = "$BOUND_PROFILE_ID" ] && [ -n "$org_domain" ] && profile_supports_repo "$profile_file" "$repo_root"; then
    expected_profile="$profile_name"
    expected_domain="$org_domain"
    expected_profile_file="$profile_file"
    break
  fi
done < <(find "$CONFIG_ROOT" -mindepth 2 -maxdepth 2 -type f -name '*-work-profile.yml' -print 2>/dev/null | sort)

if [ -z "$expected_domain" ]; then
  echo "Bound profile '$BOUND_PROFILE_ID' does not own repository $repo_root."
  exit 1
fi

if ! grep -Eq "^[[:space:]]*- path:[[:space:]]*${BOUND_WORKFLOW_ID}(\.workflow\.md)?[[:space:]]*$" "$expected_profile_file"; then
  echo "Workflow '$BOUND_WORKFLOW_ID' is not declared by profile '$BOUND_PROFILE_ID'." >&2
  exit 1
fi

profile_command_config_ref() {
  local command_id="$1"
  awk -v command_id="$command_id" '
    /^commands:[[:space:]]*$/ { in_commands=1; next }
    in_commands && /^[^[:space:]]/ { exit }
    in_commands && /^[[:space:]]+-[[:space:]]+id:[[:space:]]*/ {
      value=$0; sub(/^[[:space:]]+-[[:space:]]+id:[[:space:]]*/, "", value)
      gsub(/^["'\'']|["'\'']$/, "", value); selected=(value == command_id); next
    }
    in_commands && selected && /^[[:space:]]+config:[[:space:]]*/ {
      sub(/^[[:space:]]+config:[[:space:]]*/, "", $0); gsub(/^["'\'']|["'\'']$/, "", $0); print; exit
    }
  ' "$expected_profile_file"
}

command_config_scalar() {
  local config_file="$1" key="$2"
  awk -v key="$key" '$0 ~ "^" key ":[[:space:]]*" {
    sub("^" key ":[[:space:]]*", "", $0); gsub(/^["'\'']|["'\'']$/, "", $0); print; exit
  }' "$config_file"
}

command_remote_patterns() {
  local config_file="$1"
  awk '
    /^allowed_remote_url_patterns:[[:space:]]*$/ { in_patterns=1; next }
    in_patterns && /^[[:space:]]+-[[:space:]]*/ {
      sub(/^[[:space:]]+-[[:space:]]*/, "", $0); gsub(/^["'\'']|["'\'']$/, "", $0); print; next
    }
    in_patterns && !/^[[:space:]]*$/ { exit }
  ' "$config_file"
}

source_control_ref=$(profile_command_config_ref source-control)
if [ -z "$source_control_ref" ]; then
  echo "Profile '${expected_profile}' must bind the source-control command to a config file." >&2
  exit 1
fi
source_control_config=$(resolve_profile_file "$expected_profile_file" "$source_control_ref" || true)
if [ -z "$source_control_config" ] || [ ! -f "$source_control_config" ]; then
  echo "Profile '${expected_profile}' source-control config is missing or unsafe: $source_control_ref" >&2
  exit 1
fi

bound_command=$(command_config_scalar "$source_control_config" command)
scm_provider=$(command_config_scalar "$source_control_config" capability)
registered_command=$(command_config_scalar "$source_control_config" registered_command)
command_path=$(command_config_scalar "$source_control_config" command_path)
expected_name=$(command_config_scalar "$source_control_config" identity_name)
expected_email=$(command_config_scalar "$source_control_config" identity_email)
if [ "$bound_command" != "source-control" ]; then
  echo "Profile '${expected_profile}' config does not belong to source-control." >&2
  exit 1
fi
if [ "$scm_provider" != "git" ]; then
  echo "Profile '${expected_profile}' uses source-control provider '$scm_provider', not Git." >&2
  exit 1
fi
if [ "$registered_command" != "git" ] || [ "$command_path" != "git/git.command.sh" ]; then
  echo "Profile '${expected_profile}' has an invalid Git provider command binding." >&2
  exit 1
fi

current_name=$(git config user.name 2>/dev/null || true)
if [ -z "$expected_name" ] || [ -z "$expected_email" ]; then
  echo "Profile '${expected_profile}' source-control config must declare identity_name and identity_email." >&2
  exit 1
fi
if [ "$current_name" != "$expected_name" ] || [ "$current_email" != "$expected_email" ]; then
  echo "Git identity mismatch for profile '${expected_profile}'." >&2
  echo "Expected repository identity: $expected_name <$expected_email>" >&2
  echo "Effective repository identity: ${current_name:-<unset>} <${current_email:-unset}>" >&2
  echo "Configure user.name and user.email locally in this repository; global switching is forbidden." >&2
  exit 1
fi

origin_url=$(git remote get-url origin 2>/dev/null || true)
patterns=$(command_remote_patterns "$source_control_config")
if [ -n "$patterns" ]; then
  [ -n "$origin_url" ] || { echo "Profile '${expected_profile}' requires an origin remote." >&2; exit 1; }
  remote_allowed=0
  while IFS= read -r pattern; do
    [ -n "$pattern" ] || continue
    if [[ "$origin_url" == $pattern ]]; then remote_allowed=1; break; fi
  done <<< "$patterns"
  if [ "$remote_allowed" -ne 1 ]; then
    echo "Origin remote is not allowed for profile '${expected_profile}': $origin_url" >&2
    exit 1
  fi
fi

if [ -n "$current_domain" ] && [ "$current_domain" = "$expected_domain" ]; then
  echo "Git user.email domain matches expected profile '${expected_profile}' ($expected_domain)."
else
  echo "Git email domain mismatch for profile '${expected_profile}': expected '$expected_domain', got '${current_domain:-unset}'." >&2
  exit 1
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "Push preflight passed for $repo_root."
  exit 0
fi

SDD_GUARD_SH="$COMMANDS_ROOT/sdd/sdd.command-guard.sh"
if [ -x "$SDD_GUARD_SH" ]; then
  "$SDD_GUARD_SH" --staged-only
fi

current_branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
if [ -z "$current_branch" ] || ! git check-ref-format --branch "$current_branch" >/dev/null 2>&1; then
  echo "Cannot push from detached HEAD or an unsafe branch name." >&2
  exit 1
fi

if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
  git push
  exit $?
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Cannot establish upstream: remote 'origin' is required." >&2
  exit 1
fi

git push --set-upstream origin "$current_branch"
