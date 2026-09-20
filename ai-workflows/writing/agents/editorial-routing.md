# Writing editorial routing

Writer and Reviewer remain directly human-addressable. The only ordinary peer exchange is one bounded review
assignment from the exact Writer to the exact Reviewer, followed by the Reviewer's findings return to that Writer.
The [communication matrix](role-communication-matrix.csv) and [capability matrix](role-capability-ownership.csv) grant
these directions; this contract narrows their use. Writer coordinates the assignment but does not supervise or change
the Reviewer's independent judgment. No peer route to Release Coordinator, Judge, or Admin is granted.

For the [common compatibility ceiling](../../_common/policy/access-matrix.md), Writer is the supervising Worker only
for this bounded review assignment, and Reviewer is its assigned Worker only for this review. The reverse direction is
`RETURN_ONLY`: Reviewer can return evidence, a clarification question, a blocker, or terminal findings under the
accepted correlation, never assign Writer a different task or expand the scope. This coordination relationship does
not give Writer editorial control over independent critique.

## Writer handoff

After Writer completes its draft, editorial verification, archive record, and any selected unpublished destination draft,
it requests independent critique without making the human copy its report. A new or materially changed destination draft
requires this handoff in the same Writer-owned flow even when the article text already has an accepted disposition; no
second human request is required. Resolve the active Reviewer and Writer
from trusted platform receipts for the same `profileId`, `workflowId`, complete `logicalProjectId`, and `runtimeScopeId`.
Verify the Reviewer did not draft or edit the exact revision. Do not derive a target from a task title, folder name,
conversation memory, or a previous generation. If the Reviewer is unavailable or identity is uncertain, report the
handoff blocked to the human; do not create a substitute task or self-review.

Send one complete canonical packet under the [common communication contract](../../_common/agents/communication.md):

- A unique `correlationId`; exact `callerInstanceId`/`callerRole: writer`, `targetInstanceId`/`requiredExecutionRole:
  reviewer`, and `returnInstanceId`/`returnRole: writer`, all verified against active receipts.
- The four verified workflow coordinates, unchanged in every acknowledgement, correction, and return.
- Bounded intent: independently critique this exact unpublished article and destination draft, if one exists.
- Inputs: canonical archive article path and content revision/hash; destination draft URL, status, and revision when
  present; intended reader and effective article brief; source and visual-credit references; open editorial questions.
  Use references to authorized artifacts rather than pasting a full article into the packet.
- Authority: read and critique the stated revisions, prepare the configured listen-through, and present findings to
  the human. Prohibited effects include drafting or editing the reviewed revision, publishing, submitting, scheduling,
  accepting the human review gate, or changing the work target.
- Required evidence: passage-specific findings, the exact revisions inspected, independence/provenance check,
  listen-through status, and unresolved questions. When a destination draft exists, also require the exact rendered
  surface or viewport, direct visual evidence such as screenshots, and findings for every special block, including
  spacing, padding, blockquote attribution, captions, credits, wrapping, indentation, hierarchy, and image presentation.
  For every picture, require a finding on whether its editorial location supports the nearby passage and reading flow,
  follows a sensible sequence, and preserves its caption and credit association.
  Require a separate header-image finding covering specific relevance to the article's promise, reader interest,
  misleading implications, and whether its focal point survives the destination's actual crop; rendering alone is
  insufficient. The finding must describe visible content, separate observation from inference, state strengths and
  weaknesses, and return `accept` or `reject`. Writer owns search and must provide a fixed shortlist of at most three
  authorized candidates with licensing or credit evidence. Reviewer must not search or expand the shortlist; it must
  compare those candidates and return exactly one recommendation or `none acceptable`.
  Terminal condition: return one review disposition to this Writer.

Creating or changing a header-image shortlist automatically triggers delivery from Writer to the exact Reviewer. Use
the active correlation while it remains open; if the prior review is terminal, create a new revision-specific review
packet and correlation. A human-facing message, sidebar task update, or statement that candidates are pending is not
peer delivery and never satisfies this handoff. Writer must retain the delivery receipt and await Reviewer's selection
or report the exact delivery blocker.

The selected platform adapter sends to the verified target instance ID. Keep the accepted messaging receipt and
follow [common delivery](../../_common/agents/delivery.md): await the Reviewer's first-commentary `COPY THAT` and
terminal handoff before treating critique as received. Retry only after a definite failure with no accepted receipt.
If delivery remains unacknowledged, report `BLOCKED_DELIVERY_UNACKNOWLEDGED` with receipt and observed status to the
human. Writer may still report its own work complete, but must mark independent review pending.

## Reviewer return

Reviewer validates the packet against its trusted initialization header, its own capability, the exact Writer return
identity, and the article's revision before reading the payload or beginning critique. A mismatch blocks the packet.
Reviewer does not treat Writer's assertions or role label as proof of independence; it checks whether this same task
drafted or edited the revision. It acknowledges an accepted packet with `COPY THAT` in first commentary.

On completion, Reviewer sends a terminal findings packet to the original verified Writer using the same correlation,
four coordinates, exact return instance, reviewed revisions, evidence, and pending gates. The outgoing caller is the
exact Reviewer, and the outgoing target is the exact Writer. Reviewer also presents its human-facing report directly
to the human. A return is evidence for Writer's disposition, not a request for Reviewer to rewrite the article.
Writer acknowledges the return and owns any revision or explicit disposition. A materially changed revision needs a
new revision-specific review assignment; neither a correction nor an old review silently covers it.

## Remaining human handoffs

The human may still address Writer or Reviewer directly. Writer reports its archive and pending review to the human;
Reviewer reports critique and the human listen-through gate to the human. After Writer dispositions findings, the
human accepts or rejects the exact final revision. The human selects Release Coordinator for timing after review
readiness; Release Coordinator reports its slot and may schedule an accepted revision on Medium if the selected profile
enables that action. The human performs immediate publication or submission.
`show-context` is a human-facing presentation command, never peer transport.
