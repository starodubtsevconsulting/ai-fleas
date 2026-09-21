# Writing editorial routing

Admin is the sole inter-agent coordinator for the Writing workflow. Writer, Reviewer, and Release Coordinator remain
directly human-addressable, but canonical workflow work and terminal evidence always return to the exact verified Admin.
No specialist-to-specialist route is authorized.

All packets follow the [common communication contract](../../_common/agents/communication.md) and preserve the same
nonempty `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`. Admin resolves exact active task IDs from
trusted binding state, never from titles, sidebar order, conversation memory, or nearby files.

## Admin to Writer

Admin sends a bounded writing or revision packet containing the human brief, exact source/revision when present,
destination, authorized archive, visual requirements, open findings, permitted effects, prohibited publication effects,
and Admin return identity. Writer acknowledges with `COPY THAT`, performs only Writer-owned work, and returns source,
archive, destination-draft, verification, and provenance evidence plus a complete proposed review packet to Admin.
Writer does not contact Reviewer or Release Coordinator.

## Admin to Reviewer

After validating Writer's return, Admin sends Reviewer the exact revisions, provenance/independence evidence, effective
brief, rendered-destination URL, visual inventory, header-image contract identity, listen-through requirements, and
required terminal disposition. Reviewer acknowledges with `COPY THAT`, independently inspects the work, presents its
human-facing report when required, and returns findings and evidence to Admin. Reviewer does not contact Writer or
Release Coordinator. A changed revision requires a new Admin-issued review packet.

For a release-gate diagnosis, Admin sends Reviewer the exact review record and discrepancy. Reviewer returns existing
proof, a precise stale/conflicting-record diagnosis, or `REVIEW_REQUIRED`; this diagnostic route is not a fresh critique.

## Admin to Release Coordinator

After exact-revision review and the human gates or preserved session-scoped release mandate are complete, Admin sends Release Coordinator the accepted revision,
destination draft, review evidence, explicit publication target, timing instruction, applicable account policy, and
prohibited effects. Release Coordinator acknowledges with `COPY THAT`, performs release planning or authorized Medium
scheduling, verifies the resulting state, and returns terminal evidence or one precise blocker to Admin. Release
Coordinator does not contact Writer or Reviewer.

## Admin continuation and completion

Admin validates every terminal return before advancing. `CHANGES_REQUIRED` returns through Admin to Writer; the corrected
revision returns through Admin to Reviewer. A release blocker returns through Admin to its capability owner, and verified
evidence returns through Admin to Release Coordinator. Admin never creates a specialist verdict, human acceptance, or
publication-target choice itself.

An accepted messaging receipt is not delivery. Follow [common delivery](../../_common/agents/delivery.md): require visible
first-commentary `COPY THAT` and terminal evidence. Empty turns or unacknowledged accepted sends produce
`BLOCKED_DELIVERY_UNACKNOWLEDGED` and lifecycle diagnosis; they never satisfy a gate. `show-context` is human-facing
presentation only and never peer transport.
