# YouTube workflow

Use this workflow when the intended outcome is a YouTube release: start with lyrics, a script, or narration; create its
audio; create the scene; then prepare and release the finished package.

Each step has a directly addressable Agent. The human can enter or return to a step by mentioning that Agent, for
example `@lyrics-script-worker` or `@scene-worker`. All four Agents follow the
[YouTube team policy](agents/team.md) and reusable [Worker role](../_common/roles/worker.md).

The workflow owns one ordered production flow. Each step creates an approved artifact for the next step. When a step
completes successfully, continue to the next applicable step without waiting for additional instruction. A step cannot
start until the required artifact from the previous step exists.

## Workflow

| Step | Agent | Assigned flow | Approved output |
| --- | --- | --- | --- |
| 1. Lyrics or script | `@lyrics-script-worker` | [Lyrics or script writing](flows/lyrics-script-writing.md) | Approved text |
| 2. Audio | `@audio-worker` | [Audio production](flows/audio-production.md) | Approved audio |
| 3. Scene | `@scene-worker` | [Scene production](flows/scene-production.md) | Approved scene package |
| 4. Release | `@release-worker` | [Release](flows/release.md) | Ready-to-release package or YouTube reference |

Typical use:

```text
@lyrics-script-worker Create the lyrics or script for this idea: ...
@audio-worker Create the audio from the approved lyrics or script.
@scene-worker Create the cover and video for the approved audio.
@release-worker Prepare the YouTube release package.
```

Each flow owns its purpose, ordered work, Commands, validation, and output. The Agent binding supplies only the Worker
identity, assigned flow, and profile-owned provider binding. Missing Commands remain explicit rather than being replaced
with inferred tools or hidden platform behavior.

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
