#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "kdenlive/install.sh" "$root_dir"

app_id="org.kde.kdenlive"

if ! "$script_dir/../scripts/confirm-reinstall.sh" "Kdenlive" "flatpak info $app_id"; then
  exit 0
fi

if ! command -v flatpak >/dev/null 2>&1; then
  bash "$script_dir/../scripts/apt-update.sh"
  sudo apt install -y flatpak
fi

if ! flatpak remotes --columns=name 2>/dev/null | grep -qx "flathub"; then
  sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
fi

flatpak install -y flathub "$app_id"

flatpak override --user \
  --socket=pulseaudio \
  --filesystem=xdg-run/pipewire-0 \
  "$app_id"

repair_kdenlive_audio_state() {
  if ! command -v pactl >/dev/null 2>&1; then
    echo "Skipping Kdenlive audio state repair: pactl not found."
    return 0
  fi

  if ! pactl info >/dev/null 2>&1; then
    echo "Skipping Kdenlive audio state repair: no desktop Pulse/PipeWire session available."
    return 0
  fi

  local runtime_log
  local ffplay_pid
  local sink_input_id=""
  local start_ts
  local elapsed=0
  local line
  local client_id

  runtime_log="$(mktemp)"
  trap 'rm -f "$runtime_log"' RETURN

  flatpak run --command=ffplay "$app_id" \
    -nodisp -autoexit -f lavfi -i sine=frequency=660:duration=8 \
    >"$runtime_log" 2>&1 &
  ffplay_pid=$!
  start_ts="$(date +%s)"

  while kill -0 "$ffplay_pid" 2>/dev/null; do
    while IFS=$'\t' read -r line_id line_sink line_client _rest; do
      [ -z "${line_id:-}" ] && continue
      client_id="${line_client:-}"
      if pactl list sink-inputs | grep -A25 -F "Sink Input #$line_id" | grep -Fq 'application.name = "SDL Application"'; then
        sink_input_id="$line_id"
        break 2
      fi
      if [ -n "$client_id" ] && pactl list clients | grep -A20 -F "Client #$client_id" | grep -Fq "application.process.binary = \"ffplay\""; then
        sink_input_id="$line_id"
        break 2
      fi
    done < <(pactl list short sink-inputs)

    elapsed=$(( $(date +%s) - start_ts ))
    if [ "$elapsed" -ge 8 ]; then
      break
    fi
    sleep 1
  done

  if [ -n "$sink_input_id" ]; then
    pactl set-sink-input-mute "$sink_input_id" 0 || true
    pactl set-sink-input-volume "$sink_input_id" 100% || true
    echo "Updated Kdenlive runtime playback stream state for sink input #$sink_input_id."
  else
    echo "No Kdenlive runtime playback stream was detected for audio-state repair."
  fi

  wait "$ffplay_pid" || true
}

repair_kdenlive_audio_state

echo "Kdenlive installed successfully."
echo
echo "=== README ==="
cat "$script_dir/README.md"
