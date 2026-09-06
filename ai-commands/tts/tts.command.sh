#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "tts" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT_DIR/ai-config}"
source "$SCRIPT_DIR/../runtime-paths.sh"
COMPILE_PROMPT_MD="$SCRIPT_DIR/prompts/compile-post.prompt.md"
VOICE_PROFILES_DIR="$SCRIPT_DIR/voice-profiles"
OUTPUT_DIR="$SCRIPT_DIR/output"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/tts.log"
ERR_LOG="$LOG_DIR/tts.err.log"

# Runtime settings are supplied by the selected profile.
VOICE_DEFAULT='en-US-AriaNeural'
RATE_DEFAULT='+0%'
PITCH_DEFAULT='+0Hz'
VOICE_NARRATOR='en-GB-RyanNeural'
VOICE_MARIA='en-US-JennyNeural'
VOICE_ROBERT='en-US-ChristopherNeural'
RATE_NARRATOR='-12%'
RATE_MARIA='+2%'
RATE_ROBERT='-2%'
PITCH_NARRATOR='-2Hz'
PITCH_MARIA='+1Hz'
PITCH_ROBERT='-1Hz'
DEFAULT_UNLABELED_SPEAKER='narrator'

text=''
text_file=''
output=''
autoplay='1'
allow_fallback='0'
timeout_sec='90'
list_profiles='0'
compiled_text_out=''
input_is_compiled='0'
compile_mode="${TTS_COMPILE_MODE:-auto}"
compile_model="${TTS_COMPILE_MODEL:-gpt-4o-mini}"
compile_base_url="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
compile_timeout_sec="${TTS_COMPILE_TIMEOUT_SEC:-45}"

ai_api_key="${OPENAI_API_KEY:-}"

trim_value() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

resolve_session_output_dir() {
  local pointer_file plan_path session_dir
  if declare -F ai_current_plan_pointer_path >/dev/null 2>&1; then
    pointer_file="$(ai_current_plan_pointer_path "$APP_ROOT")"
  else
    pointer_file="$APP_ROOT/session-root/.current-plan-path"
  fi
  if [ ! -f "$pointer_file" ]; then
    return 1
  fi
  plan_path="$(tr -d "\r" < "$pointer_file" | head -n1 | xargs)"
  if [ -z "$plan_path" ] || [ ! -f "$plan_path" ]; then
    return 1
  fi

  case "$plan_path" in
    */plan.md)
      session_dir="$(dirname "$plan_path")"
      printf "%s/output/tts\n" "$session_dir"
      ;;
    *)
      return 1
      ;;
  esac
}
load_profile_values() {
  local profiles_dir="$1"
  if [ ! -d "$profiles_dir" ] || ! command_python_bootstrap >/dev/null 2>&1; then
    return 0
  fi

  while IFS='|' read -r speaker field value; do
    speaker="$(trim_value "$speaker")"
    field="$(trim_value "$field")"
    value="$(trim_value "$value")"
    [ -n "$speaker" ] || continue
    [ -n "$field" ] || continue
    [ -n "$value" ] || continue

    case "$speaker:$field" in
      narrator:voice) VOICE_NARRATOR="$value" ;;
      narrator:rate) RATE_NARRATOR="$value" ;;
      narrator:pitch) PITCH_NARRATOR="$value" ;;
      maria:voice) VOICE_MARIA="$value" ;;
      maria:rate) RATE_MARIA="$value" ;;
      maria:pitch) PITCH_MARIA="$value" ;;
      robert:voice) VOICE_ROBERT="$value" ;;
      robert:rate) RATE_ROBERT="$value" ;;
      robert:pitch) PITCH_ROBERT="$value" ;;
    esac
  done < <(command_python - "$profiles_dir" <<'PY'
import json
import sys
from pathlib import Path

profiles_dir = Path(sys.argv[1])
for stem in ("narrator", "maria", "robert"):
    path = profiles_dir / f"{stem}.json"
    if not path.exists():
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    for key in ("voice", "rate", "pitch"):
        value = str(data.get(key, "")).strip()
        if value:
            print(f"{stem}|{key}|{value}")
PY
)
}

