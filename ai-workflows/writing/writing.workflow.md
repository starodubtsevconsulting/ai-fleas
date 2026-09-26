# Writing workflow

Use this workflow to prepare and maintain human-facing articles. The selected profile must explicitly register the
article archive as a project; a vault name is a UI label, not a storage location or proof of workflow identity.
The selected profile must explicitly register this workflow and its work projects. The managed roster is declared in
[agents.yml](agents.yml), with effective ownership and human-directed routing in the [Writing Team](agents/team.md).
Declaring the roster does not initialize live agents or create publication authority.

## Execution mode

When a selected platform has initialized the complete roster under the [common agent contract](../agents.md), the hidden
[Workflow Router](../_common/runtime/workflow-router.md) executes the declared flow through the
[Writing routing contract](agents/editorial-routing.md). It assigns each stage to one exact role endpoint, observes the
completed turn, validates evidence references, and selects the next declared transition. Endpoints never contact one
another. Admin inspects the runtime and performs authorized recovery; it is not the workflow transport. All roles remain
directly human-addressable. Before initialization, an authorized task
may emulate Writer and Release Coordinator steps for
draft preparation, but it must not claim a managed-agent identity. Independent critique still needs a genuinely
fresh-context Reviewer task or human reader who did not draft or edit the revision. If unavailable, mark it pending.

The executable projection is [writing.workflow-map.json](writing.workflow-map.json); its generated human-readable view
is [writing.workflow-map.mmd](writing.workflow-map.mmd).
The generated diagram marks the workflow start in blue, the human wait in amber, and completion in green; its
diagnosis arrows show the recovery route for prepared review evidence, missing Writer preparation, or a resolved
release gate. It describes possible states rather than the currently active run.

## Repository mutation boundary

Writer, Reviewer, and Release Coordinator are content-workflow endpoints, not software-development or workflow-
administration roles. Writer may create or update article copy, article metadata, and article assets owned by its
active stage. Reviewer may create review findings, review evidence, and narration artifacts, but does not edit the
article. Release Coordinator is read-only in the repository; it may inspect evidence and operate an explicitly
authorized destination UI, then return the observed result without changing repository files.

They must not modify source code, scripts, tests, plugins, workflow definitions or maps, role or skill instructions,
profiles, project configuration, agent bindings, or runtime configuration. A direct human request does not silently
broaden an endpoint's role. Such a request must be reported as outside the endpoint's capability and routed to the
declared administrative or development owner. Reading those files for bounded context does not authorize changing
them.

## Responsibility handoff

- The **Writer** owns intake, drafting, editorial verification, archive maintenance, unpublished destination preparation,
  and resolution of independent critique. Writer returns its clean copy, exact revisions, evidence, and proposed review
  result for host observation. The Router validates it and dispatches the next declared stage.
  After verified scheduling, Router assigns Writer `archive_update` with the exact release record. Writer checks the
  destination state and updates article metadata to the scheduled URL, local slot, time zone, and test/real listening
  classification; it returns an `archive-record` reference. An unchanged draft status is not completion.
- The **Reviewer** owns the independent reading and critique within that flow. It must not have drafted or edited the
  revision it reviews. It applies the article-specific template and method emphasis resolved from profile preferences
  and the human's brief, using the [review criteria](guides/review-criteria.md). It returns evidence-linked findings to
  the Router-observed stage result and the human, not an edited replacement draft or immediate-publication approval.
- The **Release Coordinator** owns release planning and authorized future scheduling. It verifies the review
  gate, destination account, profile-owned cadence, and publication or queue history before choosing a day. If any
  review evidence is missing, stale, or conflicting, it returns a blocker event; the Router assigns Reviewer a bounded
  diagnosis stage. It reports a pending gate instead of inventing a slot. It is repository read-only; any later
  archival update belongs to Writer. Substantive
  editorial changes remain Writer-owned; a changed revision requires affected checks to be repeated.
- In release-gate diagnosis, Reviewer routes an already prepared revision and review packet back to independent
  `review` with `review_ready`, including the fixed header shortlist when image selection is pending. Reviewer uses
  `changes_required` with findings when Writer must prepare missing assets or an unpublished destination draft.
  Reviewer uses `proven` only when a fresh review and separate release-gate evidence establish that the missing
  gate is resolved. Repeating the same blocker does not dispatch another diagnosis turn.
- The **Admin** owns roster administration, Router inspection, and authorized recovery. Admin may start or resume a
  declared run and report its state, but does not manually relay stage packets or choose transitions. Admin does not
  inherit editorial verdicts, human acceptance, publication-target choice, or publication authority.
- The human author may accept or reject a final revision. When the selected profile explicitly permits review-only
  Medium scheduling, a successful independent review authorizes Release Coordinator to schedule a future slot without
  another article-acceptance decision. The human performs immediate Publish or Submit actions. A Reviewer title or
  emulated role switch alone does not make a critique independent.

