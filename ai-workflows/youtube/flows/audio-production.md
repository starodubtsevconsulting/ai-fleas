# Audio production flow

Executed by `@audio-worker`.

## Purpose

Turn approved lyrics, a script, or narration into approved final audio.

## Flow

1. Read the approved text and its preserved creative decisions.
2. Select the applicable audio path: song, spoken voice, or another configured format.
3. Produce the audio through connected Commands or profile-authorized services.
4. Validate completeness, intelligibility, timing, and required format.
5. Revise until approved, returning material text changes to `@lyrics-script-worker`.
6. Deliver the approved audio to the Scene flow.

## Commands

- [`tts`](../../../ai-commands/tts/)
- [`lyrics-timestamp`](../../../ai-commands/lyrics-timestamp/) when timing data is required

## Output

Approved final audio and any timing data required by the Scene flow.
