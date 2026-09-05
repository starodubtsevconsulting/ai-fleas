#!/bin/sh
# The profile resolver below uses Bash associative arrays. macOS still ships
# Bash 3.2, so explicitly select a Bash 4+ runtime when one is available.
if [ -z "${BASH_VERSION:-}" ] || [ "${BASH_VERSINFO[0]:-0}" -lt 4 ]; then
  for bash_runtime in /opt/homebrew/bin/bash /usr/local/bin/bash /usr/bin/bash /bin/bash; do
    if [ -x "$bash_runtime" ] && "$bash_runtime" -c '[ "${BASH_VERSINFO[0]}" -ge 4 ]' 2>/dev/null; then
      exec "$bash_runtime" "$0" "$@"
    fi
  done
  echo "Voice Report requires Bash 4 or newer. Install it with: brew install bash" >&2
  exit 1
fi

set -euo pipefail

# `pip install --user` places edge-tts here on macOS, but desktop launches do
# not necessarily inherit the user's interactive shell PATH.
if command -v python3 >/dev/null 2>&1; then
  python_user_bin="$(python3 -m site --user-base 2>/dev/null)/bin"
  if [ -d "$python_user_bin" ]; then
    PATH="$python_user_bin:$PATH"
  fi
fi
# A desktop launcher can select a different Python version than the one used
# for `pip install --user`; include all macOS user Python script directories.
if [ -n "${HOME:-}" ] && [ -d "$HOME/Library/Python" ]; then
  for python_bin in "$HOME"/Library/Python/*/bin; do
    [ -d "$python_bin" ] || continue
    PATH="$python_bin:$PATH"
  done
fi
export PATH

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_file="$script_dir/install.config"
parser_py="$script_dir/sample_text_parser.py"
dialog_parser_py="$script_dir/dialog_script_parser.py"
if [ -f "$config_file" ]; then
  # shellcheck disable=SC1090
  source "$config_file"
fi

sample_text_file="$script_dir/sample-text.txt"
input_text_file="${WHISPER_TTS_TEXT_FILE:-}"
profiles_file_arg="${WHISPER_TTS_PROFILES_FILE:-}"
strict_profiles="${WHISPER_TTS_STRICT_PROFILES:-0}"
parser_input_file=""
profiles_tsv=""
validate_only=0
positionals=()
declare -A PROFILE_VOICE=()
declare -A PROFILE_RATE=()
declare -A PROFILE_PITCH=()
declare -A PROFILE_ESPEAK_SPEED=()
declare -A PROFILE_ESPEAK_PITCH=()
declare -A PROFILE_ESPEAK_AMP=()
declare -A PROFILE_ALIAS_TO_CANONICAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --validate-only)
      validate_only=1
      shift
      ;;
    --)
      shift
      while [ $# -gt 0 ]; do
        positionals+=("$1")
        shift
      done
      ;;
    *)
      positionals+=("$1")
      shift
      ;;
  esac
done
set -- "${positionals[@]}"

if [ -n "$input_text_file" ] && [ ! -f "$input_text_file" ]; then
  echo "Input text file not found: $input_text_file" >&2
  exit 1
fi
if [ -n "$profiles_file_arg" ] && [ ! -f "$profiles_file_arg" ]; then
  echo "Profiles file not found: $profiles_file_arg" >&2
  exit 1
fi

if [ -n "${1-}" ]; then
  text="$1"
  text_source="arg"
elif [ -n "$input_text_file" ]; then
  text="$(cat "$input_text_file")"
  text_source="input-file"
  parser_input_file="$input_text_file"
elif [ -f "$sample_text_file" ]; then
  text="$(cat "$sample_text_file")"
  text_source="sample-file"
  parser_input_file="$sample_text_file"
else
  text="Whisper installation check sample text."
  text_source="built-in"
fi
output_file="${2:-$script_dir/test/output.wav}"
log_dir="$script_dir/logs"
log_file="$log_dir/text-to-audio.log"
err_log="$log_dir/text-to-audio.err.log"
directive_log="${output_file%.*}.directives.log"
note="run-complete"
require_neural="${WHISPER_REQUIRE_NEURAL:-${WHISPER_FEATURE_REQUIRE_NEURAL:-1}}"
feature_multi_voice="${WHISPER_FEATURE_MULTI_VOICE:-1}"
tts_timeout="${WHISPER_TTS_TIMEOUT_SEC:-25}"
default_unlabeled_speaker="${WHISPER_TTS_DEFAULT_UNLABELED_SPEAKER:-narrator}"
edge_tts_retries="${WHISPER_TTS_RETRIES:-5}"
edge_tts_retry_sleep="${WHISPER_TTS_RETRY_SLEEP_SEC:-3}"
preflight_validation="${WHISPER_TTS_PREFLIGHT_VALIDATE:-1}"
preflight_probe="${WHISPER_TTS_PREFLIGHT_PROBE:-0}"

mkdir -p "$log_dir"

last_status="$(awk 'NF{status=$2} END{print status}' "$log_file" 2>/dev/null || true)"
if [ -n "$last_status" ]; then
  echo "[LOG] Previous text-to-audio status: $last_status"
fi

on_exit() {
  local ec="$?"
  local ts status
  ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
  if [ "$ec" -eq 0 ]; then
    status="OK"
  else
    status="FAIL"
  fi
  if [ -n "${profiles_tsv:-}" ] && [ -f "$profiles_tsv" ]; then
    rm -f "$profiles_tsv"
  fi
  printf "%s %s output=%s note=%s\n" "$ts" "$status" "$output_file" "$note" >> "$log_file"
  if [ "$ec" -eq 0 ]; then
    echo "[OK] text-to-audio status: OK"
  else
    echo "[FAIL] text-to-audio status: FAIL"
  fi
  echo "Log: $log_file"
  return "$ec"
}
trap on_exit EXIT

sanitize_script_text() {
  local input_text="$1"
  printf "%s\n" "$input_text" | awk '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    {
      line=$0
      gsub(/\r$/, "", line)
      t=trim(line)
      if (t=="" || t=="---") next
      if (t ~ /^\[[^]]+\]$/) next
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ \t]*\[[^]]+\][ \t]*$/) next
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ \t]*$/) next
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ \t]*/) {
        sub(/^[A-Za-z][A-Za-z _-]*:[ \t]*/, "", t)
        t=trim(t)
      }
      if (t!="") print t
    }
  '
}