## Workflow

1. Establish the request, source, audience, selected destination set, and authorized archive through the
   [intake and planning flow](flows/intake-and-planning.flow.md).
2. Produce or revise the article through the [drafting flow](flows/drafting.flow.md), using the
   [blogging workflow](../blogging/blogging.workflow.md) for applicable editorial methods.
3. Check provenance, facts, voice, structure, links, and visuals through the
   [editorial verification flow](flows/editorial-verification.flow.md). Failed checks return to drafting without
   discarding valid work.
4. Preserve the canonical Markdown article and initial metadata through the [archive flow](flows/archive.flow.md).
5. For every selected destination, prepare its unpublished representation through the
   [destination preparation flow](flows/destination-preparation.flow.md), then return to the archive flow to record
   the draft URL, status, and topics. Destination preparation never includes publication.
6. Challenge the finished article through the [independent critique flow](flows/independent-critique.flow.md),
   addressing substantive findings before calling it release-ready. The computer offers a spoken preview when enabled;
   a fresh-context reviewer checks the exact article and destination rendering. A source-only pass is not the workflow
   event `accepted` while destination rendering or visual preparation remains pending. Reviewer returns
   `changes_required` only for remaining Writer-owned preparation. When listen-through is enabled, a passing review
   returns `human_action_required` and the Router waits for the author to listen and confirm the exact narration.
   That listening requirement remains even when Medium sets `requires_human_article_acceptance: false`; in that case
   `human_listened` advances to release without treating listening as editorial acceptance. When acceptance is also
   required, Reviewer waits for that separate decision. With listen-through disabled and no acceptance requirement,
   a complete successful review returns `accepted` directly.
   A separately authorized, clearly labeled test article may use `test_listen_simulated` after the narration offer and
   recorded human wait when the human explicitly authorized both simulation and live scheduling of that exact test
   article. Its distinct evidence must say the author did not confirm listening. It never satisfies a production
   listen-through gate.
7. The Router assigns the accepted exact revision and review record to Release Coordinator, which resolves the
   publication target from an explicit article selection or a human-authorized profile policy, then selects a
   destination-specific slot through the [release planning flow](flows/release-planning.flow.md), using profile-owned
   cadence settings and verified publication history. When the selected profile enables Medium scheduling and every
   gate passes, Release Coordinator schedules the future slot and verifies Medium's scheduled state in that stage,
   without a second per-item timing approval. An unresolved target or failed gate pauses with a precise blocker.
8. Hand the status and any remaining decisions to the human. The human performs immediate publication or submission.
   Pending review or timing must be visible in the handoff, not silently treated as approval.
   For scheduled releases, Router first assigns Writer the archive update and marks the run complete only after the
   scheduled metadata is saved and verified.

For a source-to-destination conversion, preserve the source in the archive even if import or editor work fails.
For a read-only question or a minor revision, run only the applicable flows and explain any skipped gate.

## Article memory

- Resolve the archive from the selected profile's `article_store.project_ref`, which must name an authorized project.
  Its `storage_path` is the local location for the active device/runtime, not a universal path across devices. The
  logical article store and its content remain the same when another authorized device maps it to a different local
  path. Do not infer a device path from the workflow name,
  Obsidian's vault label, a sidebar title, or a nearby folder.
- Keep an editable Markdown copy of each article in the archive, along with source, draft/publication status,
  destination URL, and selected topics or tags. Preserve existing archive layout and files.
- For a newly prepared article, copy the source into the archive and verify the copy before considering the writing
  task complete. Never rename, move, or delete the archive as part of workflow setup.
- A profile-selected editor such as Obsidian may open that exact archive folder as a vault. Verify its configured
  vault maps to the active device's project path; the editor is not the storage or synchronization provider. A sync
  service may make the same logical archive available on another device, but its local path and vault registration
  must be configured and verified separately. Do not create a second sync mechanism when one already exists.

## Destination commands

The selected profile explicitly lists editor and destination commands for this workflow. Resolve one or more configured destinations from the article selection or profile defaults; the generic `writing` command does not choose a platform. A destination command
owns its provider-specific editor mechanics and any skill it requires. Preparing a destination draft does not grant
publication authority. A separately enabled Medium schedule mode grants Release Coordinator future scheduling after
the active review and acceptance policy passes; the human performs immediate publication or submission.

Each `destinations[]` binding may hold a `release_policy` for that account and workflow, such as a local time zone
and maximum posts per local day. These are profile-owned strategy settings, not universal Medium rules and not
command permissions by itself. Another platform can have a different policy. Missing or unverified publication history
makes timing provisional; it does not turn a draft into a scheduled or published post.

The [shared flow contract](../_common/flows/contract.md) governs evidence and recovery across these flows.
