---
name: medium-schedule
description: Schedule an article that passed the active workflow's review and acceptance policy for future publication with Medium's native scheduler.
---

# Medium schedule

Before navigating Medium, read the [desktop navigation map](references/medium-navigation.md). Use it as orientation,
then inspect the live page with available browser or computer vision tools. Labels and layout may change; choose the
control by its current meaning and the exact story/account evidence, not by a saved pixel coordinate or row position.

Use only as the active Writing Release Coordinator through the selected profile's `medium` command. Require the
workflow destination and its command override to use `draft-and-schedule`; require
`release_policy.scheduling.enabled: true`, `allowed_role: release-coordinator`,
an explicit boolean `requires_human_article_acceptance`, and `per_item_approval_required: false`. The profile-wide command default
may remain `draft-only`. Never infer this grant from a human request to plan a release, an account login, or a cadence
target.

1. Verify the complete independent review and Writer disposition for the exact final article and intended unpublished
   Medium draft. If `requires_human_article_acceptance` is true, also read direct acceptance of that revision or a
   preserved valid session-scoped release mandate. If false, the successful independent review itself authorizes
   future scheduling; do not wait for another article-acceptance or timing reply. Resolve the canonical archive article
   and verify that the draft reflects the reviewed revision, including title, body, links, visuals, and topics. Stop on a mismatch or
   any material change. Medium may publish edits to a scheduled story automatically at the scheduled time.
2. Verify the signed-in Medium account's profile link against the workflow's `account_profile_url`. Inspect published
   and scheduled stories and reconcile them with archive records. If queue/history is incomplete, stop and report it.
3. Choose a future date and time using the destination's configured time zone. Check the maximum posts per local day,
   the configured weekly minimum as a planning target, existing scheduled stories, and any human priority. Resolve the
   publication target from an explicit article selection or the profile's `publication_target: profile-home` policy;
   for profile/home, verify the signed-in profile is the configured `account_profile_url`. If neither target source is
   present, request target selection and pause. Record the candidate and evidence before changing Medium. A weekly
   target never overrides the configured review and acceptance gate or the cap.
4. In the intended Medium draft's desktop editor, use Medium's native **Publish** dialog, choose **Schedule for
   later**, enter the chosen date and time, and select **Schedule to publish**. The initial **Publish** control opens
   the scheduling dialog; do not choose an immediate publication action or submit to a publication. Medium uses the
   browser/account local time shown in its scheduling UI, so translate the configured time zone and verify the exact
   displayed date and time before the final scheduling action. Stop if the conversion cannot be verified.
5. Read back Medium's scheduled status, story URL, and date/time. Save the reviewed revision identifier, account,
   scheduled instant, configured local time and time zone, Medium URL, and evidence to the article archive; read it
   back. Tell the human the result. If Medium confirms scheduling but the archive update fails, report the Medium
   state and repair the record before starting another release. If scheduling is uncertain, inspect the queue before
   retrying so the action is not duplicated.

No extra per-item scheduling approval is required after the configured review and acceptance gate passes. When every
gate passes, schedule in the current release stage and verify Medium's scheduled state; a proposed slot alone is unfinished.
An in-scope correction needs renewed independent review. When the policy requires human acceptance, a revision inside
an existing mandate needs no repeated human wording; a revision outside it needs new human authorization. Never
publish immediately, submit to a publication, create a recurring release automation, or claim success from a proposed
slot alone.
