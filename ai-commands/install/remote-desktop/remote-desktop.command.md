# remote desktop

## Purpose

Use `remote-desktop` through the parent `install` command to enable GNOME Remote Desktop sharing over RDP on Ubuntu.
The user service attaches to the currently logged-in GNOME session and enables remote keyboard and pointer control. TLS material is generated locally;
RDP credentials must be entered interactively and are never stored in the profile or repository.

## Usage

```bash
install/install.sh remote-desktop install --allowed-cidr 192.0.2.0/24
grdctl rdp set-credentials
install/install.sh remote-desktop smoke-test
```

The service starts whenever the desktop user logs in; on an auto-login workstation this also makes it available after
reboot. Connect from macOS with Windows App or another RDP client using the server's private IPv4 address. The adapter enables
UFW, preserves SSH on TCP 22, and permits TCP 3389 only from the explicitly supplied private CIDR. Do not expose TCP 3389 publicly.