write_script_directives_log() {
  local text_file_path="$1"
  local directive_log_path="$2"
  awk '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    function lower(s, out) { out=tolower(s); return out }
    BEGIN { line_no=0 }
    {
      raw=$0
      line_no++
      gsub(/\r$/, "", raw)
      t=trim(raw)
      if (t=="" || t=="---") next
      if (t ~ /^\[[^]]+\]$/) {
        inner=t
        sub(/^\[/, "", inner)
        sub(/\]$/, "", inner)
        low=lower(inner)
        if (low == "pause") {
          printf "line=%d\taction=pause\tduration_ms=600\traw=%s\n", line_no, t
        } else if (low == "long pause") {
          printf "line=%d\taction=pause\tduration_ms=1200\traw=%s\n", line_no, t
        } else {
          printf "line=%d\taction=skip-directive\traw=%s\n", line_no, t
        }
      }
    }
  ' "$text_file_path" > "$directive_log_path"
}

append_silence_segment() {
  local output_path="$1"
  local duration_ms="$2"
  local duration_sec
  duration_sec="$(awk -v ms="$duration_ms" 'BEGIN { printf "%.3f", ms / 1000 }')"
  ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=24000:cl=mono -t "$duration_sec" "$output_path" >/dev/null 2>&1
}

run_edge_tts() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "${tts_timeout}s" edge-tts "$@" >>"$err_log" 2>&1
  else
    edge-tts "$@" >>"$err_log" 2>&1
  fi
}

