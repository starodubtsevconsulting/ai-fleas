# Release planning flow

## Purpose

[Writing](../writing.workflow.md), step 7. Select an appropriate release slot after the article has passed review.
An explicitly enabled Medium destination requires Release Coordinator to attempt native future scheduling as soon as
the exact article has a complete release gate, a resolved publication target, and a verified eligible slot. No separate
per-item scheduling approval is required. Other destinations remain recommendation and human handoff flows.

## Entry

The Router's release-stage envelope: exact archived article, selected destination set and each destination draft/revision, source and visual credits, review evidence, and outstanding issues. Resolve and gate each selected destination independently through the selected profile's binding, then inspect publication history for each account. A missing review gate permits a pending-status handoff, not
a release-ready recommendation.

## Steps

1. Verify that independent critique is addressed for the exact article and rendered destination revision. Apply the
   active `requires_human_article_acceptance` policy: when true, also require direct human acceptance or a valid
   [session-scoped release mandate](../guides/session-release-authorization.md); when false, a complete successful
   independent review satisfies the editorial decision. If profile `review_preferences.listen_through.enabled` is true,
   separately require the author's revision-bound confirmation of listening before release; an offered or played audio
   file alone is insufficient. When review or listening evidence
   is missing, stale, conflicting, or ambiguous, expose one precise blocker event to the Router; do not contact Reviewer or
   make the human relay the question. The Router assigns diagnosis or revision work to the proper owner and may send a verified
   continuation packet back. If acceptance or review still is not proven, record the missing gate and do not mark the
   article release-ready. Proof: review record and exact revision identifiers, Router continuation when used, or status.
2. Resolve the exact publication target separately from the provider account and schedule: for Medium, either the
   author's profile/home or one named Publication that the signed-in account is verified and authorized to use. Use an
   explicit article selection or a human-authorized `publication_target: profile-home` in the selected workflow policy.
   For that standing profile/home target, verify the signed-in profile matches the configured account before acting.
   Otherwise present the verified choices and ask the human where this exact revision should be published. A destination account,
   existing draft, previous article target, UI default, or absence of a response alone does not select profile/home.
   The sole-target resolution in the authorization contract applies only after the human was shown that limitation.
   If target choices cannot be verified, record
   `BLOCKED_PUBLICATION_TARGET`; do not schedule. Proof: revision-bound human selection, target type and exact name/ID,
   account authorization evidence, and supported action (`schedule` or `submit`).
3. Read the active destination's profile-owned `release_policy`, including its time zone, maximum posts per local
   calendar day, and any configured `min_posts_per_local_week`, `target_interval_days`, preferred days, or time window.
   A weekly minimum is a planning target for each Monday–Sunday week in that time zone. The target interval is the
   preferred minimum number of local calendar days between posts. Neither is an automatic publishing trigger. Use only
   settings in that destination binding; do not carry Medium's cadence to another platform.
   If no policy is configured, ask for a cadence decision or report release timing as undecided. Proof: selected
   destination, account, and effective policy.
4. Verify the selected target's latest published posts and any already planned releases using the article archive's
   publication records and, when authorized and available, the destination account. Distinguish published,
   scheduled, draft, and proposed items. If history is incomplete or conflicting, do not claim a free slot. Proof:
   timestamps, time zone, and source of each relevant event.
5. Once review, target, and history are verified, count published and confirmed scheduled posts in the candidate local week.
   When a weekly minimum is configured and fewer than that many releases are accounted for, prioritize eligible days
   that close the gap, subject to the daily cap, article readiness, existing queue, and the human's priorities. Count
   proposed days separately from confirmed releases. If too few reviewed articles or eligible days remain, report the
   shortfall rather than claiming the target is met. Propose the earliest eligible day and any better editorial option
   (today, tomorrow, or later), explaining what would change the recommendation. The daily cap is a ceiling; a weekly
   target does not waive review or require filling every open day. Proof: a dated recommendation, candidate-week count,
   and checked constraints.
6. For a destination or selected publication target without explicit scheduling authority, report the proposed day and status as `proposed` and hand
   the draft, readiness evidence, and timing recommendation to the human. For Medium `draft-and-schedule`, verify the
   workflow override and `release_policy.scheduling` enable `release-coordinator`, apply the configured article
   acceptance and listen-through policies, and waive the separate per-item scheduling approval. Match the archive revision
   to the intended Medium draft, verify the signed-in account, and verify the selected publication target is still
   active and supports native scheduling. Select a future slot that obeys the daily cap and
   known queue. Use the [Medium schedule skill](../../../ai-commands/content/medium/skills/medium-schedule/SKILL.md)
   to schedule through Medium's native UI; read back the scheduled status and exact date/time. Do not stop at a slot
   proposal or ask for another timing approval when every gate passes. Return the verified
   slot, time zone, draft URL, revision, exact publication target, and UI evidence to the human and Router without
   writing repository files. Any required archival update belongs to Writer. If any gate or
   read-back fails, leave or report the state as unresolved; do not claim scheduling succeeded. Never publish
   immediately, submit to a publication, silently fall back to profile/home, or create a release automation from this
   flow. If the selected Publication uses submission rather than supported native scheduling, leave the draft
   unpublished and hand that exact target and action to the human.

## Exit

Hand off a verified scheduled Medium story, an unpublished draft with a justified recommendation, or an explicit
pending gate. Release Coordinator remains repository read-only after publication; it returns the verified timestamp
and URL so Writer can perform any required archive update. A new publication or queue change invalidates a prior slot
recommendation.
