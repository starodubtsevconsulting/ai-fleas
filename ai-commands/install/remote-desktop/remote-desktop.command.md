# remote desktop

## Purpose

Use `remote-desktop` through the parent `install` command to enable GNOME Remote Desktop remote login over RDP on Ubuntu.
The system service starts with the graphical boot target and enables remote keyboard and pointer control. TLS material is generated locally;
RDP credentials must be entered interactively and are never stored in the profile or repository.

## Usage

```bash
install/install.sh remote-desktop install --allowed-cidr 192.0.2.0/24
sudo grdctl --system rdp set-credentials
install/install.sh remote-desktop smoke-test
```

Connect from macOS with Windows App or another RDP client using the server's private IPv4 address. The adapter enables
UFW, preserves SSH on TCP 22, and permits TCP 3389 only from the explicitly supplied private CIDR. Do not expose TCP 3389 publicly.