retry_edge_tts() {
  local attempt rc
  attempt=1
  while [ "$attempt" -le "$edge_tts_retries" ]; do
    if run_edge_tts "$@"; then
      return 0
    fi
    rc="$?"
    if [ "$attempt" -lt "$edge_tts_retries" ]; then
      echo "edge-tts retry ${attempt}/${edge_tts_retries} rc=$rc" >> "$err_log"
      sleep "$edge_tts_retry_sleep"
    fi
    attempt=$((attempt + 1))
  done
  return "$rc"
}

resolve_voice_triplet() {
  local profile_key="$1"
  local resolved_voice="$voice_default"
  local resolved_rate="$rate"
  local resolved_pitch="$pitch"

  case "$profile_key" in
    narrator)
      resolved_voice="$voice_narrator"
      resolved_rate="$rate_narrator"
      resolved_pitch="$pitch_narrator"
      ;;
    maria)
      resolved_voice="$voice_maria"
      resolved_rate="$rate_maria"
      resolved_pitch="$pitch_maria"
      ;;
    robert)
      resolved_voice="$voice_robert"
      resolved_rate="$rate_robert"
      resolved_pitch="$pitch_robert"
      ;;
  esac

  resolved_voice="${PROFILE_VOICE[$profile_key]:-$resolved_voice}"
  resolved_rate="${PROFILE_RATE[$profile_key]:-$resolved_rate}"
  resolved_pitch="${PROFILE_PITCH[$profile_key]:-$resolved_pitch}"
  printf '%s	%s	%s
' "$resolved_voice" "$resolved_rate" "$resolved_pitch"
}

validate_multivoice_inputs() {
  local parsed_tsv_path="$1"
  local voice_plan_path="$2"
  local speaker_name utterance profile_key triplet seg_voice_local seg_rate_local seg_pitch_local
  local -A seen_voice_specs=()

  : > "$voice_plan_path"
  while IFS=$'	' read -r speaker_name utterance; do
    [ -z "${utterance:-}" ] && continue
    if [ "$speaker_name" = "__directive__" ]; then
      continue
    fi
    profile_key="$(resolve_profile_key "$speaker_name")"
    if [ -z "$profile_key" ]; then
      echo "Could not resolve profile key for speaker=$speaker_name" >> "$err_log"
      return 1
    fi
    if [ -n "$profiles_file_arg" ] && [ "$strict_profiles" = "1" ] && [ -z "${PROFILE_VOICE[$profile_key]:-}" ]; then
      echo "No profile voice configured for speaker=$speaker_name resolved=$profile_key" >> "$err_log"
      return 1
    fi
    triplet="$(resolve_voice_triplet "$profile_key")"
    IFS=$'	' read -r seg_voice_local seg_rate_local seg_pitch_local <<< "$triplet"
    seen_voice_specs["$profile_key"]="$seg_voice_local|$seg_rate_local|$seg_pitch_local"
  done < "$parsed_tsv_path"

  for profile_key in "${!seen_voice_specs[@]}"; do
    printf '%s	%s
' "$profile_key" "${seen_voice_specs[$profile_key]}" >> "$voice_plan_path"
  done
}

probe_profile_voices() {
  local voice_plan_path="$1"
  local tmp_probe_dir profile_key spec seg_voice_local seg_rate_local seg_pitch_local probe_mp3

  [ "$preflight_probe" = "1" ] || return 0

  tmp_probe_dir="$(mktemp -d)"
  while IFS=$'	' read -r profile_key spec; do
    [ -z "${profile_key:-}" ] && continue
    IFS='|' read -r seg_voice_local seg_rate_local seg_pitch_local <<< "$spec"
    probe_mp3="$tmp_probe_dir/${profile_key}.mp3"
    if ! retry_edge_tts --voice "$seg_voice_local" --rate="$seg_rate_local" --pitch="$seg_pitch_local" --text 'Ready.' --write-media "$probe_mp3"; then
      echo "Preflight voice probe failed for speaker=$profile_key voice=$seg_voice_local" >> "$err_log"
      rm -rf "$tmp_probe_dir"
      return 1
    fi
  done < "$voice_plan_path"
  rm -rf "$tmp_probe_dir"
}

