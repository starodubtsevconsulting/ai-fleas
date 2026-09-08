# Agent continuity reconciliation test

Verify that continuity is enabled with no time limit by default.

Verify that a workflow may disable continuity for one logical agent or set a maximum duration such as `1h` or `24h`, and that the duration covers the logical agent across all of its runtime instances.

Verify that a logical agent remains authoritative across native persistence, resume, restore, compression, or replacement while continuity remains active.

For replacement, verify one recorded predecessor and one recorded successor reconcile to exactly one ready authoritative instance, with authorized identity and required bounded context preserved before predecessor deactivation.

Verify that continuity stops when disabled, explicitly terminated, or its configured maximum duration is reached.

Missing lineage, duplicate candidates, incomplete handoff, or an unresolved provisional instance must block without guessing or activating an additional candidate.
