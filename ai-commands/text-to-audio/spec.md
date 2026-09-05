# text-to-audio Spec

## Purpose

Define text-to-audio behavior for multimedia projects using the existing TTS/local synthesis path.

## Rules

- Treat `text-to-audio` as the visible multimedia command name for narration/audio generation from text.
- Prefer `tts.command.sh` for current command-system synthesis.
- Do not route songs through `text-to-audio`; songs use lyrics/styles/spec artifacts and music-generation flows.
- Future drivers, including ElevenLabs, should be configured behind this command boundary rather than added as
unrelated multimedia behavior.

## UI Behavior

- When `text-to-audio` is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
