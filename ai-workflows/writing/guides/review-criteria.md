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

The Writer dispositions findings and rechecks changed material. The human accepts the final revision directly or
through a valid session-scoped release mandate. The Reviewer
does not rewrite the article, mark it release-ready alone, or publish it.

## Rendered destination QA

When a destination draft exists, inspect the actual rendered draft rather than accepting editor fields, source text,
or metadata read-back as proof of presentation quality. Record the destination URL, revision, viewport or surface,
and direct visual evidence such as screenshots. Check the beginning, middle, and end of the article and inspect every
special block, including images and credits, blockquotes and attributions, headings, lists, separators, links, embeds,
captions, and any destination-specific substitution.

Make a rendered-image inventory from the top of the draft to the end, including the cover/hero, inline images, and
destination-added images. Compare their visible content as well as source asset identity; different crops, sizes,
uploads, or filenames do not make the same photograph a new visual. Match each occurrence to a distinct editorial
purpose and source mapping. A hero repeated directly after the title or subtitle is a substantive finding unless
the second use adds a clear, necessary explanation. Record both locations and screenshots so Writer can remove or
justify the repeat. Do not clear visual QA from a source-file inventory alone: a destination may insert the cover
separately and also render the source's lead image inline.

Inspect the rendered title, subtitle or deck, and first body heading together. Confirm that the subtitle uses the
destination's intended subtitle treatment and reads as secondary to the title, with suitable font, weight, size,
spacing, and wrapping. A subtitle displayed as a large bold heading or ordinary body paragraph is at least a
substantive formatting finding. Compare the visible result with any native subtitle field; a populated field does
not prove the text rendered in the right style or prevent a duplicate subtitle block in the body.

Reconcile every visual reference and label with what is actually rendered. Text such as `Diagram—`, `Figure`,
`Illustration`, a caption, alt-text fallback, credit, or prose that says “shown below/above” is not evidence that the
visual itself exists. Verify that the corresponding image, diagram, embed, or destination-safe substitute is visibly
present, legible, and adjacent to its label or explanatory passage. Flag orphaned labels/captions, failed uploads,
missing embeds, raw placeholders, and text-only diagram descriptions. A draft that claims a diagram but renders only
the words describing it has a substantive defect, and it is blocking when the missing visual is needed to understand
the argument.
Independently inventory the source revision's Mermaid fences and diagram placeholders, then reconcile stable identities
and counts against rendered destination visuals. Inspect the entire draft, not a sample. Treat arrow-chain prose such as
`A → B → C`, `Diagram—` descriptions, Mermaid fences or syntax, caption-only/alt-text-only blocks, and other serialized
diagram text as unresolved placeholders unless the article clearly intends ordinary prose. Reject destination visual
QA when any source diagram is missing or duplicated, any rendered visual has no source mapping, or any placeholder
remains—even if another diagram was converted successfully.

Cross-check every article-wide provenance, rights, and inventory claim against the actual source and rendered draft.
Statements such as “no third-party visuals,” “no quotations,” “all images are original,” or a claimed visual count must
agree with every header image, inline image, diagram, quotation, caption, credit, license record, and archived asset.
Do not clear a draft merely because each visual is individually acceptable: reject any global provenance statement
that contradicts an actually used asset, even when metadata elsewhere correctly credits that asset.

Look specifically for excessive or uneven padding and whitespace, collapsed or doubled spacing, detached quote
attributions or captions, awkward line wrapping, incorrect indentation, broken hierarchy, poor image sizing or
cropping, misplaced credits, and elements that appear orphaned from the content they describe. A blockquote with a
large empty gap between its quotation and attribution is a destination-rendering defect even when all text is present.
For every picture, verify editorial placement as well as rendering: it must appear next to the passage it supports,
in a sensible sequence, without interrupting or misleading the argument, and remain clearly associated with its
caption and credit. A correctly rendered picture in the wrong part of the article is a review finding.
Review the header or hero image through the canonical
[header-image selection contract](header-image-contract.md). Writer and Reviewer must use the same path and exact
content hash. This general review guide does not duplicate that contract. Missing direct shortlist delivery, contract
identity, or hash leaves the header-image gate pending.
Classify a defect as `blocking` when it makes the draft misleading, inaccessible, or unsafe to release, and at least
`substantive` when it visibly harms reading rhythm or professional presentation. Source equivalence alone cannot clear
rendered-destination QA. When the destination supports materially different narrow and desktop layouts, inspect both.

## Human-visible report

When the selected profile and workflow authorize `show-context`, the Reviewer may render its findings through that
command. Lead with the article's promise and a small visual only if it clarifies the review; then show what works,
prioritized weaknesses, passage-level evidence, method or template relevance, open questions, and the decision needed
from the Writer or human. Link the exact article revision and distinguish observation from inference. Keep generated
HTML outside version control. `show-context` presents the review; it does not perform or approve the review.
