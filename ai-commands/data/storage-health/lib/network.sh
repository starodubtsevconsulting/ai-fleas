#!/usr/bin/env bash
storage_network_access(){
  local root="${AI_STORAGE_MOUNT:-/srv/ai-storage}" user="${SUDO_USER:-$USER}" group share marker
  mountpoint -q "$root" || { echo "ERROR: AI storage is not mounted at $root" >&2; return 2; }
  echo "AI Fleas · Configure Network Access"
  echo "───────────────────────────────────"
  echo "Storage: $root"
  echo "Protocol: SMB (local network only)"
  echo
  echo "Shares to expose:"
  echo "  • AI-Artifacts  → $root/artifacts  (read/write)"
  echo "  • AI-Archive    → $root/archive    (read/write)"
  echo "  • AI-Models     → $root/models     (read-only)"
  echo
  echo "Not shared:"
  echo "  • hermes/ — internal runtime data"
  echo "  • memory/ — internal agent memory"
  echo
  echo "This action installs/configures Samba on this host and does not expose SMB through Cloudflare or the public internet."
  [[ -t 0 ]] || { echo "ERROR: network-share setup requires interactive confirmation." >&2; return 2; }
  printf "Configure these LAN shares? [y/N] "; local answer; read -r answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]] || { echo "No changes made."; return 0; }

  if ! command -v smbd >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y samba
    else echo "ERROR: Samba is not installed and automatic installation currently supports apt-based Linux only." >&2; return 2; fi
  fi
  sudo mkdir -p "$root"/{artifacts,archive,models}
  sudo chown "$user":"$(id -gn "$user")" "$root"/{artifacts,archive,models}
  sudo chmod 2770 "$root"/{artifacts,archive}
  sudo chmod 2750 "$root/models"

  marker="/etc/samba/ai-fleas-storage.conf"
  sudo tee "$marker" >/dev/null <<EOF
[AI-Artifacts]
   path = $root/artifacts
   browseable = yes
   read only = no
   valid users = $user
   create mask = 0660
   directory mask = 2770

[AI-Archive]
   path = $root/archive
   browseable = yes
   read only = no
   valid users = $user
   create mask = 0660
   directory mask = 2770

[AI-Models]
   path = $root/models
   browseable = yes
   read only = yes
   valid users = $user
EOF
  if ! sudo grep -Fq "include = $marker" /etc/samba/smb.conf; then
    printf '\ninclude = %s\n' "$marker" | sudo tee -a /etc/samba/smb.conf >/dev/null
  fi
  sudo testparm -s >/dev/null || { echo "ERROR: Samba configuration validation failed." >&2; return 2; }
  echo
  echo "SMB requires a Samba password for Linux user: $user"
  echo "Set/update it now. This is separate from the Linux login password."
  sudo smbpasswd -a "$user"
  sudo systemctl enable --now smbd
  sudo systemctl reload smbd

  local host; host="$(hostname)"
  echo
  echo "NETWORK ACCESS READY"
  echo "From macOS Finder: Go → Connect to Server"
  echo "  smb://$host/AI-Artifacts"
  echo "  smb://$host/AI-Archive"
  echo "  smb://$host/AI-Models"
  echo
  echo "Use Samba user: $user"
  echo "AI-Models is read-only; Artifacts and Archive are read/write."
  echo "LAN access only; do not expose TCP 445 publicly."
}
