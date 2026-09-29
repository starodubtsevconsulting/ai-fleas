# Article consistency across archive, repository, and destination

Apply this contract when the selected profile declares an article repository mirror. Resolve its project and paths
from that profile; a nearby checkout or a GitHub URL in prose does not select a mirror. The three surfaces are the
configured permanent article archive, the declared repository article record at a verified remote branch/commit, and
each selected publishing destination at its exact draft or story URL. Record all three identities in review evidence.

## Before release

Writer keeps the complete Markdown article and selected visual assets in the permanent archive and the declared
repository mirror. For Markdown with the same format, compare exact file hashes. For assets intended to render from
the repository, compare exact bytes and hashes. Preserve edit sources and rights records in the archive; mirror the
selected public visual and its publishable credit/provenance in the repository when the rights permit distribution.
Do not commit rejected candidates, private notes, or narration audio merely to satisfy the mirror. If a selected
visual cannot be mirrored lawfully, record a rights-compatible public representation and exact source identity; if
the destination visual still cannot be independently reconciled, the release gate remains blocked.

The destination may use native formatting and a different image encoding or crop. Compare its visible title,
subtitle, article prose, meaningful links, section order, visual count and placement, alt text, captions, credits,
and ending to the reviewed source. Record every intentional destination-only difference. A draft URL, editor field,
or import log is not proof of saved rendered content. A changed article or destination invalidates affected review
evidence. The repository mirror must include the reviewed article and selected assets at a verified remote commit;
uncommitted local files or a stale PR head do not count.

Reviewer independently reads the archive, remote repository record, and saved rendered destination. Its durable
consistency evidence identifies the archive and repository content hashes, remote commit, destination URL and
observed state, selected visual identities, and any allowed formatting differences. Missing, stale, or conflicting
surface evidence is a Writer-owned finding, not a passing review. Release Coordinator rechecks those identities and
the human and destination gates before scheduling; it cannot infer consistency from a prior source-only review.

## After a destination state changes

The destination UI is the authority for its actual draft, scheduled, or published state. Immediately after a verified
schedule, Writer updates the archive metadata and the declared repository article record to identify the destination
URL, target, local slot and time zone, and actual state. The repository change may be status metadata only; preserve
the already reviewed body and visual identities. Writer verifies the remote commit and reads back both records.
Until these writes succeed, describe the release as scheduled in the destination with record synchronization pending;
the Writing run is not complete. Never rewrite a failed scheduling action as success to make records agree.

The `archive-record` returned after scheduling contains a three-surface reconciliation: destination UI evidence,
archive record and hash, remote repository path/commit and hash, matching reviewed body and visual inventory, and
the status transition. Reviewer may inspect a correction or release-gate diagnosis independently. A missing or
conflicting record returns to its owner and remains visible as incomplete.

Narration scripts and audio stay in the configured permanent article archive, normally its `audio/` folder. Record
their hashes and narrated article revision in review evidence; do not require or place the audio in the repository
mirror or publishing destination.

## Updating an already published story

Use the [published-update route](../flows/published-update.flow.md). During preparation, the public story deliberately
still shows the old revision. Record that as a proposed difference, with the old public state, exact replacement
revision, and authorized story URL; do not claim the three surfaces already match. Reviewer checks the proposed
archive and remote mirror against the destination preview before the edit. After Release Coordinator changes the same
public URL, Reviewer independently checks its rendered state, and Writer reconciles the archive, remote repository,
and live story. A saved editor view is not a live-page read-back. Keep the previous image and provenance in the
archive's history while updating the current selected-header index only after the replacement is visibly live.
