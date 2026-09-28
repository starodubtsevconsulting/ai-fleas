# Header-image selection contract

This is the single canonical header/hero-image contract for the Writing workflow. Writer and Reviewer must load this
same file. A review packet records its repository-relative path and exact content hash; copied or role-local variants
do not replace it.

## Ownership and shortlist

- Writer owns discovery or generation and supplies a fixed shortlist of no more than three profile-authorized
  candidates with previews and rights evidence. Reviewer does not search or expand it.
- Candidates may be human-supplied, licensed stock, or at most one image commissioned through the Writing workflow's
  profile-authorized `image_generation` capability. The profile selects its default provider; an explicit human
  instruction for the current task may select another profile-authorized provider without changing that default.
  No category wins automatically. Generation is optional and never preselects a winner.
- Publisher-specific stock discovery (for example imagery offered by a publishing destination) remains part of that
  destination's publishing flow; it is not an image-generation provider. Deterministic asset rendering such as Mermaid
  conversion is also separate from `image_generation`.
- Writer exposes the shortlist and this contract's path/hash through the Router result; the Router assigns them to Reviewer. A human-facing
  report is not delivery.
- Reviewer describes and compares each candidate, then returns exactly one recommendation or `none acceptable`.

## Prior-use check

Before recommending any candidate, Writer inventories earlier **selected** article headers in the configured article
archive, the declared repository mirror and its header-use index, and accessible destination stories. The repository
index is a durable lookup aid, not proof that an unlisted archive image was never used. Record each selected header's
article identity, repository-relative asset path, archive-relative asset path, source/photo ID when available, exact
SHA-256, destination story identity, and a short visual description. Writer updates the index when a selection is
actually used; rejected candidates are not recorded as used headers. When a public article has a repository mirror,
copy the selected rights-cleared header and its credit/provenance there so future Reviewers can inspect the image.

Reviewer independently checks every candidate against the index **and the underlying prior images**. Compare source
photo IDs, exact hashes, and visible content: renamed files, re-uploads, crops, color edits, and resized derivatives
can still be the same header. A previously used header is `reject` for a different article even when its new caption
or crop fits. If the index is incomplete, inspect the archive and destination history; do not treat absence from the
index as a uniqueness pass. Record the comparison scope and matched prior article in a durable finding. If all
candidates repeat earlier headers, return `none acceptable` and require a new bounded shortlist. Verify the selected
header remains represented consistently across the archive, repository mirror, and saved destination under
[article consistency](three-surface-consistency.md).

## Shared acceptance criteria

For every candidate, Writer must establish and Reviewer must independently verify:

1. Specific relevance to the article's subject and promise, reader interest, and absence of misleading implications.
2. A meaningful focal point and readable explanatory relationships at header size and after the actual destination crop.
3. One dominant visual story, clear spatial hierarchy, and purposeful placement of every prominent object.
4. Licensing, creator/source and credit evidence for supplied or stock work; generator, date, prompt/provenance, usage
   terms, and disclosure/credit needs for generated work.
5. A factual description of what is visibly shown, separated from inference, followed by strengths, weaknesses, and an
   explicit `accept` or `reject` verdict.

## Image text and subtitles

For article header/hero images, default to **no embedded article title, subtitle, tagline, or other editorial overlay**. The publishing surface normally renders the article title/subtitle separately, so repeating that copy inside the image is redundant and often harms cropping/reuse. Do not ask an image generator to render such text unless the article concept specifically requires visible text as part of the visual evidence or the human explicitly requests it. This default does not prohibit necessary in-scene labels when they are integral to the concept.

Treat every subtitle, tagline, caption, embedded heading, label, and callout associated with the image as editorial
copy. Writer must propose it from the exact article promise; Reviewer independently verifies that it accurately
expresses or advances the central idea, uses the article's terminology and tone, and does not introduce a broader,
different, exaggerated, or generic message. Decorative slogans and impressive-sounding text that do not clarify the
article are defects. Prefer no embedded subtitle when the image communicates better without one.

Verify spelling, grammar, factual meaning, role/object association, and consistency between embedded text, visible
objects, caption, alt text, article title/subtitle, and nearby passage. Text must remain legible at header size and
after the actual crop; no important words may be truncated or hidden. Generated-image text must receive literal
character-by-character inspection for malformed, duplicated, or invented words. The header candidate cannot be
accepted while any image text is inaccurate, unreadable, or mismatched to the article's idea.

A cinematic editorial infographic is a supported generated direction: a relevant human or lived-in context when
useful, a recognizable subject object, and restrained diagram overlays—nodes, paths, roles, or boundaries—anchored to
what they explain. Verify every depicted object, label, path, role, boundary, and relationship against the article.
Reject invented relationships, malformed or unreadable text, misleading devices/interfaces, excessive clutter, or
spectacle that outruns truth.

Generic AI “cozy productivity” filler—mugs/cups, loose paper or notebooks, stacked books, decorative desk clutter,
motivational posters, and similar props—is a weakness unless each item has an article-specific explanatory purpose.
Do not add slogans, titles, inspirational phrases, branding, or decorative writing to cups, mugs, clothing, books,
notebooks, wall art, device surfaces, or other props merely to make the image feel designed or thematic. Prefer
ordinary unlabelled objects or omit the prop entirely. Embedded text should exist only when the article concept
specifically requires that text to communicate the visual idea. Subdued environmental atmosphere is acceptable when
it recedes and does not compete with the subject. Do not copy a reference image's distinctive composition or
characters or depict a recognizable real person without authorization.

If all candidates fail, Reviewer returns `none acceptable` to Admin. Admin may ask Writer to prepare a new bounded shortlist for a new
review; neither role silently substitutes an image.
