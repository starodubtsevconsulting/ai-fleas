# Scene production flow

Executed by `@scene-worker`.

## Purpose

Create the visual result required by the selected format and combine it with the approved audio when the result is a
video.

## Flow

1. Read the approved text, audio, timing data, and visual direction.
2. Determine whether the result needs a picture, cover, video, or a combination of them.
3. Create the required visual assets.
4. Assemble audio and visuals when video is required.
5. Validate dimensions, duration, synchronization, readability, and required format.
6. Revise until approved, returning upstream changes to the Worker that owns the affected artifact.
7. Deliver the approved scene package to the Release flow.

## Commands

- [`kdenlive`](../../../ai-commands/kdenlive/)
- [`video-handwriting-effect`](../../../ai-commands/video-handwriting-effect/) when the selected visual treatment requires it

## Output

Approved picture, cover, video, or combined scene package.