write_parsed_tsv_from_text() {
  local text_file_path="$1"
  local parsed_tsv_path="$2"
  awk '
    BEGIN {
      speaker="narrator"
      pending=""
      default_speaker=tolower("'"$DEFAULT_UNLABELED_SPEAKER"'")
    }
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    function norm(s, x) {
      x=tolower(trim(s))
      if (x ~ /^narr+a?t+o?r$/) return "narrator"
      if (x == "robot") return "robert"
      return x
    }
    {
      line=$0
      gsub(/\r$/, "", line)
      t=trim(line)
      if (t=="" || t=="---") next
      if (t ~ /^\[[^]]+\]$/) {
        low=tolower(t)
        if (low ~ /narrator/ || low ~ /narator/ || low ~ /narraror/) {
          speaker="narrator"
          pending=""
        }
        next
      }
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ \t]*\[[^]]+\][ \t]*$/) {
        sp=t
        sub(/:.*/, "", sp)
        pending=norm(sp)
        next
      }
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ \t]*$/) {
        sp=t
        sub(/:.*/, "", sp)
        pending=norm(sp)
        next
      }
      if (t ~ /^[A-Za-z][A-Za-z _-]*:[ \t]*/) {
        sp=t
        sub(/:.*/, "", sp)
        speaker=norm(sp)
        pending=""
        textline=t
        sub(/^[A-Za-z][A-Za-z _-]*:[ \t]*/, "", textline)
        textline=trim(textline)
        gsub(/[ \t]+/, " ", textline)
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
      gsub(/[ \t]+/, " ", textline)
      printf "%s\t%s\n", speaker, textline
    }
  ' "$text_file_path" > "$parsed_tsv_path"
}

split_utterance() {
  local text_in="$1"
  local max_chars="${2:-220}"
  command_python - "$text_in" "$max_chars" <<'PY'
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
        current = p
if current:
    chunks.append(current)

for c in chunks:
    print(c)
PY
}

run_edge_tts() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "${timeout_sec}s" edge-tts "$@" >>"$ERR_LOG" 2>&1
  else
    edge-tts "$@" >>"$ERR_LOG" 2>&1
  fi
}

voice_for_speaker() {
  case "$1" in
    narrator) printf '%s|%s|%s\n' "$VOICE_NARRATOR" "$RATE_NARRATOR" "$PITCH_NARRATOR" ;;
    maria) printf '%s|%s|%s\n' "$VOICE_MARIA" "$RATE_MARIA" "$PITCH_MARIA" ;;
    robert) printf '%s|%s|%s\n' "$VOICE_ROBERT" "$RATE_ROBERT" "$PITCH_ROBERT" ;;
    *) printf '%s|%s|%s\n' "$VOICE_DEFAULT" "$RATE_DEFAULT" "$PITCH_DEFAULT" ;;
  esac
}

synthesize_edge_multivoice() {
  local parsed_tsv="$1"
  local output_path="$2"
  local tmp_dir concat_list line_idx total_lines seg_idx speaker_name utterance seg_speaker seg_voice seg_rate seg_pitch seg_mp3 seg_wav chunk voice_tuple

  tmp_dir="$(mktemp -d)"
  concat_list="$tmp_dir/concat.txt"
  line_idx=0
  seg_idx=0
  total_lines="$(wc -l < "$parsed_tsv" | tr -d '[:space:]')"

  while IFS=$'\t' read -r speaker_name utterance; do
    [ -z "${utterance:-}" ] && continue
    line_idx=$((line_idx + 1))
    seg_speaker="$(printf "%s" "$speaker_name" | tr '[:upper:]' '[:lower:]' | xargs)"
    case "$seg_speaker" in
      robot) seg_speaker='robert' ;;
      narator|narraror|narratorr) seg_speaker='narrator' ;;
    esac

    voice_tuple="$(voice_for_speaker "$seg_speaker")"
    IFS='|' read -r seg_voice seg_rate seg_pitch <<< "$voice_tuple"

    while IFS= read -r chunk; do
      [ -z "$chunk" ] && continue
      printf '  [%s/%s] speaker=%s segment=%s\n' "$line_idx" "$total_lines" "$seg_speaker" "$seg_idx"
      seg_mp3="$tmp_dir/seg_${seg_idx}.mp3"
      seg_wav="$tmp_dir/seg_${seg_idx}.wav"
      edge_ok='0'
      for attempt in 1 2; do
        if run_edge_tts --voice "$seg_voice" --rate="$seg_rate" --pitch="$seg_pitch" --text "$chunk" --write-media "$seg_mp3"; then
          edge_ok='1'
          break
        else
          rc="$?"
          printf '%s edge-tts failed rc=%s attempt=%s speaker=%s segment=%s timeout=%ss\n' \
            "$(date +%Y-%m-%dT%H:%M:%S%z)" "$rc" "$attempt" "$seg_speaker" "$seg_idx" "$timeout_sec" >> "$ERR_LOG"
          sleep 1
        fi
      done
      if [ "$edge_ok" != '1' ]; then
        rm -rf "$tmp_dir"
        return 1
      fi
      if ! ffmpeg -y -loglevel error -i "$seg_mp3" "$seg_wav" >/dev/null 2>&1; then
        rm -rf "$tmp_dir"
        return 1
      fi
      printf "file '%s'\n" "$seg_wav" >> "$concat_list"
      seg_idx=$((seg_idx + 1))
    done < <(split_utterance "$utterance" 220)
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

