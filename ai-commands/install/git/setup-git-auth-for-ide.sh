#!/usr/bin/env bash
set -euo pipefail

# Tot make sure IDE respects the `git.command-switch-user.sh` global settings

REMOTE_NAME="${1:-origin}"

# 1) Make sure ssh-agent is running
if ! ssh-add -l >/dev/null 2>&1; then
  echo "Starting ssh-agent..."
  eval "$(ssh-agent -s)" >/dev/null
fi

# 2) Add a default SSH key if none loaded
if ! ssh-add -l >/dev/null 2>&1 || ssh-add -l | grep -qi "no identities"; then
  if [[ -f "$HOME/.ssh/id_ed25519" ]]; then
    ssh-add "$HOME/.ssh/id_ed25519"
  elif [[ -f "$HOME/.ssh/id_rsa" ]]; then
    ssh-add "$HOME/.ssh/id_rsa"
  else
    echo "No SSH key found at ~/.ssh/id_ed25519 or ~/.ssh/id_rsa"
    echo "Create one with: ssh-keygen -t ed25519 -C \"you@example.com\""
    exit 1
  fi
fi

# 3) Convert HTTPS remote -> SSH remote (GitHub/GitLab style)
url="$(git remote get-url "$REMOTE_NAME")"
echo "Current $REMOTE_NAME URL: $url"

if [[ "$url" =~ ^https://([^/]+)/(.+)$ ]]; then
  host="${BASH_REMATCH[1]}"
  path="${BASH_REMATCH[2]}"
  path="${path%.git}"
  ssh_url="git@${host}:${path}.git"
  echo "Setting $REMOTE_NAME to SSH: $ssh_url"
  git remote set-url "$REMOTE_NAME" "$ssh_url"
else
  echo "Remote already not HTTPS (likely SSH). No change."
fi

# 4) Test auth (non-fatal if host isn't GitHub)
echo "Testing SSH authentication (may prompt on first connect)..."
ssh -o StrictHostKeyChecking=accept-new -T "git@$(git remote get-url "$REMOTE_NAME" | sed -E 's#git@([^:]+):.*#\1#')" || true

echo "Done. Try: git push"
