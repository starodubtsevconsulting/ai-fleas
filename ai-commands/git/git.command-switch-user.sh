#!/bin/bash

# setup-git.sh
# One-time setup script to configure Git credential storage
# This allows automated git push without exposing credentials

set -e

usage() {
  cat <<'USAGE'
Usage:
  switch-user.sh                 # interactive mode
  switch-user.sh --list          # list profiles (non-interactive)
  switch-user.sh --show-current  # print current credential.username
  switch-user.sh --switch <user> # switch to existing profile (non-interactive)
USAGE
}

ACTION=""
TARGET_USER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --list)
      ACTION="list"
      ;;
    --show-current)
      ACTION="show-current"
      ;;
    --switch)
      ACTION="switch"
      TARGET_USER="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

ensure_credential_store_helper() {
  CURRENT_HELPER=$(git config --global credential.helper 2>/dev/null || echo "")
  if [ "$CURRENT_HELPER" != "store" ]; then
    git config --global credential.helper store
  fi
}

ensure_credential_store_helper

remove_host_specific_helper_override() {
  local github_host="$1"
  if [ -z "$github_host" ]; then
    return 0
  fi

  git config --global --unset-all "credential.https://${github_host}.helper" 2>/dev/null || true
}

store_pat_for_user_and_host() {
  local cred_user="$1"
  local github_host="$2"
  local token="$3"

  if [ -z "$cred_user" ] || [ -z "$github_host" ] || [ -z "$token" ]; then
    return 1
  fi

  touch ~/.git-credentials
  chmod 600 ~/.git-credentials 2>/dev/null || true

  local tmp_file
  tmp_file=$(mktemp)

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^https://${cred_user}:[^@]*@${github_host}(/.*)?$ ]]; then
      local suffix="${line#*@${github_host}}"
      printf '%s\n' "https://${cred_user}:${token}@${github_host}${suffix}" >>"$tmp_file"
    elif [ -n "$line" ]; then
      printf '%s\n' "$line" >>"$tmp_file"
    fi
  done < ~/.git-credentials

  if ! grep -q "^https://${cred_user}:.*@${github_host}$" "$tmp_file" 2>/dev/null; then
    printf '%s\n' "https://${cred_user}:${token}@${github_host}" >>"$tmp_file"
  fi

  mv "$tmp_file" ~/.git-credentials
}

set_git_user_config() {
  local new_name="${1:-}"
  local new_email="${2:-}"
  local new_cred_user="${3:-}"

  if [ -n "$new_name" ]; then
    git config --global user.name "$new_name"
    echo "✓ Set user.name to: $new_name"
  fi

  if [ -n "$new_email" ]; then
    git config --global user.email "$new_email"
    echo "✓ Set user.email to: $new_email"
  fi

  if [ -n "$new_cred_user" ]; then
    git config --global credential.username "$new_cred_user"
    echo "✓ Set credential.username to: $new_cred_user"
  fi
}

profile_key_name() {
  local cred_user="$1"
  printf '%s' "switch-user.profile.${cred_user}.name"
}

profile_key_email() {
  local cred_user="$1"
  printf '%s' "switch-user.profile.${cred_user}.email"
}

get_profile_users() {
  local keys
  keys=$(git config --global --name-only --get-regexp '^switch-user\.profile\..*\.(name|email)$' 2>/dev/null || true)
  if [ -z "$keys" ]; then
    return 0
  fi

  echo "$keys" | sed -n 's/^switch-user\.profile\.\([^\.]*\)\..*$/\1/p' | sort -u
}

has_profile_for_user() {
  local cred_user="$1"
  if [ -z "$cred_user" ]; then
    return 1
  fi
  git config --global --get "$(profile_key_name "$cred_user")" >/dev/null 2>&1 || return 1
  git config --global --get "$(profile_key_email "$cred_user")" >/dev/null 2>&1 || return 1
  return 0
}

