# Release planning flow

## Purpose

[Writing](../writing.workflow.md), step 7. Select an appropriate release slot after the article has passed review.
An explicitly enabled Medium destination permits Release Coordinator to schedule an accepted article without a
separate scheduling approval. Other destinations remain recommendation and human handoff flows.

## Entry

The Writer's handoff: exact archived article and unpublished destination-draft revisions, source and visual credits,
review evidence, outstanding issues, and selected destination. Resolve that destination through the selected profile's
binding, then inspect publication history for its account. A missing review gate permits a pending-status handoff, not
a release-ready recommendation.

## Steps

1. Verify that independent critique is addressed and the human accepted the exact final revision. If not, record the
   missing gate and do not mark the article release-ready. Return editorial issues to the Writer. Proof: review record
   and exact revision identifiers, or an explicit pending status.
2. Read the active destination's profile-owned `release_policy`, including its time zone, maximum posts per local
   calendar day, and any configured `min_posts_per_local_week`, `target_interval_days`, preferred days, or time window.
   A weekly minimum is a planning target for each Monday–Sunday week in that time zone. The target interval is the
   preferred minimum number of local calendar days between posts. Neither is an automatic publishing trigger. Use only
   settings in that destination binding; do not carry Medium's cadence to another platform.
   If no policy is configured, ask for a cadence decision or report release timing as undecided. Proof: selected
   destination, account, and effective policy.
3. Verify the account's latest published posts and any already planned releases using the article archive's
   publication records and, when authorized and available, the destination account. Distinguish published,
   scheduled, draft, and proposed items. If history is incomplete or conflicting, do not claim a free slot. Proof:
   timestamps, time zone, and source of each relevant event.
4. Once review and history are verified, count published and confirmed scheduled posts in the candidate local week.
   When a weekly minimum is configured and fewer than that many releases are accounted for, prioritize eligible days
   that close the gap, subject to the daily cap, article readiness, existing queue, and the human's priorities. Count
   proposed days separately from confirmed releases. If too few reviewed articles or eligible days remain, report the
   shortfall rather than claiming the target is met. Propose the earliest eligible day and any better editorial option
   (today, tomorrow, or later), explaining what would change the recommendation. The daily cap is a ceiling; a weekly
   target does not waive review or require filling every open day. Proof: a dated recommendation, candidate-week count,
   and checked constraints.
5. For a destination without explicit scheduling authority, record the proposed day and status as `proposed` and hand
   the draft, readiness evidence, and timing recommendation to the human. For Medium `draft-and-schedule`, verify the
   workflow override and `release_policy.scheduling` enable `release-coordinator`, require human acceptance of the
   exact final article revision, and waive only the separate per-item scheduling approval. Match the archive revision
   to the intended Medium draft and verify the signed-in account. Select a future slot that obeys the daily cap and
   known queue. Use the [Medium schedule skill](../../../ai-commands/content/medium/skills/medium-schedule/SKILL.md)
   to schedule through Medium's native UI; read back the scheduled status and exact date/time. Record the verified
   slot, time zone, draft URL, revision, and evidence in the archive, then report it to the human. If any gate or
   read-back fails, leave or report the state as unresolved; do not claim scheduling succeeded. Never publish
   immediately, submit to a publication, or create a release automation from this flow.

## Exit

Hand off a verified scheduled Medium story, an unpublished draft with a justified recommendation, or an explicit
pending gate. After publication, record the verified publication timestamp and URL in the archive before planning the
next article. A new publication or queue change invalidates a prior slot recommendation.