synthesize_espeak_multivoice() {
  local parsed_tsv="$1"
  local output_path="$2"
  local tmp_dir concat_list seg_idx speaker_name utterance seg_speaker seg_wav seg_speed seg_pitch seg_amp

  tmp_dir="$(mktemp -d)"
  concat_list="$tmp_dir/concat.txt"
  seg_idx=0

  while IFS=$'\t' read -r speaker_name utterance; do
    [ -z "${utterance:-}" ] && continue
    seg_speaker="$(printf "%s" "$speaker_name" | tr '[:upper:]' '[:lower:]' | xargs)"
    case "$seg_speaker" in
      robot) seg_speaker='robert' ;;
      narator|narraror|narratorr) seg_speaker='narrator' ;;
    esac

    seg_speed=155
    seg_pitch=42
    seg_amp=140
    case "$seg_speaker" in
      narrator) seg_speed=150; seg_pitch=38; seg_amp=145 ;;
      maria) seg_speed=170; seg_pitch=58; seg_amp=140 ;;
      robert) seg_speed=155; seg_pitch=42; seg_amp=145 ;;
    esac

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

play_audio() {
  local audio_file="$1"
  if command -v ffplay >/dev/null 2>&1; then
    ffplay -nodisp -autoexit "$audio_file" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v aplay >/dev/null 2>&1; then
    aplay "$audio_file" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v paplay >/dev/null 2>&1; then
    paplay "$audio_file" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v afplay >/dev/null 2>&1; then
    afplay "$audio_file" >/dev/null 2>&1 || true
    return 0
  fi
  return 1
}