apply_profile_strict() {
  local cred_user="$1"
  if [ -z "$cred_user" ]; then
    return 1
  fi

  if ! has_profile_for_user "$cred_user"; then
    return 1
  fi

  local prof_name prof_email
  prof_name=$(git config --global --get "$(profile_key_name "$cred_user")" 2>/dev/null || echo "")
  prof_email=$(git config --global --get "$(profile_key_email "$cred_user")" 2>/dev/null || echo "")

  git config --global user.name "$prof_name"
  git config --global user.email "$prof_email"
  return 0
}

apply_or_configure_profile_for_user() {
  local cred_user="$1"
  if [ -z "$cred_user" ]; then
    return 0
  fi

  local prof_name_key prof_email_key
  prof_name_key=$(profile_key_name "$cred_user")
  prof_email_key=$(profile_key_email "$cred_user")

  local prof_name prof_email
  prof_name=$(git config --global --get "$prof_name_key" 2>/dev/null || echo "")
  prof_email=$(git config --global --get "$prof_email_key" 2>/dev/null || echo "")

  if [ -n "$prof_name" ] || [ -n "$prof_email" ]; then
    if [ -n "$prof_name" ]; then
      git config --global user.name "$prof_name"
    fi
    if [ -n "$prof_email" ]; then
      git config --global user.email "$prof_email"
    fi
    echo "✓ Applied global profile for '$cred_user'"
    return 0
  fi

  echo "(no saved global profile for '$cred_user'; leaving global user.name/user.email unchanged)"
}

configure_profile_for_user() {
  local cred_user="$1"
  if [ -z "$cred_user" ]; then
    return 0
  fi

  local prof_name_key prof_email_key
  prof_name_key=$(profile_key_name "$cred_user")
  prof_email_key=$(profile_key_email "$cred_user")

  local prof_name prof_email
  read -p "Name: " prof_name
  read -p "Email: " prof_email

  if [ -z "$prof_name" ] || [ -z "$prof_email" ]; then
    echo "Name and email are required to save a profile."
    return 1
  fi

  if [ -n "$prof_name" ]; then
    git config --global user.name "$prof_name"
    git config --global "$prof_name_key" "$prof_name"
  fi
  if [ -n "$prof_email" ]; then
    git config --global user.email "$prof_email"
    git config --global "$prof_email_key" "$prof_email"
  fi
}



CURRENT_CREDENTIAL_USER=$(git config --global credential.username 2>/dev/null || echo "")

refresh_current_credential_user() {
  CURRENT_CREDENTIAL_USER=$(git config --global credential.username 2>/dev/null || echo "")
}

