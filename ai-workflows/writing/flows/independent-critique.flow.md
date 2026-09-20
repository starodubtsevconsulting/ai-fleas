# Independent critique flow

## Purpose

[Writing](../writing.workflow.md), step 6. Challenge the finished, unpublished article before the human decides
whether to publish. This is a release-readiness check, separate from the drafter's own editorial verification.

## Entry

The exact archived article revision and its rendered destination draft, if any; intended reader, source trail, and
open editorial decisions. Keep both versions unpublished.

## Steps

1. Writer gives the exact initialized Reviewer a bounded [review assignment](../agents/editorial-routing.md) for the
   finished revision. Include a clean reading copy, intended audience, effective article template and method emphasis,
   and the minimum sources needed to check claims. Reviewer verifies it did not draft or edit this revision. A
   separate fresh-context AI task or a human reader may do this only when separately authorized; the drafter's own
   second pass does not count as independent. Proof: exact reviewer identity, revision, packet correlation, and scope.
   When a destination draft was created or materially changed after an earlier article-only review, Writer must initiate
   a new assignment automatically and include the exact destination URL, state, destination revision, formatting and
   visual substitutions, topics/tags, and the canonical article revision. A prior article-only disposition does not
   review the later destination representation.
2. Reviewer generates a computer-narrated preview with the
   [article read-aloud skill](../skills/article-read-aloud/SKILL.md) and gives the human author a first-pass
   listen-through. Keep the text available for checking exact claims. Ask what sounds inaccurate, unlike their voice,
   over-explained, awkward, or missing. Record feedback or `pending human listen-through`; producing or playing audio
   is not itself approval. The author need not read aloud. Proof: a playable narration or verified live read-aloud,
   narrated revision, and feedback tied to that revision.
3. The Reviewer follows the [review criteria](../guides/review-criteria.md), reads as a skeptical intended reader,
   and identifies specific, prioritized weaknesses: unclear promise or title, unsupported or overstated claims,
   missing counterpoints, weak logic, confusing structure, unearned emotional beats, tone drift, visual problems, and
   what a reader might misunderstand or stop reading at.
   Ask specifically where the same idea appears again without advancing it, while distinguishing a deliberate
   callback or refrain. Request evidence and suggested questions, not a blanket rewrite or praise. Proof: a
   critique tied to passages. For a destination draft, Reviewer must also directly inspect its rendered presentation,
   record the viewport or surface and visual evidence, and check every special block for excess padding, broken spacing,
   detached attribution or captions, awkward wrapping, image and credit placement, indentation, and hierarchy. Textual
   equivalence or metadata read-back cannot substitute for this visual pass. For every picture, Reviewer must judge
   whether it is located beside the passage it supports, appears in a sensible sequence, preserves the reading flow,
   and remains associated with its caption and credit; correct rendering alone does not prove correct placement.
   Reviewer must separately validate the header image against the article's specific subject and promise, reader
   interest, possible misleading implications, and the focal point retained by the destination's actual crop. A
   generic broadly related image must be challenged when a clearer subject-specific image would communicate better.
   Its finding must describe what is visibly present, separate observation from inference, list what works and fails,
   and return `accept` or `reject`. Writer owns search and supplies a fixed shortlist of no more than three authorized
   candidates with licensing and credit evidence. Reviewer does not search; it compares that shortlist and recommends
   exactly one based on relevance, interest, clarity, crop resilience, and licensing or credit evidence, or reports
   when none passes rather than broadening the shortlist or silently replacing the image.
   As soon as Writer prepares or changes that shortlist, Writer must send it directly to the exact Reviewer under the
   active review correlation, or a new revision-specific correlation if the earlier review is terminal. Reporting the
   shortlist or its status to the human does not deliver it to Reviewer and does not complete the image-review gate.
4. When `show-context` is enabled by the selected profile and writing workflow, the Reviewer uses it to present a
   bounded, human-readable review report: what works, what needs work, severity, supporting passages, and the next
   decision. The critique remains the source of judgment; `show-context` only renders it and must not imply approval.
   This report is for the human, not an agent-to-agent message or handoff protocol.
   Keep any generated HTML outside version control and provide its recoverable location. If the command is unavailable,
   provide the same evidence in Markdown. Proof: the review artifact and source revision.
5. Reviewer returns findings to the exact Writer through the accepted packet's return route and presents them to the
   human. Writer resolves each consequential point by revising, checking a source, or recording why it remains
   unresolved or is an intentional choice. Recheck any changed claim or destination formatting. Proof: a disposition
   list tied to the resulting article and draft revisions. A materially changed revision requires a new review request.
6. Hand the resulting draft and remaining risks to the human author for a final read or computer-narrated listen.
   The author decides whether the piece sounds like them and is ready to release. Record their decision if given;
   silence is not approval. Proof: author feedback or an explicit `pending human review` state.

## Exit

Mark release review complete only when the independent critique is addressed and the human has reviewed and accepted
the exact final revision; then continue to [release planning](release-planning.flow.md). Otherwise hand off the
unpublished draft with the pending gate and next action. Any later material edit invalidates the affected review
evidence. This flow never publishes, submits, or schedules.
