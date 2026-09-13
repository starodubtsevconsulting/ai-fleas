# YouTube workflow team

The team follows the common [Agent contract](../../agents.md), the [YouTube workflow](../youtube.workflow.md), and the
reusable [Worker role](../../_common/roles/worker.md).

## Team

| Agent | Assigned flow |
| --- | --- |
| `@lyrics-script-worker` | [Lyrics or script writing](../flows/lyrics-script-writing.md) |
| `@audio-worker` | [Audio production](../flows/audio-production.md) |
| `@scene-worker` | [Scene production](../flows/scene-production.md) |
| `@release-worker` | [Release](../flows/release.md) |

All four Agents use the same Worker role. Their assigned flow owns the detailed work, Commands, validation, and output.
The Agent binding stays minimal: stable identity, Worker role, assigned flow, lifecycle, and profile-selected provider.

The workflow requests two profile-owned provider bindings:

- `youtube-lyrics-script` for Lyrics or script;
- `youtube-default-worker` for Audio, Scene, and Release.

The intended initial operational configuration binds `youtube-lyrics-script` to the local Gemma 4 31B Q8 model and
`youtube-default-worker` to GPT-5.6 Sol. Concrete endpoints, credentials, and later model changes remain in the selected
profile.

## Routing

The approved artifact moves in this order:

`lyrics-script-worker -> audio-worker -> scene-worker -> release-worker`

When downstream work requires a material change to an approved input, the downstream Worker returns it to the Worker
that owns that artifact. The owning Worker revises and re-approves it before the flow continues.

The human may communicate directly with each Worker for its assigned step. Direct access does not allow a Worker to act
outside that step.

## Release boundary

Release Worker may prepare the complete release package. It may invoke a future registered YouTube release Command only
after receiving explicit human authorization for the exact release. Until that Command exists and is connected, it
must stop at a ready-to-release package.
