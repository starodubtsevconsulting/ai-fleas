# remote desktop

## Purpose

Use `remote-desktop` through the parent `install` command to enable GNOME Remote Desktop sharing over RDP on Ubuntu.
The user service attaches to the currently logged-in GNOME session and enables remote keyboard and pointer control. TLS material is generated locally;
RDP credentials must be entered interactively and are never stored in the profile or repository.

## Usage

```bash
install/install.sh remote-desktop install --allowed-cidr 192.0.2.0/24
grdctl rdp set-credentials <desktop-username>
install/install.sh remote-desktop smoke-test
```

On macOS, install the profile-driven Electron launcher as a normal clickable application:

```bash
install/install.sh remote-desktop install-launcher
```

The application is created at `~/Applications/AI Fleas Remote Desktop.app`. It lists only targets explicitly configured under `boxes.<id>.remote_desktop` in the selected profile. The configured username is an editable default, so another valid Linux user can be selected for an individual connection without changing the profile. Passwords are requested for each connection and are not stored.

For unattended server access before local login, select system remote-login mode and explicitly disable automatic login:

```bash
install/install.sh remote-desktop install --mode remote-login --disable-auto-login --allowed-cidr 192.0.2.0/24
sudo grdctl --system rdp set-credentials <username>
install/install.sh remote-desktop smoke-test --mode remote-login
install/install.sh remote-desktop diagnose --mode remote-login
```

The service starts whenever the desktop user logs in; on an auto-login workstation this also makes it available after
reboot. Connect from macOS with Windows App or another RDP client using the server's private IPv4 address. The adapter enables
UFW, preserves SSH on TCP 22, and permits GNOME's negotiated TCP range 3389-3398 only from the explicitly supplied private CIDR.
System remote login listens on 3389 and redirects the authenticated connection to a per-session server in that range. Do not expose the RDP range publicly.

## Diagnostics

Run the profile-aware diagnostic command immediately after a failed connection:

```bash
install/install.sh remote-desktop diagnose --mode remote-login
```

It reports configuration, boot state, listeners, LAN firewall rules, login sessions, and the last ten minutes of GNOME Remote Desktop logs. It does not print stored RDP credentials.

## Problems and solutions

### `PROFILE_REQUIRED` or `workflow is not registered`

Cause: the command guard did not receive the selected profile and the exact workflow ID from the profile. A display label such as `dev` may differ from the registered path such as `dev.workflow.md`.

Solution: activate the profile normally, or supply the exact configured profile, workflow, and platform environment. Do not bypass the guard.

### Sudo asks for a password during unattended installation

Cause: membership in the `sudo` group still requires password authentication by default.

Solution: provision a narrowly managed sudo policy or a temporary validated `NOPASSWD` bootstrap rule. Remove temporary broad bootstrap access after provisioning.

### `Object does not exist at .../secrets/collection/login`

Cause: user-mode `grdctl rdp set-credentials` needs a logged-in graphical user's Secret Service collection. It is not suitable for configuring boot-level remote login over a plain SSH session.

Solution: for unattended login, use `sudo grdctl --system rdp set-credentials <username>`. Enter the password interactively; never put it in the profile, repository, shell history, or command documentation.

### Connection opens a black window and logs stop at `Sending server redirection`

Cause: system remote login hands the client from port 3389 to a per-session GNOME server. Disabling port negotiation or allowing only port 3389 prevents that handover.

Solution: keep port negotiation enabled and allow TCP 3389-3398 only from the explicitly trusted private CIDR. The installer configures this automatically.

### Black window after redirection with `MIC verification failed` and `SEC_E_MESSAGE_ALTERED`

Cause: the redirect reached the GNOME handover server, but the RDP client failed redirected NLA authentication. This has been observed with Microsoft Remote Desktop/Windows App on macOS and is a client/server compatibility problem, not a blocked port.

Solution: confirm with a current FreeRDP client:

```bash
sdl-freerdp /v:<private-ip> /u:<rdp-username> /cert:tofu /from-stdin:force
```

`/from-stdin:force` avoids an SDL credential-dialog cancellation observed on macOS and requests the RDP password securely in Terminal. Run this command on the client Mac, not inside the SSH session. For a larger display, add `/f /dynamic-resolution` for fullscreen or `/size:1600x1000 /dynamic-resolution` for a resizable window.

If FreeRDP reaches the GNOME login screen, the server configuration and GNOME handover are working. Keep the server configuration and use a compatible client while tracking the Windows App/GNOME issue. Do not disable NLA or expose extra ports as a workaround.

### A local session exists or automatic login is enabled

Cause: GNOME remote login may be unable to start another graphical session for the same user, or may ask to terminate the existing session.

Solution: system remote-login mode requires the explicit `--disable-auto-login` decision. Log out existing graphical sessions before testing. The installer disables GDM automatic login and preserves the original GDM configuration backup.

### Service works now but fails after reboot

Cause: user desktop-sharing mode starts with the graphical user session; it is not boot-level remote login.

Solution: use `--mode remote-login`, verify `systemctl is-enabled gnome-remote-desktop.service`, and run the smoke test. Use desktop-sharing mode only when attaching to an already logged-in desktop is intentional.
