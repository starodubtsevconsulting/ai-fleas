# Flow contracts and Admin simulation acceptance

Use these read-only tabletop cases to review the [planning flow](planning.flow.md) and
[Admin local execution](../../_common/roles/admin.md#admin-can). They evaluate contract decisions, not live
execution, transport, or roster readiness. No case authorizes mutation or activation. Record the outcome and owning
source for each case; do not present tabletop success as an independent or live acceptance receipt.

| Case | Given | Required outcome |
| --- | --- | --- |
| Small change | One authorized repository, clear outcome, no tracker synchronization requirement. | Short flat plan, explicit owners/evidence, justified tracker not-applicable status; return to implementation without adding a mandatory diagram or deployment gate. |
| Resume | Two requirements have current verified evidence; one remains incomplete. | Preserve the completed baseline and plan only remaining work and closure gates. |
| Component plan | A contract component must precede a consuming service, with different delivery and verification needs. | Named numbered component checklists follow dependency order, with one owner/evidence per step, consistent design/diagram when needed, and independent applicability decisions per component. |
| Plan drift | New evidence invalidates a dependency or acceptance assumption before the next step. | Pause affected work, preserve valid evidence, resolve the material decision with the planning owner/human, and update the recovery point; ordinary failed checks instead use bounded correction without a new approval cycle. |
| Failed prerequisite | A required persistence or validation gate fails after earlier steps passed. | Preserve earlier evidence, block the dependent step, record owner/next action, and resume at the failed gate. |
| Explicit simulation | Verified Admin, human-requested local execution under existing repository authority, and a configured owner whose command prerequisites pass. | Execute locally with real Admin identity and separate acting-owner trace; no peer dispatch or roster replacement. |
| Missing authority | Only an Admin label or an unverified task scope. | Missing identity blocks mutation; existing authorization is not replaced by labels or an additional simulation permission gate. |
| Invalid owner or scope | A simulated step names an undeclared owner, a prohibited capability, or a foreign workflow target. | Block before execution; tool availability and simulation do not widen authority. |
| Unsupported command | A command rejects the real Admin identity or cannot accept the authorized mode. | Preserve the blocker; do not impersonate another agent or bypass the command. |
| Independent gate | Admin implemented the work, then changes its label to Reviewer or UI Tester. | Local rehearsal is possible; required independent acceptance remains blocked. Draft PR evidence must disclose that gap. |
| Judge recovery | Unreliable agents block governance work; the human requests verified Admin to perform Judge's work on the exact target under the existing repository Admin exception. | Admin validates and faithfully maintains human-authored rules locally, records actual evidence as Admin acting as Judge, and can satisfy Judge-owned gates without a separate Judge agent. Explicit independence gates remain binding. |
| Candidate drift | Checks passed before the source, base, artifact, or relevant environment changed. | The testing flow reassesses validity and reruns invalidated gates for the new candidate; different-revision success cannot establish readiness. |
| Behavioral proof | A smoke process exits successfully but required event or persistence effects are absent. | Testing rejects incomplete behavioral proof, preserves observations, and debugging returns a verified correction to that exact failed gate. |
| Documentation drift | Current implementation contradicts a durable contract claim during review. | Documentation corrects the affected facts through their owners and repeats checks/review; conflicting authoritative sources block the disputed claim. |
| Demo confirmation | Automated setup and UI checks pass, but a required human observation is unconfirmed. | Demo retains fixture provenance and its resume point; preparation and automated acceptance do not count as human confirmation. |
| Runtime identity | Deployment dispatch succeeds, but the runtime exposes a different candidate or fails a required behavior check. | Deployment remains incomplete; preserve candidate/target/run evidence, debug, and repeat readiness/runtime checks for any corrected candidate. |
| Missing route or authority | A planned diagnostic/deployment operation has no enabled registered provider route or lacks exact effect/target authorization. | Block that operation without guessing a provider, reconstructing raw mechanics, changing production, or widening the work target. |
| Utility evidence | Admin delegates a bounded read-only reference or duplicate check while continuing independent work. | Helper returns factual supporting evidence without mutation or peer communication; Admin verifies it and owns any correction or decision. |
| Utility substitution | A helper is asked to approve rules, replace Judge/Reviewer, advance a plan, mutate state, spawn helpers, or merely poll unchanged work. | Reject that use; utility output supplies no workflow-role, approval, independent acceptance, or external-effect authority. |

Live adapter acceptance, if separately requested, must use an exact initialized scope and its normal readiness and
authorization rules. The declarative contracts do not implement or activate a new adapter execution mode.