split_utterance() {
  local text_in="$1"
  local max_chars="${2:-220}"
  python3 - "$text_in" "$max_chars" <<'PY'
import re
import sys

text = sys.argv[1].strip()
max_chars = int(sys.argv[2])
if not text:
    raise SystemExit(0)

parts = re.split(r'(?<=[.!?])\s+', text)
current = ""
chunks = []
for p in parts:
    p = p.strip()
    if not p:
        continue
    candidate = p if not current else current + " " + p
    if len(candidate) <= max_chars:
        current = candidate
    else:
        if current:
            chunks.append(current)
        # Keep sentence integrity: do not split by words mid-sentence.
        current = p
if current:
    chunks.append(current)

for c in chunks:
    print(c)
PY
}

normalize_label() {
  local raw="${1:-}" label
  label="$(printf "%s" "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  case "$label" in
    narator|narraror|narratorr)
      label="narrator"
      ;;
    robot)
      label="robert"
      ;;
  esac
  printf "%s\n" "$label"
}

write_parsed_tsv_from_text() {
  local text_file_path="$1"
  local parsed_tsv_path="$2"
  awk -v default_speaker_input="$default_unlabeled_speaker" '
    function trim(s) { gsub(/^[ 	]+|[ 	]+$/, "", s); return s }
    function norm(s, x) {
      x=tolower(trim(s))
      gsub(/[^a-z0-9]+/, "-", x)
      gsub(/^-+/, "", x)
      gsub(/-+$/, "", x)
      if (x == "narator" || x == "narraror" || x == "narratorr") return "narrator"
      if (x == "robot") return "robert"
      return x
    }
    BEGIN {
      speaker=norm(default_speaker_input)
      pending=""
      default_speaker=speaker
    }
    {
      line=$0
      gsub(/\r$/, "", line)
      t=trim(line)
      if (t=="" || t=="---") next

      if (t ~ /^\[[^]]+\]$/) {
        low=tolower(t)
        if (low == "[pause]") {
          printf "__directive__\tpause_ms=600|raw=%s\n", t
          next
        }
        if (low == "[long pause]") {
          printf "__directive__\tpause_ms=1200|raw=%s\n", t
          next
        }
        next
      }
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ 	]*\[[^]]+\][ 	]*$/) {
        sp=t
        sub(/:.*/, "", sp)
        pending=norm(sp)
        next
      }
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ 	]*$/) {
        sp=t
        sub(/:.*/, "", sp)
        pending=norm(sp)
        next
      }
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ 	]*/) {
        sp=t
        sub(/:.*/, "", sp)
        speaker=norm(sp)
        pending=""
        textline=t
        sub(/^[A-Za-z][A-Za-z _-]*:[ 	]*/, "", textline)
        textline=trim(textline)
        gsub(/[ 	]+/, " ", textline)
        if (textline!="") printf "%s\t%s\n", speaker, textline
        next
      }
      if (pending != "") {
        speaker=pending
        pending=""
      } else {
        speaker=default_speaker
      }
      textline=t
      gsub(/[ 	]+/, " ", textline)
      printf "%s\t%s\n", speaker, textline
    }
  ' "$text_file_path" > "$parsed_tsv_path"
}

