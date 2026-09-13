# YouTube workflow

Use this workflow for explicitly requested work that creates and releases content for a YouTube channel. Its four
step-specific Agents follow the [YouTube team policy](agents/team.md) and reusable
[Worker role](../_common/roles/worker.md).

The workflow owns one ordered production flow. Each step creates an approved artifact for the next step. When a step
completes successfully, continue to the next applicable step without waiting for additional instruction. A step cannot
start until the required artifact from the previous step exists.

## Workflow

1. **Lyrics or script** — create and approve the lyrics, spoken script, or narration.
2. **Audio** — create and approve the song, voice recording, or other final audio from the approved text.
3. **Scene** — create and approve the picture, cover, video, or combination required by the selected format. Assemble
   the approved audio and visuals when the result is a video.
4. **Release** — prepare the title, description, thumbnail or cover, and final YouTube package. Release it only with
   explicit human authorization.

Each step performs the validation required for its own output before approval. Validation is part of the step rather
than a separate top-level flow. A step may use multiple Commands, and the selected format determines which Commands are
applicable.

## Command routing

| Step | Purpose | Connected Commands |
| --- | --- | --- |
| Lyrics or script | Draft, revise, and preserve the intended voice | [`writing`](../../ai-commands/writing/) |
| Audio | Create voice audio and prepare timing data where applicable | [`tts`](../../ai-commands/tts/), [`lyrics-timestamp`](../../ai-commands/lyrics-timestamp/) |
| Scene | Create or assemble the picture, cover, and video | [`kdenlive`](../../ai-commands/kdenlive/), [`video-handwriting-effect`](../../ai-commands/video-handwriting-effect/) |
| Release | Prepare release metadata and perform an explicitly authorized publication | `youtube-release` (planned) |

The workflow composes Commands and does not embed their implementations. Missing Commands remain explicit rather than
being replaced with inferred tools or hidden platform behavior.

## Model routing

The selected profile may assign a preferred creative model to the Lyrics or script step and may use a different model
for orchestration or validation. Model and provider selection remain profile configuration; this portable workflow
defines the capability required by the step, not a specific model or endpoint.

## Required behavior

- Preserve the creator's message, voice, accepted text, approved audio, and approved visual direction across steps.
- Do not silently change an artifact already approved by an earlier step. Return to that step when a material change is
  required.
- Treat generated media as a candidate until its step-specific validation and approval are complete.
- Keep channel identity, audience, provider selection, model selection, destinations, and credentials in the selected
  profile rather than this public workflow.
- Never upload, publish, schedule, replace, or remove YouTube content without explicit human authorization for that
  release action.

## Outcome

The completed workflow produces an approved YouTube package and, only when explicitly authorized, its resulting YouTube
reference.
