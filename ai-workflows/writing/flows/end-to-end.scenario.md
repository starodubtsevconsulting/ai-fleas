# Writing workflow end-to-end test scenario

Use this scenario to exercise one initialized, exact-scope Writing roster and its host Router. It is a live test only when every observed result below has a current receipt. A contract test or a role's narrative cannot stand in for a host dispatch, human action, or Medium state read-back.

## Fixture and safeguards

1. Select an explicitly configured profile, Writing workflow, saved project, logical project, article archive, and destination account. Verify each role task's active host binding and readiness token against the task catalog. Record the current workflow map version and the run's Router correlation IDs.
2. Create a new, clearly labeled, nonconfidential test article with a unique title. Record its archive path and exact revision. Do not reuse a production article, alter an existing scheduled story, or treat another article's review as evidence.
3. Resolve the destination from the selected profile. If the test includes live scheduling, obtain the human's authorization for that external effect and target before starting. Keep Writer's destination representation unpublished.

## Expected route

| Step | Action and observation | Required evidence |
| --- | --- | --- |
| Initialization | Initialize Admin, Writer, Reviewer, and Release Coordinator through the platform lifecycle. | Exact active task IDs, scope, project binding, and readiness tokens. |
| Writer | Send the fresh request through the host's ordinary user ingress. Writer creates archive copy, metadata, and one unpublished destination draft, then returns `review_requested`. | Exact article revision, saved draft URL and rendered inspection, durable review packet, and Router result/dispatch receipt to Reviewer. |
| Independent review | Reviewer checks the exact archive and rendered destination. Verify title, subtitle style, image order and duplicates, visual completeness, facts, and links. Corrections return `changes_required` with findings to Writer, then a changed packet returns to Reviewer. | New review reference tied to exact article and destination revisions; any correction loop has distinct packet/revision evidence. |
| Narration | Reviewer synthesizes the exact reviewed revision with autoplay disabled and offers a playable control to the human. It asks for listening and feedback and returns `human_action_required`. | Audio location, revision binding, human-action reference, `listen_pending`/`human_review` Router state. A generated file alone does not count as an offer. |
| Human gate | The human listens and explicitly confirms listening to that narration. Reviewer returns `human_listened`; when separate article acceptance is enabled, obtain that decision too. | Revision-bound human-listen evidence, review reference, Router transition to release. Playback or silence is not confirmation. |
| Release | Release Coordinator verifies the exact gate, destination, schedule policy and history; schedules a future slot if authorized; reads the destination back. | Scheduled state, destination URL, slot with time zone, and `released` result. A proposed slot is not a scheduled state. |
| Archive closure | Router assigns Writer `archive_update` from the release record. Writer verifies Medium's scheduled state and updates the canonical article metadata. | Saved `archive-record` with scheduled URL, local slot, time zone, review revision, and listening classification; terminal `archived` result. |

## Simulation variant

For a rehearsal, an authorized human may explicitly request a **test-only simulated listening agreement** and, separately, live scheduling of the exact labeled test article. Record it as simulated and never say that the human heard the audio. After the actual narration offer and Router human wait, Reviewer returns `test_listen_simulated` with `review` and distinct `test-listen-simulation` evidence bound to the exact revision, audio, draft, authorization, and target. Release Coordinator may schedule only that clearly labeled test article after checking this evidence and the ordinary account, target, timing, and read-back gates. Never convert simulation into `human-listen` evidence or apply this path to a production article. If the human did not authorize live test scheduling, stop at `human_review`.

## Failure and recovery checks

- A missing task binding, stale correlation, missing packet, failed dispatch, or unchanged correction must leave the run at the last valid stage with a precise blocker; fix the cause and resume the same run.
- Two `review/changes_required` results in one correlation with different findings must each dispatch to Writer once. Repeating either exact result must not dispatch again.
- Missing audio offer or listening confirmation must keep release closed, even when editorial review passed and article acceptance is disabled.
- A stale or mismatched article, destination, review, audio, or human-action revision must not advance.
- A schedule action is complete only after a destination read-back shows the exact test article and future scheduled time.
- Compare the scheduling dialog's time-zone-labeled slot with the story list. Record any unlabeled list time separately; do not infer it uses the configured local time zone.
- Once the selected policy and explicit test scheduling authorization pass, Release Coordinator must perform the final **Schedule to publish** click without a second approval prompt. Returning `review_required` with already-proven gate evidence is a failure.

Record each observed receipt and its source in the run report. Mark unobserved steps pending or blocked, not passed.

## Run report template

Copy this block for each run; keep local profile paths, task IDs, and private URLs in the run record rather than this reusable scenario.

```text
Run date / test title:
Profile / workflow / saved project / logical project / runtime scope:
Roster task IDs and readiness receipts:
Workflow map version and article revision:
Destination account / target / draft URL:
Writer result and Router review dispatch receipt:
Review findings and correction loop receipts (if any):
Passing review revision and rendered visual checks:
Narration file / offer / human-wait receipt:
Human confirmation OR explicitly labeled test simulation receipt:
Release result / Medium scheduled URL / time-zone-labeled slot:
Writer archive update / metadata hash / terminal result:
Unresolved blocker or recovery action:
```
