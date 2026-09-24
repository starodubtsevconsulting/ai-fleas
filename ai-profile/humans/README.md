# Human profiles

Human profiles are peers of workflow profiles. They bind a governed person to a persistent Personal Governor, durable memory, resources, and authorized workflow-profile contexts.

A Personal Governor belongs to a human profile, not to any workflow profile. Public examples use fictional identities; real human profiles belong in private profile repositories.

The human profile owns the explicit `authorizedProfiles` and profile-qualified
`authorizedWorkflows` allowlists. Do not duplicate these access decisions in the
reusable Personal Governor role or its runtime binding.

Human-specific platform preferences also belong in the human Governor binding. For example,
`platformBindings.gpt-agents.utilitySubagents` may explicitly authorize the GPT adapter's bounded helper policy and select
its model/reasoning routes. The adapter contract owns the mechanics; the human binding only enables and tunes them.
