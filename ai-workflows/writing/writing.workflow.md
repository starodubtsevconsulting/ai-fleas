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

## Responsibility handoff

- The **Writer** owns intake, drafting, editorial verification, archive maintenance, unpublished destination preparation,
  and resolution of independent critique. Writer returns its clean copy, exact revisions, evidence, and proposed review
  result for host observation. The Router validates it and dispatches the next declared stage.
- The **Reviewer** owns the independent reading and critique within that flow. It must not have drafted or edited the
  revision it reviews. It applies the article-specific template and method emphasis resolved from profile preferences
  and the human's brief, using the [review criteria](guides/review-criteria.md). It returns evidence-linked findings to
  the Router-observed stage result and the human, not an edited replacement draft or publication approval.
- The **Release Coordinator** owns release planning and the final recommendation to the human. It verifies the review
  gate, destination account, profile-owned cadence, and publication or queue history before proposing a day. If any
  review evidence is missing, stale, or conflicting, it returns a blocker event; the Router assigns Reviewer a bounded
  diagnosis stage. It reports a pending gate instead of inventing a slot. Substantive
  editorial changes remain Writer-owned; a changed revision requires affected checks to be repeated.
- The **Admin** owns roster administration, Router inspection, and authorized recovery. Admin may start or resume a
  declared run and report its state, but does not manually relay stage packets or choose transitions. Admin does not
  inherit editorial verdicts, human acceptance, publication-target choice, or publication authority.
- The human author alone accepts the final revision and performs any Publish, Submit, or Schedule action. These
  responsibilities do not imply autonomous publishing. A Reviewer title or emulated role switch alone does not make a
  critique independent.

## Workflow

1. Establish the request, source, audience, destination, and authorized archive through the
   [intake and planning flow](flows/intake-and-planning.flow.md).
2. Produce or revise the article through the [drafting flow](flows/drafting.flow.md), using the
   [blogging workflow](../blogging/blogging.workflow.md) for applicable editorial methods.
3. Check provenance, facts, voice, structure, links, and visuals through the
   [editorial verification flow](flows/editorial-verification.flow.md). Failed checks return to drafting without
   discarding valid work.
4. Preserve the canonical Markdown article and initial metadata through the [archive flow](flows/archive.flow.md).
5. When a destination is selected, prepare its unpublished version through the
   [destination preparation flow](flows/destination-preparation.flow.md), then return to the archive flow to record
   the draft URL, status, and topics. Destination preparation never includes publication.
6. Challenge the finished article through the [independent critique flow](flows/independent-critique.flow.md),
   addressing substantive findings before calling it release-ready. The computer prepares a spoken preview for the
   human author's first listen-through when available or required; a fresh-context reviewer checks the work; the human
   accepts the exact final revision directly or through a bounded session-scoped release mandate.
7. The Router assigns the accepted exact revision and review record to Release Coordinator, which first resolves the explicit
   publication target (such as Medium profile/home versus a named authorized Publication), then selects a
   destination-specific slot through the [release planning flow](flows/release-planning.flow.md), using profile-owned
   cadence settings and verified publication history. After direct human acceptance or a valid session-scoped mandate, Release
   Coordinator may schedule on Medium only when the selected profile explicitly enables it and the selected target
   supports it, without a second per-item timing approval. Publication-target selection is still required and must
   never default silently.
8. Hand the status and any remaining decisions to the human. The human performs immediate publication or submission.
   Pending review or timing must be visible in the handoff, not silently treated as approval.

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

The selected profile explicitly lists editor and destination commands for this workflow. Choose only a configured destination
that matches the human's request; the generic `writing` command does not choose a platform. A destination command
owns its provider-specific editor mechanics and any skill it requires. Preparing a destination draft does not grant
publication authority. A separately enabled Medium schedule mode grants Release Coordinator future scheduling after
human article acceptance; the human performs immediate publication or submission.

Each `destinations[]` binding may hold a `release_policy` for that account and workflow, such as a local time zone
and maximum posts per local day. These are profile-owned strategy settings, not universal Medium rules and not
command permissions by itself. Another platform can have a different policy. Missing or unverified publication history
makes timing provisional; it does not turn a draft into a scheduled or published post.

The [shared flow contract](../_common/flows/contract.md) governs evidence and recovery across these flows.
