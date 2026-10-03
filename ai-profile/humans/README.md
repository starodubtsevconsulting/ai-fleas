# Human profiles

Human profiles are peers of workflow profiles. They bind a governed person to a persistent Personal Governor, durable memory, resources, and authorized workflow-profile contexts.

A Personal Governor belongs to a human profile, not to any workflow profile. Public examples use fictional identities;
real human profiles belong in private storage, such as the GPT adapter's home-folder store or a private profile repository.

On GPT, the launcher can scaffold a missing exact human ID in its home-folder profile store, with an optional
explicit location override.
It creates only the human profile, Governor binding, and local Markdown memory; its profile and workflow allowlists
start empty. It never copies the public example's fictional authority or overwrites an existing profile. Add any
authorized contexts deliberately after initialization.

The human profile owns the explicit `authorizedProfiles` and profile-qualified
`authorizedWorkflows` allowlists. Do not duplicate these access decisions in the
reusable Personal Governor role or its runtime binding.

Human-specific platform preferences also belong in the human Governor binding. For example,
`platformBindings.codex-app.utilitySubagents` may explicitly authorize the Codex app adapter's bounded helper policy and select
its model/reasoning routes. The adapter contract owns the mechanics; the human binding only enables and tunes them.