load_profile_maps() {
  local current_key="" kind rest
  PROFILE_VOICE=()
  PROFILE_RATE=()
  PROFILE_PITCH=()
  PROFILE_ESPEAK_SPEED=()
  PROFILE_ESPEAK_PITCH=()
  PROFILE_ESPEAK_AMP=()
  PROFILE_ALIAS_TO_CANONICAL=()

  [ -n "$profiles_file_arg" ] || return 0

  while IFS='=' read -r kind rest; do
    case "$kind" in
      canonical)
        current_key="$rest"
        ;;
      voice)
        PROFILE_VOICE["$current_key"]="$rest"
        ;;
      rate)
        PROFILE_RATE["$current_key"]="$rest"
        ;;
      pitch)
        PROFILE_PITCH["$current_key"]="$rest"
        ;;
      espeak_speed)
        PROFILE_ESPEAK_SPEED["$current_key"]="$rest"
        ;;
      espeak_pitch)
        PROFILE_ESPEAK_PITCH["$current_key"]="$rest"
        ;;
      espeak_amp)
        PROFILE_ESPEAK_AMP["$current_key"]="$rest"
        ;;
      alias)
        [ -n "$rest" ] && PROFILE_ALIAS_TO_CANONICAL["$rest"]="$current_key"
        ;;
      end)
        current_key=""
        ;;
    esac
  done < <(
    python3 - "$profiles_file_arg" <<'PY'
import json
import re
import sys
from pathlib import Path

def normalize(value: str) -> str:
    text = re.sub(r'[^a-z0-9]+', '-', (value or '').strip().lower()).strip('-')
    return {'narator': 'narrator', 'narraror': 'narrator', 'narratorr': 'narrator', 'robot': 'robert'}.get(text, text)

raw = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
profiles = raw.get('profiles', raw) if isinstance(raw, dict) else raw
if not isinstance(profiles, list):
    raise SystemExit(f'Invalid profiles file shape: {sys.argv[1]}')
for profile in profiles:
    if not isinstance(profile, dict):
        raise SystemExit('Profiles file entries must be JSON objects.')
    aliases = []
    for value in (profile.get('id'), profile.get('speaker')):
        if isinstance(value, str) and value.strip():
            aliases.append(normalize(value))
    extra = profile.get('aliases')
    if isinstance(extra, list):
        aliases.extend(normalize(v) for v in extra if isinstance(v, str) and v.strip())
    aliases = [a for a in aliases if a]
    if not aliases:
        continue
    canonical = aliases[0]
    deduped = []
    seen = set()
    for alias in [canonical, *aliases]:
        if alias and alias not in seen:
            seen.add(alias)
            deduped.append(alias)
    print(f'canonical={canonical}')
    print(f"voice={str(profile.get('voice', '') or '')}")
    print(f"rate={str(profile.get('rate', '') or '')}")
    print(f"pitch={str(profile.get('pitch', '') or '')}")
    print(f"espeak_speed={str(profile.get('espeakSpeed', profile.get('espeak_speed', '')) or '')}")
    print(f"espeak_pitch={str(profile.get('espeakPitch', profile.get('espeak_pitch', '')) or '')}")
    print(f"espeak_amp={str(profile.get('espeakAmplitude', profile.get('espeak_amplitude', '')) or '')}")
    for alias in deduped:
        print(f'alias={alias}')
    print('end=1')
PY
  )
}

resolve_profile_key() {
  local normalized
  normalized="$(normalize_label "$1")"
  if [ -n "${PROFILE_ALIAS_TO_CANONICAL[$normalized]:-}" ]; then
    printf "%s
" "${PROFILE_ALIAS_TO_CANONICAL[$normalized]}"
  else
    printf "%s
" "$normalized"
  fi
}

