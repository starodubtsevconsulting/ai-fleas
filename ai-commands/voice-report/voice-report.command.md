# voice-report.command

## Tags

#command #voice-report #tts #whisper #summary #audio #finish-flow

Speak the provided progress or completion text using the shared Whisper TTS stack.

## Intent

Use when the user wants spoken playback of the provided wrap-up text after a small win, milestone, or final completion.
Read the full provided text by default; do not shorten it to fit an arbitrary duration unless the user asks for a
shorter version.

## Behavior

- Workflow-facing use must run through `commands/voice-report/app.sh`.
- Use `app.sh --text "..."` or `app.sh --text-file <path>` for spoken progress and completion reports.
- Default report playback uses the bundled female reporter voice (`reporter`, Aria, rose face). Use `--voice-speaker
male-reporter` for the bundled male reporter (Andrew, blue face), or provide `--voice-profile-file <path>` with
explicit `gender` metadata to choose another configured voice.
- The launcher UI lives under `commands/voice-report/launcher/` and is the authoritative playback surface. Do not open
voice reports in a generic browser window.
- `voice-report.command.sh` is an implementation/compatibility wrapper only; do not call it directly from workflow or
done rules. If used internally, it must open the Voice Report launcher through `app.sh`, not a browser-rendered
fallback.
- Accept summary text from `--text` or `--text-file`; stdin callers should first write a temp text file and pass it to `app.sh --text-file`.
- Sanitize obvious secrets before synthesis or playback.
- Autoplay the report through the app launcher. If the launcher cannot open, report that failure instead of presenting
the report in a browser page.
- Voice identity clarity is mandatory: the selected voice profile must declare `gender: male` or `gender: female`;
otherwise the report must not play and the launcher must show an unclear-voice error. Male voices use the blue face,
female voices use the rose face.
- Keep normal Whisper runtime logs, but do not keep per-run report artifacts unless debugging requires it.

## Usage

- `./rules/commands/voice-report/app.sh --text "Finished the channel audio refactor."`
- `./rules/commands/voice-report/app.sh --serve-check`
- `./rules/commands/voice-report/voice-report.command.sh --text "Finished the channel audio refactor. The default
launcher is now a short wrapper."`
- `printf 'Finished the parser update. Tests passed.\n' | ./rules/commands/voice-report/voice-report.command.sh`
- `./rules/commands/voice-report/voice-report.command.sh --text-file /tmp/report.txt`

## Options

- `--text <value>`: inline summary text
- `--text-file <path>`: load summary text from file
- `--no-autoplay`: synthesize without playback, still cleans temp files after generation
- `--keep-temp`: keep temp files for debugging
- `--voice-profile-file <path>`: override the built-in voice profile

## Notes

- `./rules/commands/voice-report/test/audible-test.sh` is the explicit audible-output proof; it must create real sound
and fail if no unmuted OS sink input appears.
- `./rules/commands/voice-report/test/test.sh` verifies the launcher becomes visible, reports playback, and stays alive
after detached launch.
- This command is designed for milestone-level and end-of-task reporting.
- It should not speak passwords, API keys, tokens, secrets, or obvious secret-like material.
- Current integration is workflow-visible: dev flow uses this after small wins/milestones, and done flow requires it at final completion.
- If a workflow says to run `voice-report`, agents must invoke `commands/voice-report/app.sh`, not
`voice-report.command.sh`. The expected visible surface is the Voice Report launcher, not browser `show-context` or
browser fallback output.
