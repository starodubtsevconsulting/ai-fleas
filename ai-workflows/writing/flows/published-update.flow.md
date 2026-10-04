# Update an existing published article

## Purpose

Revise one already published story in place. This is a Writing route for a new revision of an existing article, not a
new release or scheduling request. Keep the existing story URL and publication state. Use the selected profile's
editorial project, permanent archive, repository mirror, and destination binding.

## Entry

Admin supplies a durable `work-request` and the exact `published-story` URL outside the Router. The request identifies the requested change, selected project, destination
account, and the human's approval or applicable delegated authority to edit that live story. An article title alone
does not identify the story. Writer reads the live story, archive, and remote repository record before changing any
copy or asset, and records their current revisions and publication status.

## Stages

1. **Writer — `published_revision`.** Prepare the smallest requested change in the existing canonical article folder.
   For an image change, keep the old image, credit, and rights record as history; name the new asset and record its
   source, rights, hash, caption, and alt text. Check it against prior selected headers and the project visual brief.
   Update the archive and repository mirror on a visible branch, verify the remote revision, and prepare a destination
   preview without changing the live story. State exactly what will change on the existing public page. Return
   `review_ready` with `revision`, `published-story`, and `review-packet` references.
2. **Reviewer — `published_review`.** Independently inspect the exact proposed revision, remote repository mirror,
   archive, earlier selected images, and destination preview. Apply the normal editorial, header, rendering, rights,
   and three-surface checks to the affected material. Verify that the request authorizes this live update, the story
   URL and account match, and the proposed edit preserves unrelated content. Return `accepted` with `review`,
   `published-story`, and `destination-review`, or `changes_required` with precise Writer-owned findings. Do not
   claim the changed live page has been checked yet.
3. **Release Coordinator — `published_apply`.** Recheck the exact reviewed revision and authorization, edit the
   existing story in its destination UI, and read back the saved public page. Replace the intended asset rather than
   adding a duplicate. Correct captions, alt text, credits, and provenance affected by the change. Never create a
   second story, change the publication target, schedule another release, or use immediate Publish for a different
   article. Return `applied` with the story identity and a `destination-change` record of the before/after state.
   If the editor cannot upload or save, return a concrete blocker and leave the existing published version intact.
4. **Reviewer — `published_verification`.** Independently inspect the public URL after the edit. Compare the visible
   title, subtitle, prose, image count/order, header crop, alt text, captions, links, and provenance with the reviewed
   revision. Return `verified` with `published-story` and `destination-review`, or route a discrepancy to Writer with
   `changes_required`. A successful editor save alone is not verification.
5. **Writer — `published_reconciliation`.** Read back the live page, archive, and remote repository mirror. Record the
   existing story URL, actual published state, selected header identity, prior-image history, and update timestamp in
   the archive and mirror. Update the header-use index only for a header actually used on the public story. Return
   `archived` with `archive-record` and `published-story` only after a three-surface reconciliation at a verified
   remote commit. If synchronization fails, leave the run visibly pending at this stage.

## Listening and approval

The active profile's listen-through and article-acceptance policy applies to substantive prose revisions. Offer a
revision-bound narration and follow the normal human or exact Admin-delegated decision route before applying such a
revision. A visual-only correction with unchanged prose does not invent a new listening claim; record the unchanged
body hash and the exact human approval or delegated authority for the visual update. Existing publication is not
blanket authorization for later edits.

## Exit

Complete only when the updated public story and the two durable records agree. A blocked upload, failed saved-page
inspection, stale review, or missing archive/mirror reconciliation is a pending update, not a completed refresh.