synthesize_espeak_multivoice() {
  local text_input="$1"
  local output_path="$2"
  local tmp_dir text_file parsed_tsv concat_list seg_idx line_idx speaker_name utterance profile_key seg_speaker seg_wav seg_speed seg_pitch seg_amp directive_ms

  tmp_dir="$(mktemp -d)"
  text_file="$tmp_dir/source.txt"
  parsed_tsv="$tmp_dir/parsed.tsv"
  concat_list="$tmp_dir/concat.txt"

  printf "%s\n" "$text_input" > "$text_file"
  write_parsed_tsv_from_text "$text_file" "$parsed_tsv"

  seg_idx=0
  line_idx=0
  while IFS=$'\t' read -r speaker_name utterance; do
    [ -z "${utterance:-}" ] && continue

    if [ "$speaker_name" = "__directive__" ]; then
      directive_ms="$(printf '%s' "$utterance" | sed -n 's/^pause_ms=\([0-9][0-9]*\).*/\1/p')"
      if [ -n "$directive_ms" ]; then
        seg_wav="$tmp_dir/seg_${seg_idx}.wav"
        if ! append_silence_segment "$seg_wav" "$directive_ms"; then
          rm -rf "$tmp_dir"
          return 1
        fi
        printf "file '%s'\n" "$seg_wav" >> "$concat_list"
        seg_idx=$((seg_idx + 1))
      fi
      continue
    fi
    line_idx=$((line_idx + 1))
    profile_key="$(resolve_profile_key "$speaker_name")"
    seg_speaker="$profile_key"

    seg_speed="${PROFILE_ESPEAK_SPEED[$profile_key]:-}"
    seg_pitch="${PROFILE_ESPEAK_PITCH[$profile_key]:-}"
    seg_amp="${PROFILE_ESPEAK_AMP[$profile_key]:-}"
    if [ -z "$seg_speed" ] || [ -z "$seg_pitch" ] || [ -z "$seg_amp" ]; then
      seg_speed=155
      seg_pitch=42
      seg_amp=140
      case "$seg_speaker" in
        narrator)
          seg_speed=150
          seg_pitch=38
          seg_amp=145
          ;;
        maria)
          seg_speed=170
          seg_pitch=58
          seg_amp=140
          ;;
        robert)
          seg_speed=155
          seg_pitch=42
          seg_amp=145
          ;;
      esac
    fi

    seg_wav="$tmp_dir/seg_${seg_idx}.wav"
    if ! espeak-ng -s "$seg_speed" -p "$seg_pitch" -a "$seg_amp" -w "$seg_wav" "$utterance" >/dev/null 2>&1; then
      rm -rf "$tmp_dir"
      return 1
    fi
    printf "file '%s'\n" "$seg_wav" >> "$concat_list"
    seg_idx=$((seg_idx + 1))
  done < "$parsed_tsv"

  if [ ! -s "$concat_list" ]; then
    rm -rf "$tmp_dir"
    return 1
  fi

  if ! ffmpeg -y -loglevel error -f concat -safe 0 -i "$concat_list" "$output_path" >/dev/null 2>&1; then
    rm -rf "$tmp_dir"
    return 1
  fi

  rm -rf "$tmp_dir"
  return 0
}