compile_post_with_ai() {
  local input_path="$1"
  local output_path="$2"
  local prompt_text raw_text payload response content tmp_content normalized_content tmp_output

  if [ ! -f "$COMPILE_PROMPT_MD" ]; then
    echo "Missing compile prompt file: $COMPILE_PROMPT_MD" >&2
    return 1
  fi
  if [ -z "$ai_api_key" ]; then
    echo "OPENAI_API_KEY is required for AI post compilation." >&2
    return 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "Missing required command for AI compile: curl" >&2
    return 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "Missing required command for AI compile: jq" >&2
    return 1
  fi

  prompt_text="$(cat "$COMPILE_PROMPT_MD")"
  raw_text="$(cat "$input_path")"
  payload="$(jq -n \
    --arg model "$compile_model" \
    --arg system "$prompt_text" \
    --arg user "$raw_text" \
    '{
      model: $model,
      temperature: 0,
      messages: [
        { role: "system", content: $system },
        { role: "user", content: $user }
      ]
    }')"

  if ! response="$(curl -sS --max-time "$compile_timeout_sec" \
      -H "Authorization: Bearer $ai_api_key" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "${compile_base_url%/}/chat/completions" 2>>"$ERR_LOG")"; then
    echo "AI compile request failed (network/API)." >&2
    return 1
  fi

  content="$(printf '%s' "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null || true)"
  if [ -z "$content" ]; then
    api_error="$(printf '%s' "$response" | jq -r '.error.message // empty' 2>/dev/null || true)"
    if [ -n "${api_error:-}" ]; then
      echo "AI compile API error: $api_error" >&2
    else
      echo "AI compile failed: empty model response." >&2
    fi
    return 1
  fi

  tmp_content="$(mktemp)"
  printf '%s\n' "$content" > "$tmp_content"
  normalized_content="$(sed -e 's/\r$//' "$tmp_content")"
  rm -f "$tmp_content"

  if printf '%s\n' "$normalized_content" | grep -q '^```'; then
    normalized_content="$(printf '%s\n' "$normalized_content" \
      | sed '/^```[a-zA-Z0-9_-]*$/d;/^```$/d')"
  fi

  tmp_output="$(mktemp)"
  printf '%s\n' "$normalized_content" \
    | sed -e 's/\r$//' -e '/^[[:space:]]*$/d' > "$tmp_output"

  if [ ! -s "$tmp_output" ]; then
    rm -f "$tmp_output"
    echo "AI compile failed: produced empty compiled script." >&2
    return 1
  fi

  invalid_lines="$(awk '!/^[A-Za-z][A-Za-z0-9 _-]{0,40}:[[:space:]].+/ {print NR":"$0}' "$tmp_output")"
  if [ -n "$invalid_lines" ]; then
    rm -f "$tmp_output"
    echo "AI compile output invalid; expected 'Speaker: text' per line." >&2
    return 1
  fi

  mkdir -p "$(dirname "$output_path")"
  mv "$tmp_output" "$output_path"
  return 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --text)
      text="${2:-}"
      shift 2
      ;;
    --text-file)
      text_file="${2:-}"
      shift 2
      ;;
    --output)
      output="${2:-}"
      shift 2
      ;;
    --no-autoplay)
      autoplay='0'
      shift
      ;;
    --allow-fallback)
      allow_fallback='1'
      shift
      ;;
    --timeout)
      timeout_sec="${2:-}"
      shift 2
      ;;
    --voice-profiles-dir)
      VOICE_PROFILES_DIR="${2:-}"
      shift 2
      ;;
    --list-voice-profiles)
      list_profiles='1'
      shift
      ;;
    --compiled-text-out)
      compiled_text_out="${2:-}"
      shift 2
      ;;
    --input-is-compiled)
      input_is_compiled='1'
      shift
      ;;
    --compile-model)
      compile_model="${2:-}"
      shift 2
      ;;
    --compile-mode)
      compile_mode="${2:-}"
      shift 2
      ;;
    --compile-base-url)
      compile_base_url="${2:-}"
      shift 2
      ;;
    --compile-timeout)
      compile_timeout_sec="${2:-}"
      shift 2
      ;;
    -h|--help)
      cat <<'USAGE'
Usage:
  tts.command.sh [options]

Options:
  --text <value>              Inline text/script
  --text-file <path>          Read text/script from file
  --output <path>             Output WAV path
  --no-autoplay               Disable immediate playback
  --allow-fallback            Allow espeak fallback when neural TTS fails
  --timeout <sec>             Timeout in seconds for each edge-tts segment (default 90)
  --voice-profiles-dir <dir>  Directory with narrator.json/maria.json/robert.json
  --list-voice-profiles       List available JSON voice profiles
  --compiled-text-out <path>  Write compiled speaker script to this path
  --input-is-compiled         Skip AI compile step; treat --text-file as speaker-labeled script
  --compile-mode <mode>       Compile mode: auto|ai (default: env TTS_COMPILE_MODE or auto)
  --compile-model <model>     Override compile model (default: env TTS_COMPILE_MODEL or gpt-4o-mini)
  --compile-base-url <url>    Override compile API base URL (default: OPENAI_BASE_URL or api.openai.com/v1)
  --compile-timeout <sec>     Timeout for compile API request (default: env TTS_COMPILE_TIMEOUT_SEC or 45)
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

case "$compile_mode" in
  auto|ai) ;;
  *)
    echo "Invalid --compile-mode: $compile_mode (expected auto|ai)" >&2
    exit 2
    ;;
esac

if [ -n "$text" ] && [ -n "$text_file" ]; then
  echo "Use either --text or --text-file, not both." >&2
  exit 2
fi

if [ "$list_profiles" = '1' ]; then
  if [ ! -d "$VOICE_PROFILES_DIR" ]; then
    echo "No voice-profiles directory: $VOICE_PROFILES_DIR"
    exit 0
  fi
  find "$VOICE_PROFILES_DIR" -maxdepth 1 -type f -name '*.json' -printf '%f\n' | sed 's/\.json$//' | sort
  exit 0