# Auto-migrate all stored credential users to profiles if no profiles exist
migrate_existing_user() {
  local migrated_flag
  migrated_flag=$(git config --global switch-user.migrated 2>/dev/null || echo "")
  if [ "$PROFILE_COUNT" -eq 0 ] && [ -f ~/.git-credentials ] && [ "$migrated_flag" != "true" ]; then
    local stored_users
    stored_users=$(sed -n 's#^https://\([^:]*\):.*#\1#p' ~/.git-credentials 2>/dev/null | sort -u)

    if [ -n "$stored_users" ]; then
      local current_name current_email
      current_name=$(git config --global user.name 2>/dev/null || echo "")
      current_email=$(git config --global user.email 2>/dev/null || echo "")

      # Create profile for current user if we have name/email
      if [ -n "$CURRENT_CREDENTIAL_USER" ] && [ -n "$current_name" ] && [ -n "$current_email" ]; then
        git config --global "switch-user.profile.${CURRENT_CREDENTIAL_USER}.name" "$current_name"
        git config --global "switch-user.profile.${CURRENT_CREDENTIAL_USER}.email" "$current_email"
      fi

      # Create placeholder profiles for other stored users
      while IFS= read -r user; do
        if [ "$user" != "$CURRENT_CREDENTIAL_USER" ] && [ -n "$user" ]; then
          git config --global "switch-user.profile.${user}.name" "$user"
          git config --global "switch-user.profile.${user}.email" "${user}@example.com"
        fi
      done <<< "$stored_users"

      # Refresh profile list
      PROFILE_USERS=()
      while IFS= read -r _p; do
        if [ -n "${_p:-}" ]; then
          PROFILE_USERS+=("$_p")
        fi
      done < <(get_profile_users)
      PROFILE_COUNT=${#PROFILE_USERS[@]}

      # Set migration flag
      git config --global switch-user.migrated "true"
    fi
  fi
}

PROFILE_USERS=()
while IFS= read -r _p; do
  if [ -n "${_p:-}" ]; then
    PROFILE_USERS+=("$_p")
  fi
done < <(get_profile_users)

PROFILE_COUNT=${#PROFILE_USERS[@]}

migrate_existing_user

# move current to top
if [ -n "${CURRENT_CREDENTIAL_USER:-}" ] && [ "$PROFILE_COUNT" -gt 0 ]; then
  reordered=()
  for u in "${PROFILE_USERS[@]}"; do
    if [ "$u" = "$CURRENT_CREDENTIAL_USER" ]; then
      reordered=("$u" "${reordered[@]}")
    else
      reordered+=("$u")
    fi
  done
  PROFILE_USERS=("${reordered[@]}")
fi

print_profile_list() {
  if [ "$PROFILE_COUNT" -eq 0 ]; then
    echo "(none)"
  else
    i=1
    for u in "${PROFILE_USERS[@]}"; do
      if [ -n "${CURRENT_CREDENTIAL_USER:-}" ] && [ "$u" = "$CURRENT_CREDENTIAL_USER" ]; then
        echo "${i}) ${u} (current)"
      else
        echo "${i}) ${u}"
      fi
      i=$((i + 1))
    done
  fi
}

if [ "$ACTION" = "list" ]; then
  print_profile_list
  exit 0
fi

if [ "$ACTION" = "show-current" ]; then
  echo "${CURRENT_CREDENTIAL_USER}"
  exit 0
fi

if [ "$ACTION" = "switch" ]; then
  if [ -z "$TARGET_USER" ]; then
    echo "Missing user for --switch"
    exit 1
  fi
  if ! has_profile_for_user "$TARGET_USER"; then
    echo "Profile for '$TARGET_USER' is missing name/email. Use option 3 to add/update before switching."
    exit 1
  fi
  git config --global credential.username "$TARGET_USER"
  refresh_current_credential_user
  if apply_profile_strict "$CURRENT_CREDENTIAL_USER"; then
    echo "CURRENT USER IS: ${CURRENT_CREDENTIAL_USER}"
  else
    echo "Profile for '${CURRENT_CREDENTIAL_USER}' is missing name/email. Use option 3 to add/update before switching."
    exit 1
  fi
  exit 0
fi

print_profile_list

echo ""
echo "1) switch"
echo "2) show"
echo "3) add"
echo "4) delete"
echo "5) quit"

read -p "Choose [1-5]: " action_choice

case $action_choice in
  1)
    if [ "$PROFILE_COUNT" -eq 0 ]; then
      exit 0
    fi
    read -p "User number [1-${PROFILE_COUNT}]: " pick
    if [[ "$pick" =~ ^[0-9]+$ ]] && [ "$pick" -ge 1 ] && [ "$pick" -le "$PROFILE_COUNT" ]; then
      selected_user="${PROFILE_USERS[$((pick - 1))]}"
      git config --global credential.username "$selected_user"
      refresh_current_credential_user
      if apply_profile_strict "$CURRENT_CREDENTIAL_USER"; then
        echo "CURRENT USER IS: ${CURRENT_CREDENTIAL_USER}"
      else
        echo "Profile for '${CURRENT_CREDENTIAL_USER}' is missing name/email. Use option 3 to add/update before switching."
      fi
    fi
    ;;
  2)
    if [ "$PROFILE_COUNT" -eq 0 ]; then
      echo "No users to show"
    else
      read -p "User number [1-${PROFILE_COUNT}]: " pick
      if [[ "$pick" =~ ^[0-9]+$ ]] && [ "$pick" -ge 1 ] && [ "$pick" -le "$PROFILE_COUNT" ]; then
        selected_user="${PROFILE_USERS[$((pick - 1))]}"
        prof_name=$(git config --global --get "$(profile_key_name "$selected_user")" 2>/dev/null || echo '<not set>')
        prof_email=$(git config --global --get "$(profile_key_email "$selected_user")" 2>/dev/null || echo '<not set>')
        echo "User: ${selected_user}"
        echo "Name: ${prof_name}"
        echo "Email: ${prof_email}"
        read -p "Switch to this user? [y/N]: " confirm_switch
        if [[ "$confirm_switch" =~ ^[Yy]$ ]]; then
          git config --global credential.username "$selected_user"
          refresh_current_credential_user
          if apply_profile_strict "$CURRENT_CREDENTIAL_USER"; then
            echo "CURRENT USER IS: ${CURRENT_CREDENTIAL_USER}"
          else
            echo "Profile for '${CURRENT_CREDENTIAL_USER}' is missing name/email. Use option 3 to add/update before switching."
          fi
        fi
      fi
    fi
    ;;
  3)
    read -p "GitHub username: " new_cred_user
    if [ -z "$new_cred_user" ]; then
      exit 1
    fi

    # Ask for GitHub host (support enterprise GitHub)
    read -p "GitHub host [github.com]: " github_host
    github_host=${github_host:-github.com}

    configure_profile_for_user "$new_cred_user" || exit 1

    # Store PAT in ~/.git-credentials and prefer it over any host-specific helper override.
    read -s -p "Enter GitHub Personal Access Token (PAT) for '$new_cred_user' on '$github_host': " token
    echo ""
    if [ -n "$token" ]; then
      remove_host_specific_helper_override "$github_host"
      store_pat_for_user_and_host "$new_cred_user" "$github_host" "$token"
    fi

    git config --global credential.username "$new_cred_user"
    refresh_current_credential_user
    if apply_profile_strict "$CURRENT_CREDENTIAL_USER"; then
      echo "CURRENT USER IS: ${CURRENT_CREDENTIAL_USER}"
    else
      echo "Profile for '${CURRENT_CREDENTIAL_USER}' is missing name/email. Use option 3 to add/update before switching."
    fi
    ;;
  4)
    if [ "$PROFILE_COUNT" -eq 0 ]; then
      exit 0
    fi
    read -p "User number [1-${PROFILE_COUNT}]: " pick
    if [[ "$pick" =~ ^[0-9]+$ ]] && [ "$pick" -ge 1 ] && [ "$pick" -le "$PROFILE_COUNT" ]; then
      selected_user="${PROFILE_USERS[$((pick - 1))]}"
      git config --global --unset "$(profile_key_name "$selected_user")" 2>/dev/null || true
      git config --global --unset "$(profile_key_email "$selected_user")" 2>/dev/null || true
      if [ "${CURRENT_CREDENTIAL_USER:-}" = "$selected_user" ]; then
        git config --global --unset credential.username 2>/dev/null || true
      fi

      # Remove from ~/.git-credentials (all hosts for this user)
      if [ -f ~/.git-credentials ]; then
        tmp_file=$(mktemp)
        grep -vF "https://$selected_user:" ~/.git-credentials >"$tmp_file" 2>/dev/null || true
        mv "$tmp_file" ~/.git-credentials
        if [ ! -s ~/.git-credentials ]; then
          rm -f ~/.git-credentials
        fi
      fi
    fi
    ;;
  5)
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
