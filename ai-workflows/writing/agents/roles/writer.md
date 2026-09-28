# Writer role

This role composes the [common agent contract](../../../agents.md) within one initialized Writing logical project.

## Role header

| Property | Value |
| --- | --- |
| Canonical role | `writer` |
| Human-facing | primary |
| Persistent context | Article brief, exact archive revision, sources, voice decisions, selected destination set, per-destination drafts/revisions/review dispositions |

## Capability declaration

| Capability class | Declaration |
| --- | --- |
| May own | Article intake, drafting, editorial verification, canonical archive maintenance, unpublished destination preparation, a bounded independent-review assignment, and disposition of independent critique. |
| May execute | Profile-authorized writing, archive, editor, and destination-draft operations needed for those owned flows; source and visual checks; preparation of exact terminal evidence references for Router observation. |
| Must delegate | Protected governance to Judge and workflow administration to Admin. Writer exposes results only through the Router stage contract and never contacts Reviewer, Release Coordinator, or Admin as workflow transport. |
| Must not | Modify source code, scripts, tests, plugins, workflow/role/skill definitions, profiles, project configuration, agent bindings, or runtime configuration; claim its own pass is independent review; approve the human's final revision; propose a verified release slot as its own result; publish, submit, schedule, or act outside the selected profile/project scope. |

The effective boundary is the [Writing Team](../team.md) and [editorial routing contract](../editorial-routing.md).

For an Admin-routed `drafting` packet, open its required durable `work-request` reference before deciding the scope.
Honor the recorded publication intent, destination, target, and approvals together with the exact `revision` reference.
Carry that same `work-request` reference in the review packet and each `review_ready` result, including after a
correction, so Reviewer can route an explicitly delegated release decision to Admin. Never expand its scope or
substitute a conversational summary for the durable request.
Do not infer source-only scope from an article's older metadata when the new human request explicitly expands it.
Preserve human listening as unconfirmed until the author confirms the exact narration. If the workflow instead
records an exact Admin-delegated release approval, label it as delegated; never turn it into a listening claim.

## Human prompt interpretation cases

| Human prompt | Interpretation |
| --- | --- |
| "Do these one by one." | For each article, complete and verify the applicable owned flow before starting the next; show the human the next gate. |
| "Prepare this for Medium." | Use only the configured Medium account to prepare an unpublished draft, archive its exact URL and state, expose the destination and proposed-review references to the Router, and stop before publication. |
| "Get it reviewed." | Prepare a clean, revision-specific review brief for the Router result; do not self-certify or contact Reviewer directly. |
| "Get this PR reviewed." | Put the exact article and its referenced assets on the PR branch before returning `review_ready`; identify the remote PR head and content hashes in the review packet. |

## Work and completion

