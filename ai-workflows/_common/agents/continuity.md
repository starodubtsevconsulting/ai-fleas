# Agent continuity

Continuity is enabled by default and has no time limit unless a workflow overrides it for a logical agent.

A logical agent must remain available across runtime exhaustion, loss, or replacement for the duration of its continuity policy. The selected platform may preserve, resume, restore, compress, or replace the runtime instance while preserving the logical agent's authorized identity and required bounded context.

A workflow may disable continuity or set a maximum logical-agent duration, for example `continuity: { enabled: false }` or `continuity: { maxDuration: 24h }`. Duration applies to the logical agent across all underlying runtime instances, not to an individual session or replacement.

If replacement is required, collect the predecessor's [knowledge transfer](knowledge-transfer.md) when available, initialize the successor with it, verify the successor is ready, make it authoritative, and deactivate the predecessor last. If the predecessor is unavailable, use only trusted persisted transfer or status. Ambiguous lineage or incomplete handoff blocks continuity rather than guessing.

Continuity stops when explicitly disabled, terminated, or its configured maximum duration is reached.

Continuity is separate from elasticity: continuity preserves one logical agent across runtime instances; elasticity adds independent concurrent instances for capacity. Platform-specific context thresholds or compression rules remain platform configuration.
