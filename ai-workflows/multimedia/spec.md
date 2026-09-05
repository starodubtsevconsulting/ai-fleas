# Multimedia Workflow Spec

## Purpose

Shape the AI UI and command context for multimedia projects, starting with channel/project work such as Poems.

## Rules

- Show multimedia-specific commands in the Command panel instead of generic operational commands.
- Keep project context, command context, and workflow context selectable in the Spec panel.
- Prefer project specs when a project is selected, command specs when a command is selected, and workflow specs when
the workflow is selected.
- Do not use `tts` or `audio-report` for songs; songs use lyrics/styles/spec artifacts and music-generation flows.
- Use `text-to-audio` for narration/audio generation from text files such as scripts.
- Use the reusable `ai-commands/kdenlive` command to scaffold and validate Kdenlive projects. The workflow supplies
media assets and presents results; it must not own Kdenlive XML or template rules.

## Video Folder Structure

- A multimedia channel is organized as project -> group -> video.
- A group folder represents a creator, series, album, audiobook, or similar collection such as `John Keats`.
- A video folder is the production unit for one publishable video.
- Folder metadata should use `meta.yml` with `type: group` or `type: video`; `meta.yaml` is also accepted and
`meta.json` is retained only as compatibility fallback.
- Every video folder must include `spec.md` explaining the video concept, constraints, and production rules.
- Every video folder must include `audio/` with at least one `.mp3` or `.wav` file.
- Audio file names should use version suffixes such as `audio-v1.mp3`, `narration-v2.wav`, or equivalent `-vN` endings.
- Every video folder must include `scene/` for source scene assets.
- `scene/` should contain PNG scene images or video assets used to assemble the video.
- Cover assets should live under `scene/cover/` when available.
- Thumbnail assets should live under `scene/thumbnail/` when available.
- Lyrics/script text must be present as either `lyrics.md` at the video root or `lyrics/lyrics.md`.
- `youtube-description.md` must exist at the video root and contain the YouTube title and description.
- A `.kdenlive` project file must exist at the video root while Kdenlive is the editing tool.
- Final release output must be versioned as `out/released-vN.mp4`, for example `out/released-v1.mp4`.

## Video Release Pipeline

The backend domain vocabulary calls this ordered checklist the video release pipeline. The workflow center visualizes
the pipeline for every detected video folder:

1. Lyrics or script markdown.
2. Versioned audio in `audio/`.
3. Scene assets in `scene/`.
4. Thumbnail assets in `scene/thumbnail/`.
5. `youtube-description.md` with title and description.
6. Kdenlive project file.
7. Released video as `out/released-vN.mp4`.

## Validation

- The workflow center exposes `Validate Structure` for multimedia projects.
- The workflow center filters by group first, then by video; choosing `all videos` shows the whole selected group.
- Validation errors block a folder from being considered structurally valid.
- Missing video `spec.md`, `audio/`, `scene/`, lyrics markdown, audio files, thumbnail, `youtube-description.md`,
`.kdenlive`, or `out/released-vN.mp4` are errors.
- Missing cover, PNG scene images, or version suffixes are warnings unless promoted later.
- Validation results must be visible in the central workflow panel with error/warning detail paths.

## UI Behavior

- Selecting this workflow can show this workflow spec in the Spec panel when no project or command spec is selected afterward.
- Clicking a project, command, or workflow changes the displayed Spec panel context to that selected item.
- Clicking the Spec panel title opens the currently displayed spec in the central dialog.
