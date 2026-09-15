# GNOME Remote Desktop

This adapter enables Ubuntu GNOME RDP sharing for the current desktop user. Run it only through the profile-aware parent
command. Credentials are configured interactively with `grdctl rdp set-credentials` and remain in GNOME's credential
storage. The user service starts at login; an auto-login workstation therefore restores it after reboot. RDP is
restricted to the configured LAN firewall scope.
