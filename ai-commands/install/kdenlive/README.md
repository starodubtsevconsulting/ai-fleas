# Kdenlive installer

Installs `org.kde.kdenlive` from Flathub and applies a post-install audio safeguard.

## Notes

- Kdenlive is installed as a Flatpak.
- The installer ensures PulseAudio/PipeWire access is available for the Flatpak runtime.
- After install or reinstall, the script runs a short audio warm-up inside the Kdenlive runtime and clears a muted
restored playback stream if PipeWire/Pulse brings it up muted.
- This safeguard is targeted at the Kdenlive runtime stream and avoids wiping unrelated desktop audio state.
