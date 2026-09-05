#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "docker/install.sh" "$root_dir"
if ! "$script_dir/../scripts/confirm-reinstall.sh" "Docker" "command -v docker"; then
  exit 0
fi

# Install Docker Engine from the official Docker repo
bash "$script_dir/../scripts/apt-update.sh"
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
arch="$(dpkg --print-architecture)"
echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

bash "$script_dir/../scripts/apt-update.sh"
# Remove conflicting Ubuntu packages if present
sudo apt remove -y docker.io containerd runc || true

sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable --now docker

# Add current user to docker group for non-root usage
if getent group docker >/dev/null 2>&1; then
  sudo usermod -aG docker "$USER"
fi

bash "$script_dir/post-setup.step.sh"

echo "Docker installed. Log out/in or run: newgrp docker"
echo
echo "=== README ==="
cat "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/README.md"
