# text-to-audio.command

## Tags

#command #ai-command #multimedia #tts #text-to-audio #audio

Convert text/script markdown into spoken audio using the existing configured TTS path. This command is the
multimedia-facing command name for text-to-audio work; it does not add a new engine yet.

## Current Drivers

- Primary command: `ai-commands/tts/tts.command.md`
- Direct synthesis helper: `ai-commands/install/whisper/text-to-audio.sh`
- Voice report wrapper: `ai-commands/voice-report/voice-report.command.md`

## Usage

```bash
./ai-commands/tts/tts.command.sh --text "Hello world"
./ai-commands/tts/tts.command.sh --text-file path/to/script.md --output /tmp/out.wav --no-autoplay
./ai-commands/install/whisper/text-to-audio.sh "Hello world" /tmp/out.wav
```

## Behavior

- Use this command intent for multimedia project files such as `script.md`, `lyrics.md` alternatives that are intended
for narration, or other text files that should become audio.
- For songs, do not use `tts`/`audio-report`; songs should remain lyrics/styles/spec artifacts and music-generation flows.
- Prefer `tts.command.sh` when working inside the AI command system.
- Use `install/whisper/text-to-audio.sh` only when direct local legacy text-to-audio behavior is needed.
- Future driver work can add ElevenLabs and other engines behind this command boundary.

## References

- `ai-commands/tts/tts.command.md`
- `ai-commands/install/whisper/text-to-audio.sh`
- `ai-commands/voice-report/voice-report.command.md`
