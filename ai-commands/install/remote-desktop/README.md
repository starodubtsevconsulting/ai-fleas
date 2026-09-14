# GNOME Remote Desktop

This adapter enables Ubuntu GNOME's system RDP remote-login service at boot. Run it only through the profile-aware parent
command. Credentials are configured interactively with `sudo grdctl --system rdp set-credentials` and remain in GNOME's
credential storage. RDP is restricted to the configured LAN firewall scope.