if [ -n "$profiles_file_arg" ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    note="missing-python3-for-profiles"
    echo "python3 is required to load profile bundle: $profiles_file_arg" >&2
    exit 1
  fi
  load_profile_maps
fi

if ! command -v edge-tts >/dev/null 2>&1 && ! command -v espeak-ng >/dev/null 2>&1; then
  note="missing-tts-engine"
  echo "No TTS engine found (edge-tts/espeak-ng). Run whisper/install.sh first."
  exit 1
fi

mkdir -p "$(dirname "$output_file")"
if command -v edge-tts >/dev/null 2>&1; then
  voice_default="${WHISPER_TTS_VOICE:-${WHISPER_TTS_VOICE_DEFAULT:-en-US-AriaNeural}}"
  voice_narrator="${WHISPER_TTS_VOICE_NARRATOR:-$voice_default}"
  voice_maria="${WHISPER_TTS_VOICE_MARIA:-$voice_default}"
  voice_robert="${WHISPER_TTS_VOICE_ROBERT:-$voice_default}"
  rate="${WHISPER_TTS_RATE:-${WHISPER_TTS_RATE_DEFAULT:-+0%}}"
  pitch="${WHISPER_TTS_PITCH:-${WHISPER_TTS_PITCH_DEFAULT:-+0Hz}}"
  rate_narrator="${WHISPER_TTS_RATE_NARRATOR:-$rate}"
  rate_maria="${WHISPER_TTS_RATE_MARIA:-$rate}"
  rate_robert="${WHISPER_TTS_RATE_ROBERT:-$rate}"
  pitch_narrator="${WHISPER_TTS_PITCH_NARRATOR:-$pitch}"
  pitch_maria="${WHISPER_TTS_PITCH_MARIA:-$pitch}"
  pitch_robert="${WHISPER_TTS_PITCH_ROBERT:-$pitch}"

  tts_ok=0
  if [ "$feature_multi_voice" = "1" ]; then
    tmp_dir="$(mktemp -d)"
    parsed_tsv="$tmp_dir/parsed.tsv"
    concat_list="$tmp_dir/concat.txt"
    text_file="$tmp_dir/source.txt"
    printf "%s\n" "$text" > "$text_file"
    if [ -n "$parser_input_file" ] && [ -f "$dialog_parser_py" ] && command -v python3 >/dev/null 2>&1; then
      if python3 "$dialog_parser_py" --input "$parser_input_file" --segments-out "$parsed_tsv" --directives-out "$directive_log" >>"$err_log" 2>&1; then
        note="parsed-dialog-markdown"
      fi
    fi
    if [ -z "$profiles_file_arg" ] && [ -n "$parser_input_file" ] && [ -f "$parser_py" ] && command -v python3 >/dev/null 2>&1; then
      parsed_json="$log_dir/sample-text.parsed.json"
      if python3 "$parser_py" --input "$parser_input_file" --json-out "$parsed_json" --segments-out "$parsed_tsv" >>"$err_log" 2>&1; then
        note="parsed-spec-json"
      fi
    fi
    if [ ! -s "$parsed_tsv" ]; then
      write_parsed_tsv_from_text "$text_file" "$parsed_tsv"
      write_script_directives_log "$text_file" "$directive_log"
    fi

    total_lines="$(wc -l < "$parsed_tsv" | tr -d '[:space:]')"
    voice_plan="$tmp_dir/voice-plan.tsv"
    if [ "$preflight_validation" = "1" ]; then
      if ! validate_multivoice_inputs "$parsed_tsv" "$voice_plan"; then
        note="preflight-validation-failed,text=$text_source"
        tts_ok=0
        rm -rf "$tmp_dir"
        exit 1
      fi
      voice_count="$(wc -l < "$voice_plan" | tr -d '[:space:]')"
      echo "Preflight validated ${total_lines:-0} script lines across ${voice_count:-0} voices."
      if ! probe_profile_voices "$voice_plan"; then
        note="preflight-voice-probe-failed,text=$text_source"
        tts_ok=0
        rm -rf "$tmp_dir"
        exit 1
      fi
    fi
    if [ "$validate_only" = "1" ]; then
      note="preflight-validation-only,text=$text_source"
      echo "Validation only. Skipping synthesis."
      rm -rf "$tmp_dir"
      exit 0
    fi
    echo "Synthesizing ${total_lines:-0} script lines..."

    seg_idx=0
    line_idx=0
    while IFS=$'\t' read -r speaker_name utterance; do
      [ -z "${utterance:-}" ] && continue

      if [ "$speaker_name" = "__directive__" ]; then
        directive_ms="$(printf '%s' "$utterance" | sed -n 's/^pause_ms=\([0-9][0-9]*\).*/\1/p')"
        if [ -n "$directive_ms" ]; then
          echo "  [directive] pause=${directive_ms}ms"
          seg_wav="$tmp_dir/seg_${seg_idx}.wav"
          if ! append_silence_segment "$seg_wav" "$directive_ms"; then
            echo "ffmpeg silence generation failed duration_ms=$directive_ms segment=$seg_idx" >> "$err_log"
            tts_ok=0
            break
          fi
          printf "file '%s'\n" "$seg_wav" >> "$concat_list"
          seg_idx=$((seg_idx + 1))
        fi
        continue
      fi
      line_idx=$((line_idx + 1))
      profile_key="$(resolve_profile_key "$speaker_name")"
      seg_speaker="$profile_key"
      if [ -n "$profiles_file_arg" ] && [ "$strict_profiles" = "1" ] && [ -z "${PROFILE_VOICE[$profile_key]:-}" ]; then
        echo "No profile voice configured for speaker=$speaker_name resolved=$profile_key" >> "$err_log"
        tts_ok=0
        break
      fi
      triplet="$(resolve_voice_triplet "$profile_key")"
      IFS=$'	' read -r seg_voice seg_rate seg_pitch <<< "$triplet"
      while IFS= read -r chunk; do
        [ -z "$chunk" ] && continue
        echo "  [${line_idx}/${total_lines}] speaker=${seg_speaker} segment=${seg_idx}"
        seg_mp3="$tmp_dir/seg_${seg_idx}.mp3"
        seg_wav="$tmp_dir/seg_${seg_idx}.wav"
        if retry_edge_tts --voice "$seg_voice" --rate="$seg_rate" --pitch="$seg_pitch" --text "$chunk" --write-media "$seg_mp3"; then
          :
        else
          ec="$?"
          if [ "$ec" = "124" ]; then
            echo "edge-tts timeout for speaker=$seg_speaker segment=$seg_idx" >> "$err_log"
          else
            echo "edge-tts error rc=$ec speaker=$seg_speaker segment=$seg_idx" >> "$err_log"
          fi
          tts_ok=0
          break 2
        fi
        if ! ffmpeg -y -loglevel error -i "$seg_mp3" "$seg_wav" >/dev/null 2>&1; then
          echo "ffmpeg conversion failed for speaker=$seg_speaker segment=$seg_idx" >> "$err_log"
          tts_ok=0
          break 2
        fi
        printf "file '%s'\n" "$seg_wav" >> "$concat_list"
        seg_idx=$((seg_idx + 1))
        tts_ok=1
      done < <(split_utterance "$utterance" 220)
    done < "$parsed_tsv"

    if [ "$tts_ok" -eq 1 ] && [ -s "$concat_list" ] && \
       ffmpeg -y -loglevel error -f concat -safe 0 -i "$concat_list" "$output_file" >/dev/null 2>&1; then
      note="edge-tts-multivoice,text=$text_source"
    else
      tts_ok=0
    fi

    rm -rf "$tmp_dir"
  else
    tmp_mp3="$(mktemp --suffix=.mp3)"
    if run_edge_tts --voice "$voice_default" --rate="$rate" --pitch="$pitch" --text "$text" --write-media "$tmp_mp3" && \
       ffmpeg -y -loglevel error -i "$tmp_mp3" "$output_file" >/dev/null 2>&1; then
      tts_ok=1
      note="edge-tts,text=$text_source"
    else
      tts_ok=0
      note="edge-tts-failed"
    fi
    rm -f "$tmp_mp3"
  fi

  if [ "$tts_ok" -eq 1 ]; then
    :
  else
    note="edge-tts-failed"
    if [ -f "$err_log" ] && tail -n 5 "$err_log" | grep -q "timeout for speaker"; then
      echo "edge-tts timed out. Check internet/proxy and consider increasing WHISPER_TTS_TIMEOUT_SEC."
    fi
    if [ "$require_neural" != "0" ]; then
      echo "edge-tts generation failed and WHISPER_REQUIRE_NEURAL=1."
      echo "Neural voice required; aborting instead of robotic fallback."
      exit 1
    fi
    echo "edge-tts generation failed; falling back to espeak-ng."
    if [ "$feature_multi_voice" = "1" ] && command -v ffmpeg >/dev/null 2>&1 && synthesize_espeak_multivoice "$text" "$output_file"; then
      note="espeak-ng-multivoice-fallback,text=$text_source"
    else
      clean_text="$(sanitize_script_text "$text")"
      espeak-ng -s 155 -p 42 -a 140 -w "$output_file" "$clean_text"
      note="espeak-ng-fallback,text=$text_source"
    fi
  fi
else
  if [ "$require_neural" != "0" ]; then
    note="missing-edge-tts"
    echo "edge-tts not found and WHISPER_REQUIRE_NEURAL=1."
    echo "Install edge-tts first (rerun whisper/install.sh)."
    exit 1
  fi
  clean_text="$(sanitize_script_text "$text")"
  espeak-ng -s 155 -p 42 -a 140 -w "$output_file" "$clean_text"
  note="espeak-ng-fallback,text=$text_source"
fi

echo "Audio file created: $output_file"

autoplay="${WHISPER_AUTOPLAY:-${WHISPER_FEATURE_AUTOPLAY:-1}}"
if [ "$autoplay" != "0" ]; then
  if ! "$script_dir/play-audio.sh" "$output_file"; then
    note="audio-generated-playback-skipped"
    echo "Audio playback skipped/failed in this environment."
  fi
fi
