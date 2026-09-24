# Human profiles

Human profiles are peers of workflow profiles. They bind a governed person to a persistent Personal Governor, durable memory, resources, and authorized workflow-profile contexts.

A Personal Governor belongs to a human profile, not to any workflow profile. Public examples use fictional identities; real human profiles belong in private profile repositories.

The human profile owns the explicit `authorizedProfiles` and profile-qualified
`authorizedWorkflows` allowlists. Do not duplicate these access decisions in the
reusable Personal Governor role or its runtime binding.
