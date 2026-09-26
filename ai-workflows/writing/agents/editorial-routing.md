# Writing Router routing

The hidden Workflow Router is the Writing workflow runtime. Writer, Reviewer, and Release Coordinator are independent
role endpoints: they do not contact one another and they do not return workflow packets to Admin. The Router observes
each endpoint's terminal result, validates its evidence references, and advances only through transitions declared by
the [Writing workflow](../writing.workflow.md).

Every Router event preserves the same nonempty `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`.
The host adapter resolves one exact active role endpoint from trusted binding state. Titles, sidebar order, conversation
memory, and nearby files are never endpoint identity.

## Writer stage

The Router dispatches the human brief, exact source or revision, selected destination set, authorized archive, visual requirements,
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

`accepted` means the complete independent review gate is satisfied for the exact article and every selected rendered
destination revision, with no unresolved Writer-owned findings. Apply both the selected listen-through preference and
destination acceptance policy. When listen-through is enabled, Reviewer must offer verified narration and return
`human_action_required` with a `human-action` reference; the Router waits in `human_review` until the author confirms
listening to that exact revision. A request to play returns `listen_pending` and remains in the wait state. When Medium
does not require article acceptance, `human_listened` with exact `review` and `human-listen` evidence advances to Release
Coordinator. When acceptance is also required, `human_accepted` requires the separate decision after listening.
For an explicitly human-authorized test article, Reviewer may instead return `test_listen_simulated` after the
human wait, with exact `review` and `test-listen-simulation` references. This is a separately labeled test route;
it never asserts actual listening or changes the production `human_listened` gate.
With listen-through disabled and `requires_human_article_acceptance: false`, a successful review may return `accepted`
directly. “Source accepted” while destination rendering or visual review remains pending is not `accepted`.
Use `changes_required` only for work Writer can perform; a human rejection returns findings to Writer.

For a release-gate diagnosis, the Router assigns Reviewer the exact review record and discrepancy. Reviewer returns
existing proof, a precise stale or conflicting-record diagnosis, or `REVIEW_REQUIRED`; it never routes the result.

## Release Coordinator stage

After exact-revision review and any listening and acceptance gates required by the selected policy are complete, the Router
dispatches Release Coordinator the accepted revision, selected destination drafts and per-destination review evidence/targets,
timing instruction, applicable account policy, and prohibited effects. Release Coordinator performs release planning
or authorized Medium scheduling and finishes with terminal evidence references or one precise blocker. It is read-only
in the repository and returns observed UI evidence without editing article, archive, configuration, or runtime files.
After `released`, Router assigns Writer `archive_update` with the release record. Writer verifies the scheduled
destination and updates the canonical article metadata; `archived` with `archive-record` is the terminal event.

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
