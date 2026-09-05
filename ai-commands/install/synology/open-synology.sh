#!/usr/bin/env sh
#
# open-synology.sh
#
# PURPOSE
# -------
# This script locates a Synology NAS on the local network and opens
# its DSM web interface in a browser.
#
# WHY THIS EXISTS
# ---------------
# - Synology devices may receive dynamic IPs via DHCP.
# - The IP address is often unknown or changes over time.
# - Synology’s official discovery tools are GUI-based.
#
# This script provides a simple, scriptable, and repeatable way to:
#   1) discover the Synology NAS on the LAN
#   2) extract its current IP address
#   3) open the DSM interface for login or setup
#
# WHAT IT DOES
# ------------
# - Delegates network discovery to `find-synology-ip.sh`
# - Validates that a Synology device is reachable
# - Prints the resolved IP address
# - Opens the DSM web UI (installer or login page)
#
# HOW IT WORKS
# ------------
# - `find-synology-ip.sh` scans the local network and prints
#   the IP address(es) of detected Synology NAS devices.
# - This script consumes that output and selects one device.
# - The DSM interface is accessed via HTTP on port 5000.
#   (DSM may automatically redirect to HTTPS / port 5001.)
#
# NOTES
# -----
# - This script does NOT install DSM.
# - If DSM is already installed, you will be redirected to /signin.
# - If DSM is not installed, the Web Assistant / installer is shown.
#
# REQUIREMENTS
# ------------
# - A working `find-synology-ip.sh` script in the same directory
# - Network access to the local LAN
# - `xdg-open` available to launch the browser (optional)
#
# EXIT CODES
# ----------
# 0  - Synology found and browser opened
# 1  - Discovery script missing or no Synology found
#

set -e
# Exit immediately if any command fails.
# Prevents continuing with partial or incorrect state.

# Path to the discovery helper script
FINDER="./find-synology-ip.sh"

# Ensure the discovery script exists and is executable
if [ ! -x "$FINDER" ]; then
  echo "❌ $FINDER not found or not executable"
  exit 1
fi

echo "[*] Locating Synology NAS..."

# Run discovery and select a single IP.
# The last line is used in case multiple devices are detected.
IP="$("$FINDER" | tail -n1)"

# Abort if no IP was returned
if [ -z "$IP" ]; then
  echo "❌ No Synology found on network"
  exit 1
fi

# Report the discovered device
echo "✅ Synology found at: $IP"
echo

# Open the DSM web interface.
# Port 5000 is the default entry point and may redirect to 5001 (HTTPS).
echo "➡ Opening DSM interface"
echo "   http://$IP:5000"
echo

# Attempt to open the URL in the default browser.
# Failure here should not stop the script.
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://$IP:5000" >/dev/null 2>&1 || true
fi
