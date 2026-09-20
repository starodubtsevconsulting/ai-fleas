# Article review criteria

Use this guide for the independent Reviewer in the [Writing workflow](../writing.workflow.md). It interprets the
existing [Blogging templates and methods](../../blogging/blogging.workflow.md); it does not replace them or create
publication authority.

## Effective review brief

The article brief records type, audience, intended reader outcome, selected template, applicable methods and their
emphasis, destination, and any human constraints. Start from the selected profile's `review_preferences` if present.
The article's actual type and explicit human direction may narrow or override those defaults. Record the effective
choices with the article so another reviewer can reproduce the check. Missing preferences do not justify inventing a
house style: use the selected template's defaults and explain uncertainty.

Emphasis is `high`, `normal`, or `low`; it controls attention in the critique, not a numeric score or a license to
ignore correctness. A method may be marked `not_applicable` with a reason. For example, Storyworthy is central to a
personal experience article but may be inapplicable to a direct teaching note with no firsthand narrative. Never
manufacture a personal story to satisfy a method.

## Review pass

1. Read the article once as the intended reader without editing it. State the article's apparent promise, what the
   reader learns or feels, and where attention or comprehension falters.
2. Check the selected template's audience contract, shape, constraints, and acceptance questions proportionately.
   Treat its shape as guidance, not a required outline.
3. Apply each selected method at its configured emphasis, citing the exact passage and the method's review question:
   [On Writing Well](../../blogging/methods/on-writing-well.md) for clarity and repetition,
   [Storyworthy](../../blogging/methods/storyworthy.md) for truthful narrative change when applicable, and
   [Why Nobody Reads Your Shit](../../blogging/methods/why-nobody-reads-your-shit.md) for the reader's reason to
   continue. Apply other explicitly selected methods the same way.
4. Separately check factual support, provenance, author voice, headline promise, accessibility and visual relevance,
   destination rendering, and material repetition. These checks remain even if a method is low-emphasis.
5. Return findings labeled `blocking`, `substantive`, or `optional`, each with a passage or observable evidence, why
   it matters to this reader, and a question or suggested direction. Report strengths and deliberate tradeoffs too.
   Do not use a single aggregate score to conceal a factual or ethical problem.

The Writer dispositions findings and rechecks changed material. The human accepts the final revision. The Reviewer
does not rewrite the article, mark it release-ready alone, or publish it.

## Rendered destination QA

When a destination draft exists, inspect the actual rendered draft rather than accepting editor fields, source text,
or metadata read-back as proof of presentation quality. Record the destination URL, revision, viewport or surface,
and direct visual evidence such as screenshots. Check the beginning, middle, and end of the article and inspect every
special block, including images and credits, blockquotes and attributions, headings, lists, separators, links, embeds,
captions, and any destination-specific substitution.

Reconcile every visual reference and label with what is actually rendered. Text such as `Diagram—`, `Figure`,
`Illustration`, a caption, alt-text fallback, credit, or prose that says “shown below/above” is not evidence that the
visual itself exists. Verify that the corresponding image, diagram, embed, or destination-safe substitute is visibly
present, legible, and adjacent to its label or explanatory passage. Flag orphaned labels/captions, failed uploads,
missing embeds, raw placeholders, and text-only diagram descriptions. A draft that claims a diagram but renders only
the words describing it has a substantive defect, and it is blocking when the missing visual is needed to understand
the argument.

Look specifically for excessive or uneven padding and whitespace, collapsed or doubled spacing, detached quote
attributions or captions, awkward line wrapping, incorrect indentation, broken hierarchy, poor image sizing or
cropping, misplaced credits, and elements that appear orphaned from the content they describe. A blockquote with a
large empty gap between its quotation and attribution is a destination-rendering defect even when all text is present.
For every picture, verify editorial placement as well as rendering: it must appear next to the passage it supports,
in a sensible sequence, without interrupting or misleading the argument, and remain clearly associated with its
caption and credit. A correctly rendered picture in the wrong part of the article is a review finding.
Review the header or hero image separately as an editorial choice. Verify that it clearly represents the article's
specific subject and promise rather than being merely decorative or broadly related; is interesting and useful to the
intended reader; does not imply a false subject; and retains a meaningful, legible focal point in the destination's
actual header crop. Compare the image against a more direct subject-specific alternative when the current choice is
generic—for example, prefer a recognizable NAS for an article specifically about NAS boundaries over an ambiguous
server-rack detail. A technically valid image that weakens or obscures the article's promise is a substantive finding.
Writer owns image search and supplies no more than three viable, profile-authorized candidates with licensing and
credit evidence. Reviewer does not search for candidates. The header-image finding must first describe only what is
visibly shown, distinguishing observation from guesses about the scene or object. It must then state what works, what
does not, and an explicit `accept` or `reject` verdict with a reason tied to the article and actual crop. Review the
Writer's fixed shortlist of at most three candidates. Describe each one,
compare relevance, interest, clarity, crop resilience, and licensing or credit evidence, then recommend exactly one;
if none is acceptable, say so instead of choosing the least-bad image. Reviewer critiques and recommends but does not
silently replace the image, search for alternatives, or expand the shortlist beyond three candidates.
Reviewer receives the shortlist through the verified Writer-to-Reviewer route. A human-facing Writer report is not an
input to Reviewer and cannot clear the selection gate; missing direct delivery leaves the image decision pending.
Classify a defect as `blocking` when it makes the draft misleading, inaccessible, or unsafe to release, and at least
`substantive` when it visibly harms reading rhythm or professional presentation. Source equivalence alone cannot clear
rendered-destination QA. When the destination supports materially different narrow and desktop layouts, inspect both.

## Human-visible report

When the selected profile and workflow authorize `show-context`, the Reviewer may render its findings through that
command. Lead with the article's promise and a small visual only if it clarifies the review; then show what works,
prioritized weaknesses, passage-level evidence, method or template relevance, open questions, and the decision needed
from the Writer or human. Link the exact article revision and distinguish observation from inference. Keep generated
HTML outside version control. `show-context` presents the review; it does not perform or approve the review.
