# Agent continuity

A persistent logical agent must remain available even when its current runtime instance is exhausted, unavailable, or otherwise needs replacement.

Continuity is platform-neutral. The selected platform may preserve the current instance, resume it, restore it, or replace it with a successor. The mechanism must preserve the logical agent's authorized identity and required bounded context.

If replacement is required, verify the successor is ready before making it authoritative and deactivate the predecessor last. Ambiguous lineage or incomplete handoff blocks continuity rather than guessing.

Continuity is separate from elasticity: continuity preserves one logical agent across runtime instances; elasticity adds independent concurrent instances for capacity.
