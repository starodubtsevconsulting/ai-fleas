# Agent continuity reconciliation test

Verify that a persistent logical agent remains authoritative across native persistence, resume, restore, or replacement.

For replacement, verify one recorded predecessor and one recorded successor reconcile to exactly one ready authoritative instance, with authorized identity and required bounded context preserved before predecessor deactivation.

Missing lineage, duplicate candidates, incomplete handoff, or an unresolved provisional instance must block without guessing or activating an additional candidate.
