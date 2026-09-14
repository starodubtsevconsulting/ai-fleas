# remote desktop

## Purpose

Use `remote-desktop` through the parent `install` command to enable GNOME Remote Desktop over RDP on Ubuntu. It shares
the currently logged-in GNOME desktop and enables remote keyboard and pointer control. TLS material is generated locally;
RDP credentials must be entered interactively and are never stored in the profile or repository.

## Usage

```bash
install/install.sh remote-desktop install
grdctl rdp set-credentials
install/install.sh remote-desktop smoke-test
```

Connect from macOS with Windows App or another RDP client using the server's trusted local hostname or private address.
Do not expose TCP port 3389 directly to the public Internet.
