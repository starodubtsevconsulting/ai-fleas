# Writing Admin orchestration

Admin owns the workflow control plane; specialist agents own their capabilities. Every canonical agent packet starts
from Admin and every terminal packet returns to Admin. Writer, Reviewer, and Release Coordinator never dispatch work
directly to one another.

## End-to-end state machine

1. **Initialize and reconcile roster.** Verify exactly one active receipt for Admin, Judge, Writer, Reviewer, and
   Release Coordinator in the same four workflow coordinates. Repair a role transactionally when needed: one temporary
   successor candidate, readiness verification, predecessor archival, binding update, then uniqueness verification.
2. **Assign writing.** Admin sends Writer the human brief, destination, authorized roots, intended release offset, and
   prohibitions. Writer returns source/archive revisions, verification evidence, unpublished destination draft evidence,
   and a complete proposed review packet to Admin.
3. **Assign review.** Admin validates Writer's evidence and sends Reviewer an exact revision-specific packet. Reviewer
   returns findings, rendered-destination evidence, listen-through status, and terminal disposition to Admin.
4. **Resolve changes.** For `CHANGES_REQUIRED`, Admin sends the bounded findings to Writer. Writer returns a new exact
   revision and proposed review packet. Admin repeats independent review until Reviewer returns an acceptable terminal
   disposition. Old dispositions never cover changed revisions.
5. **Obtain human-only decisions.** Admin shows the exact final revision and unresolved human gates. Human acceptance,
   publication target, and any authority reserved to the human must be explicit and revision-bound. Admin records them;
   it does not infer them.
6. **Assign release.** Admin sends Release Coordinator the accepted exact revision, destination draft, review evidence,
   target, timing instruction, and enabled destination policy. Release Coordinator returns scheduled/read-back evidence
   or one precise blocker to Admin.
7. **Diagnose blockers.** Admin routes a release-review evidence question to Reviewer or an editorial correction to
   Writer, then returns verified evidence to Release Coordinator in a continuation packet. The human is not a courier.
8. **Finish.** Admin verifies the destination state and archive record and reports the terminal outcome to the human.

## Required final report

Admin's final human report includes:

- the article title, exact accepted revision/hash, source path, archive path, and destination draft/public URL;
- how many independent review rounds occurred, each disposition, and the final Reviewer evidence;
- the destination platform and exact account/publication target;
- the requested timing rule and the verified scheduled local date, time, and time zone;
- proof links or durable evidence for the draft, review, schedule read-back, and archive metadata;
- any lifecycle repairs performed, predecessor/successor task IDs, and proof that exactly one active binding remains per role;
- any skipped or still-pending gate. Admin must not report the workflow complete while a required gate is pending.

## Delivery and recovery

A send receipt is attempted transport only. Admin requires visible `COPY THAT` and a terminal return for the same
correlation before advancing. An empty completed turn is `BLOCKED_DELIVERY_UNACKNOWLEDGED`, not agent refusal. Admin
does not resend an accepted-but-unacknowledged packet. It diagnoses the binding/task, performs an authorized lifecycle
repair when required, and sends the still-pending work once to the verified successor under a new delivery correlation
linked to the parent workflow correlation.

Admin maintains one parent correlation for the human objective and a unique child correlation for each stage attempt.
Every child packet includes exact caller, target, Admin return instance, four workflow coordinates, exact revisions,
bounded authority, prohibited effects, and required evidence. Admin persists enough evidence to resume without relying
on conversation memory.

## Periodic health supervision

For a long-running Admin-owned workflow, Admin configures one profile/platform-supported periodic heartbeat rather than
continuously polling agents. The heartbeat reads exact active task IDs from trusted binding state and samples compact
task status at a bounded interval. It stays quiet while state is healthy or unchanged and reports only actionable stalls.

An actionable stall includes: a pending stage whose task completed an empty turn; no visible `COPY THAT` or terminal
return for the active correlation; an idle task despite a durable pending packet; a missing/archived task contrary to an
active receipt; more than one active visible task for one role; or an in-progress turn with no status/revision change for
the configured stale threshold. A send receipt alone is never progress. The heartbeat reports evidence and a bounded
recovery to Admin but never creates, replaces, archives, publishes, submits, or schedules by itself. Admin performs any
authorized recovery transaction and prevents concurrent duplicate recovery.
