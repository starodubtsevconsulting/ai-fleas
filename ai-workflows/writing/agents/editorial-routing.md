# Writing Router routing

The hidden Workflow Router is the Writing workflow runtime. Writer, Reviewer, and Release Coordinator are independent
role endpoints: they do not contact one another and they do not return workflow packets to Admin. The Router observes
each endpoint's terminal result, validates its evidence references, and advances only through transitions declared by
the [Writing workflow](../writing.workflow.md).

Every Router event preserves the same nonempty `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`.
The host adapter resolves one exact active role endpoint from trusted binding state. Titles, sidebar order, conversation
memory, and nearby files are never endpoint identity.

## Writer stage

The Router dispatches the human brief, exact source or revision, destination, authorized archive, visual requirements,
open findings, permitted effects, prohibited publication effects, and required evidence to Writer. Writer acknowledges
with `COPY THAT`, performs only Writer-owned work, and finishes with source, archive, destination-draft, verification,
and provenance references plus a proposed review-packet reference. The host observes that result; Writer does not send
it to Reviewer, Release Coordinator, or Admin.

## Reviewer stage

After the Writer stage satisfies its declared evidence gate, the Router dispatches Reviewer the exact revisions,
provenance and independence evidence, effective brief, rendered-destination reference, visual inventory, header-image
contract identity, listen-through requirements, and required disposition. Reviewer independently inspects the work,
presents its human-facing report when required, and finishes with findings and evidence references. A changed revision
requires a new Router-assigned review stage.

Writer-owned findings must resolve to a durable Markdown artifact under the repository's ignored
`.agent-runtime/writing/findings/` directory and include its exact content hash. A conversation-only report or synthetic
`findings://` identifier is not a valid cross-endpoint reference.

`accepted` means the complete review gate is satisfied for the exact revision: required destination rendering and
visual review are complete, required listen-through evidence exists, and direct human acceptance or a valid bounded
release mandate is present. “Source accepted” with any of those gates still pending is `changes_required`, not
`accepted`. Use `changes_required` only for work Writer can perform. When Writer-owned preparation is complete and only
the human listen-through or acceptance decision remains, return `human_action_required` with a `human-action`
reference. The Router enters `human_review`, records `waiting-human`, and dispatches nobody. Human acceptance advances
to Release Coordinator; human rejection returns bounded findings to Writer.

For a release-gate diagnosis, the Router assigns Reviewer the exact review record and discrepancy. Reviewer returns
existing proof, a precise stale or conflicting-record diagnosis, or `REVIEW_REQUIRED`; it never routes the result.

## Release Coordinator stage

After exact-revision review and the human gates or preserved session-scoped release mandate are complete, the Router
dispatches Release Coordinator the accepted revision, destination draft, review evidence, explicit publication target,
timing instruction, applicable account policy, and prohibited effects. Release Coordinator performs release planning
or authorized Medium scheduling and finishes with terminal evidence references or one precise blocker.

## Advancement, recovery, and inspection

`CHANGES_REQUIRED` transitions back to a Writer correction stage; the corrected revision transitions to a fresh
Reviewer stage. `HUMAN_ACTION_REQUIRED` pauses without agent dispatch. A release-review blocker transitions to Reviewer
diagnosis, and verified diagnosis transitions back to Release Coordinator. The Router never creates a specialist
verdict, human acceptance, or publication-target choice.

Admin may inspect the Router state, bindings, correlations, and evidence references and may perform authorized endpoint
lifecycle repair. Admin cannot impersonate the runtime by manually relaying workflow packets. Dispatch acceptance is
not completion: the Router advances only after the host observes the exact endpoint turn and validates its terminal
event. Empty or unacknowledged turns produce `BLOCKED_DELIVERY_UNACKNOWLEDGED` and do not satisfy a gate.

Every endpoint must echo the Router-owned `correlationId`, stage, and role byte-for-byte in its terminal
`WORKFLOW_ROUTER_RESULT`. It must begin with `COPY THAT`; it may not shorten an attempt correlation or derive a new one.
The host rejects a missing acknowledgement or any identity mismatch without advancing the Writing run.
