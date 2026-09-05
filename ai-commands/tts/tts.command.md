# tts.command

## Tags

#command #ai-command #tts #text-to-speech #whisper #speech

Convert text/script to audio via standalone TTS execution (`edge-tts` primary, `espeak-ng` fallback if enabled).

## Intent Aliases

- Treat `audio-report` as an alias of `tts`.
- Use this alias when the user or workflow expects spoken progress/final reporting rather than generic text-to-speech phrasing.
- This command is for narration/story/report audio, not for song generation; songs should not be routed through `tts`.

## Intent

Use when the user asks to generate audio from text, script, story, or sample file.

## Codex Session Mode (No API Key)

- When `OPENAI_API_KEY` is missing and the request is handled by Codex in the current AI session, do not rely on
shell/API compile for raw input.
- Instead, compile raw text in-session by following `rules/commands/tts/prompts/compile-post.prompt.md` directly.
- Write the compiled result to the active session output path:
  - `session-root/<profile>/<session-id>/output/tts/<input-stem>-compiled.txt`
- Then run `tts.command.sh` only for synthesis with:
  - `--text-file <compiled-path> --input-is-compiled`
- This keeps compile quality tied to prompt instructions and the current AI session model, without external API keys.

## Usage

- `./rules/commands/tts/tts.command.sh`
- `./rules/commands/tts/tts.command.sh --text "Hello world"`
- `./rules/commands/tts/tts.command.sh --text-file rules/commands/tts/test/fixtures/post-ufo.source.md`
- `./rules/commands/tts/tts.command.sh --text-file path/to/script.txt --output /tmp/out.wav --no-autoplay`
- `./rules/commands/tts/tts.command.sh --text-file rules/commands/tts/test/fixtures/post-ufo.source.md
--compiled-text-out /tmp/post-compiled.txt`
- `./rules/commands/tts/tts.command.sh --text-file rules/commands/tts/test/fixtures/post-ufo.expected.md --input-is-compiled`
- `./rules/commands/tts/tts.command.sh --list-voice-profiles`
- `./rules/commands/tts/test/test.sh`

## Options

- `--text <value>`: inline text/script to synthesize
- `--text-file <path>`: load text/script from file
- `--output <path>`: output WAV path (optional override)
- `--no-autoplay`: disable immediate playback for this run
- `--allow-fallback`: allow `espeak-ng` fallback (`WHISPER_REQUIRE_NEURAL=0`)
- `--timeout <sec>`: override `WHISPER_TTS_TIMEOUT_SEC` for this run
- `--voice-profiles-dir <dir>`: directory containing `narrator.json`, `maria.json`, `robert.json`
- `--list-voice-profiles`: print available JSON voice profiles
- `--compiled-text-out <path>`: write the intermediate compiled speaker script
- `--input-is-compiled`: skip AI compile and treat `--text-file` as already speaker-labeled
- `--compile-mode <mode>`: `auto` (default) or `ai`
- `--compile-model <model>`: override compile model (default: `TTS_COMPILE_MODEL` or `gpt-4o-mini`)
- `--compile-base-url <url>`: override compile API base URL (default: `OPENAI_BASE_URL` or `https://api.openai.com/v1`)
- `--compile-timeout <sec>`: override AI compile timeout (default: `TTS_COMPILE_TIMEOUT_SEC` or `45`)

## Raw Input vs Compiled Input

- `--text-file` is expected to be raw text/markdown (for example `test/fixtures/post-ufo.source.md`).
- Before synthesis, the command compiles raw text using AI instructions in `prompts/compile-post.prompt.md` into speaker-labeled lines:
  - `Narrator: ...`
  - `Maria: ...`
  - `Robert: ...`
- This compile step ensures speaker roles map to voice profiles consistently.
- `--compile-mode ai` requires `OPENAI_API_KEY` and fails if compile fails.
- `--compile-mode auto` tries AI compile when key is available; if unavailable/failing, it uses raw input directly (no
non-AI compile transform).
- In Codex Session Mode (no key), prefer in-session compilation and then `--input-is-compiled` synthesis.
- Default compiled path: `rules/commands/tts/output/<input-stem>-compiled.txt`.
- You can override compiled output path with `--compiled-text-out`.
- If your input is already compiled, pass `--input-is-compiled` to skip AI compilation.

Example files:

- Raw example: `rules/commands/tts/test/fixtures/post-ufo.source.md`
- Compiled example: `rules/commands/tts/test/fixtures/post-ufo.expected.md`
- Additional fixture examples (source/expected pairs for prompt quality checks):
`rules/commands/tts/test/fixtures/*.source.md` and `rules/commands/tts/test/fixtures/*.expected.md`

## Voice profiles (JSON)

- Folder: `rules/commands/tts/voice-profiles/`
- Default files:
  - `narrator.json`
  - `maria.json`
  - `robert.json`
- These JSON files define exact voice/rate/pitch values used by the command.
- Profile defaults mirror the same voice settings previously used by `install/whisper/install.config`.

## Output

- Generates WAV audio directly inside `tts.command.sh` (no runtime call to `install/whisper/text-to-audio.sh`).
- For `--text-file`, the command can first compile raw text via AI prompt (`prompts/compile-post.prompt.md`) and then
synthesize from that compiled speaker script.
- If `edge-tts` fails and `--allow-fallback` is enabled, fallback now uses multi-voice `espeak-ng` synthesis
(speaker-separated segments) before final concatenation.
- Prints runtime status and log location.
- Default generated file path: `session-root/<profile>/<session-id>/output/tts/<input-stem>.wav` (from active session
plan pointer when `--text-file` is used).
- If no active session pointer is available, fallback default is `rules/commands/tts/output/output.wav`.
- Session-scoped output keeps generated audio with its owning work session.

## Smoke test

- Sample 3-voice script: `rules/commands/tts/test/sample-three-voices.txt`
- Run: `./rules/commands/tts/test/test.sh`
- Test output: `rules/commands/tts/output/test-output.wav`

## Prerequisite behavior

- Required runtime tools:
  - `ffmpeg`
  - `edge-tts` (or `espeak-ng` when `--allow-fallback` is used)
  - `curl` + `jq` only when AI compile is used
- Required env for AI compile (`--compile-mode ai` or `auto` with AI available):
  - `OPENAI_API_KEY`
- If required tools are missing, command exits with failure.

## Notes

- `TTS` means text-to-speech.
