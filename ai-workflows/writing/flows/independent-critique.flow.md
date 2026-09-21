# Independent critique flow

## Purpose

[Writing](../writing.workflow.md), step 6. Challenge the finished, unpublished article before the human decides
whether to publish. This is a release-readiness check, separate from the drafter's own editorial verification.

## Entry

The exact archived article revision and its rendered destination draft, if any; intended reader, source trail, and
open editorial decisions. Keep both versions unpublished.

## Steps

1. Writer returns a complete proposed review packet to Admin. Admin validates it and gives the exact initialized Reviewer
   a bounded [review assignment](../agents/editorial-routing.md) for the
   finished revision. Include a clean reading copy, intended audience, effective article template and method emphasis,
   and the minimum sources needed to check claims. Reviewer verifies it did not draft or edit this revision. A
   separate fresh-context AI task or a human reader may do this only when separately authorized; the drafter's own
   second pass does not count as independent. Proof: exact reviewer identity, revision, packet correlation, and scope.
   When a destination draft was created or materially changed after an earlier article-only review, Writer must return
   a new proposed assignment to Admin automatically and include the exact destination URL, state, destination revision, formatting and
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
   For header images, both roles load the canonical
   [header-image selection contract](../guides/header-image-contract.md) using the packet's repository-relative path and
   exact content hash. This flow does not restate its criteria. Reviewer returns its bounded verdict under that exact
   contract revision.
   As soon as Writer prepares or changes that shortlist, Writer must return it to Admin under the active parent
   correlation. Admin dispatches it to Reviewer under a new revision-specific child correlation. Reporting the
   shortlist or its status to the human does not complete the image-review gate.
   Reviewer must also reconcile every `Diagram`, `Figure`, `Illustration`, caption, credit, visual cross-reference, or
   placeholder with an actually rendered visual. A label or textual description does not count as the diagram/image;
   missing, failed, or orphaned visuals must be reported with direct rendered evidence.
   Build an independent source-diagram inventory and reconcile every stable ID and count with the rendered destination.
   Scan the full draft for residual arrow chains, `Diagram—` prose, Mermaid fences/syntax, caption-only blocks, and
   placeholders. One successful diagram replacement does not clear other inventory items or residual placeholders.
4. When `show-context` is enabled by the selected profile and writing workflow, the Reviewer uses it to present a
   bounded, human-readable review report: what works, what needs work, severity, supporting passages, and the next
   decision. The critique remains the source of judgment; `show-context` only renders it and must not imply approval.
   This report is for the human, not an agent-to-agent message or handoff protocol.
   Keep any generated HTML outside version control and provide its recoverable location. If the command is unavailable,
   provide the same evidence in Markdown. Proof: the review artifact and source revision.
5. Reviewer returns findings to Admin through the accepted packet's return route and presents them to the human. Admin
   validates and sends consequential findings to Writer. Writer resolves each point by revising, checking a source, or recording why it remains
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
