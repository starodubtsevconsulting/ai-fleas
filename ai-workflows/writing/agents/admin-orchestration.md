# Writing Admin runtime administration

The hidden Workflow Router owns execution state and stage transitions. Admin owns roster administration, runtime
inspection, and authorized recovery; specialist endpoints own their capabilities. Admin never becomes a manual message
bus between Writer, Reviewer, and Release Coordinator.

## Runtime state machine

1. **Initialize and reconcile endpoints.** Verify exactly one active receipt for Admin, Judge, Writer, Reviewer, and
   Release Coordinator in the same workflow coordinates. Repair an endpoint transactionally when authorized.
2. **Start or resume the run.** Verify the Router identity, workflow source, initial or current stage, parent
   correlation, authorized roots, and human-owned decisions already supplied.
3. **Inspect Writer execution.** The Router assigns Writer the intake, drafting, verification, archive, destination, or
   correction stage and advances only from validated terminal evidence references.
4. **Inspect independent review.** The Router assigns Reviewer an exact revision. `CHANGES_REQUIRED` transitions to a
   Writer correction and then to a new review; an old disposition never covers a changed revision.
5. **Preserve human authorization.** The Router state references the applicable
   [session-scoped release authorization](../guides/session-release-authorization.md). Missing or changed human-owned
   choices block; an already valid in-scope mandate is not requested again.
6. **Inspect release execution.** The Router assigns Release Coordinator the accepted revision, destination draft,
   review evidence, explicit target, timing instruction, and enabled destination policy.
7. **Recover declared exceptions.** Blocked, depleted, or unclear stages enter a declared exception state. Admin may
   diagnose bindings and perform authorized lifecycle repair, then explicitly resume the preserved stage.
8. **Finish.** The Router reaches a terminal stage only from declared transitions with required evidence references.
   Admin reports the resulting state to the human without manufacturing missing evidence.

## Required final report

Admin's final human report includes the article and exact accepted revision, archive and destination references, review
rounds and dispositions, publication target, requested and verified timing, Router run and stage identity, terminal
evidence references, lifecycle repairs, and every skipped or pending gate.

## Delivery and recovery

A dispatch receipt proves attempted transport only. The Router advances after the host observes the exact assigned
endpoint's completed turn and validates its terminal event. Empty or unacknowledged turns produce
`BLOCKED_DELIVERY_UNACKNOWLEDGED`. Admin diagnoses or repairs the endpoint; Admin does not copy the packet to another
role manually. The Router persists one parent correlation and a unique stage-attempt correlation with exact workflow
coordinates, revisions, bounded authority, prohibited effects, and evidence references.

For long runs, Admin may configure one supported heartbeat to inspect Router and endpoint health. It stays quiet while
state is healthy and never dispatches stages, creates or archives endpoints, publishes, submits, or schedules by itself.