fi

if [ -n "$text_file" ] && [ ! -f "$text_file" ]; then
  echo "Text file not found: $text_file" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Missing required command: ffmpeg" >&2
  exit 1
fi

load_profile_values "$VOICE_PROFILES_DIR"
mkdir -p "$LOG_DIR"

if [ -z "$output" ]; then
  if session_output_dir="$(resolve_session_output_dir || true)" && [ -n "$session_output_dir" ]; then
    OUTPUT_DIR="$session_output_dir"
  fi
  mkdir -p "$OUTPUT_DIR"
  if [ -n "$text_file" ]; then
    input_name="$(basename "$text_file")"
    input_stem="${input_name%.*}"
    output="$OUTPUT_DIR/${input_stem}.wav"
  else
    output="$OUTPUT_DIR/output.wav"
  fi
else
  mkdir -p "$(dirname "$output")"
fi

if [ -n "$text_file" ] && [ "$input_is_compiled" != '1' ]; then
  if [ -z "$compiled_text_out" ]; then
    input_name="$(basename "$text_file")"
    input_stem="${input_name%.*}"
    compiled_text_out="$OUTPUT_DIR/${input_stem}-compiled.txt"
  fi
  compile_ok='0'
  case "$compile_mode" in
    ai)
      if compile_post_with_ai "$text_file" "$compiled_text_out"; then
        compile_ok='1'
      fi
      ;;
    auto)
      if [ -n "$ai_api_key" ] && compile_post_with_ai "$text_file" "$compiled_text_out"; then
        compile_ok='1'
      else
        echo "Compile mode auto: OPENAI_API_KEY missing or AI compile failed; using raw input directly."
      fi
      ;;
  esac
  if [ "$compile_ok" = '1' ]; then
    echo "Compiled speaker script: $compiled_text_out"
    text_file="$compiled_text_out"
  elif [ "$compile_mode" = 'ai' ]; then
    echo "Compile step failed for mode=$compile_mode." >&2
    exit 1
  fi
fi

if [ -n "$text_file" ]; then
  source_text="$(cat "$text_file")"
elif [ -n "$text" ]; then
  source_text="$text"
else
  source_text='Whisper installation check sample text.'
fi

tmp_dir="$(mktemp -d)"
parsed_tsv="$tmp_dir/parsed.tsv"
source_txt="$tmp_dir/source.txt"
printf '%s\n' "$source_text" > "$source_txt"
write_parsed_tsv_from_text "$source_txt" "$parsed_tsv"

note=''
if command -v edge-tts >/dev/null 2>&1; then
  if synthesize_edge_multivoice "$parsed_tsv" "$output"; then
    note='edge-tts-multivoice'
  else
    if [ "$allow_fallback" = '1' ] && command -v espeak-ng >/dev/null 2>&1; then
      echo "edge-tts generation failed; falling back to espeak-ng."
      if synthesize_espeak_multivoice "$parsed_tsv" "$output"; then
        note='espeak-ng-multivoice-fallback'
      else
        rm -rf "$tmp_dir"
        echo "Fallback espeak-ng generation failed." >&2
        exit 1
      fi
    else
      rm -rf "$tmp_dir"
      echo "edge-tts generation failed and fallback is disabled/unavailable." >&2
      exit 1
    fi
  fi
else
  if [ "$allow_fallback" = '1' ] && command -v espeak-ng >/dev/null 2>&1; then
    if synthesize_espeak_multivoice "$parsed_tsv" "$output"; then
      note='espeak-ng-multivoice-fallback'
    else
      rm -rf "$tmp_dir"
      echo "Fallback espeak-ng generation failed." >&2
      exit 1
    fi
  else
    rm -rf "$tmp_dir"
    echo "edge-tts not found and fallback disabled/unavailable." >&2
    exit 1
  fi
fi

rm -rf "$tmp_dir"
printf '%s %s output=%s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$note" "$output" >> "$LOG_FILE"
echo "Audio file created: $output"

autoplay="${autoplay:-1}"
if [ "$autoplay" != '0' ]; then
  play_audio "$output" || true
fi