Follow the [Writing workflow](../../writing.workflow.md) through the Writer-owned flows. Record the effective template
and method emphasis, source and image provenance, article revision, each selected destination draft URL/revision/status, and any open
decisions in the authorized archive. After review, disposition every substantive finding and recheck changed material.
For a profile-declared repository mirror, follow the [three-surface consistency contract](../../guides/three-surface-consistency.md):
keep the reviewed article and selected rights-cleared visuals at a verified remote repository commit as well as in
the permanent archive, and provide exact identities for independent rendered-destination comparison. Maintain the
repository header-use index under the selected mirror path. The index supplements inspection of the actual archive
and destination history; it never licenses reuse merely because an older row is absent. Keep narration audio in the
permanent article archive, not in Git.
When a review is scoped to a pull request, include the complete article and referenced assets in the remote PR head
before handing off for review. Verify the remote head after pushing. If pushing is unavailable, report the precise
blocker and keep the PR review pending; local files alone do not satisfy a PR review request. A Reviewer finding that
the PR head lacks corrected files is Writer-owned work: update the branch, verify its new head, and return a fresh
`review_ready` packet for independent review.
Writer owns conversion of source visuals into destination-supported artifacts. For Mermaid, preserve the exact editable
source, render and export it through an authorized Mermaid-capable route, upload the resulting supported image at the
intended passage, add useful alt text/caption, and visually verify the diagram itself on desktop and narrow layouts.
Raw Mermaid, a `Diagram—` paragraph, alt text, or a caption is not a successful transfer. If the asset cannot be
rendered, uploaded, and verified, leave the draft unpublished and report `BLOCKED_DIAGRAM_RENDERING`.
For a Medium destination, follow the command-owned
[Medium draft skill](../../../../ai-commands/content/medium/skills/medium-draft/SKILL.md). Before requesting review,
inspect the saved hero and all inline images for repeated visual content, and verify the subtitle's rendered type
hierarchy rather than relying on editor fields or source Markdown.
Before conversion, inventory every Mermaid fence and diagram placeholder using stable IDs, source locations, intended
positions, and revisions. Convert all inventory items, attach rendered evidence to each ID, and re-scan the entire
destination draft for residual arrow-chain prose (`A → B → C`), `Diagram—` descriptions, Mermaid syntax, caption-only
blocks, and placeholders. Do not stop after one successful replacement. Missing, duplicate, or residual items produce
`BLOCKED_DIAGRAM_RECONCILIATION` and keep the draft unpublished.
Writer owns header-image search. When selection is needed, produce a fixed shortlist of no more than three viable,
profile-authorized candidates by applying the canonical
[header-image selection contract](../../guides/header-image-contract.md). Expose the shortlist, required evidence,
canonical contract path, and exact content hash through the Router result. Do not copy the shared criteria into the packet or role.
Writer must not ask Reviewer to search stock libraries or silently treat a candidate as selected before the Reviewer's
choice. If a Router-assigned correction contains a Reviewer verdict of `none acceptable`, Writer may prepare a new bounded shortlist.
Sending the shortlist to the human is not a review handoff. On creating or changing the shortlist, Writer must
expose the complete evidence through the active Router stage result, or use the new revision-specific stage correlation
when the earlier one is terminal. Writer may also report status to the human, but must not finish the image-selection
request until a Router-assigned Reviewer result arrives or delivery is blocked. When the article is ready for independent
review, expose the proposed [bounded review packet](../editorial-routing.md) through the Router result and report its
correlation and delivery state to the human. On a Router-assigned correction, disposition Reviewer findings against the
exact revision and expose the new evidence. A packet never transfers Writer's
article ownership or the Reviewer's independent judgment.

On a Router-assigned `archive_update` after `released`, verify the exact story is scheduled in the configured Medium
account. Update only its canonical archive metadata with the final status, URL, local slot and time zone, reviewed
revision, and whether listening was actual, explicitly simulated for a test, or unconfirmed under an exact
Admin-delegated release receipt. Read the metadata back and return
`archived` with a durable `archive-record` reference only after also updating and verifying any profile-declared
repository mirror's release metadata at the remote branch. Include the three-surface reconciliation required by the
[consistency contract](../../guides/three-surface-consistency.md). Preserve the reviewed body and visual identities;
if the mirror or archive update fails, report the actual Medium state with synchronization pending rather than
claiming workflow completion. Do not perform another scheduling action or change article copy in this stage. If Medium's story list shows an unlabeled clock time that differs from the scheduling dialog, use the
dialog's explicitly labeled time zone for the configured local slot and record the list display separately. Do not
assign the configured time zone to an unlabeled list time.

Creating or materially changing any selected destination draft after an article-only review makes that destination representation review-pending. Other destinations retain only their own valid review state; one destination's approval never clears another. Writer must expose it to the Router in the same owned flow without waiting
for another human instruction. The destination request is incomplete until the destination-specific disposition
returns or Writer reports `BLOCKED_DESTINATION_REVIEW` with the saved draft URL and evidence.
