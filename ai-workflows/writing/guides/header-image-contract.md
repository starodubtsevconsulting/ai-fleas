# Header-image selection contract

This is the single canonical header/hero-image contract for the Writing workflow. Writer and Reviewer must load this
same file. A review packet records its repository-relative path and exact content hash; copied or role-local variants
do not replace it.

## Ownership and shortlist

- Writer owns discovery or generation and supplies a fixed shortlist of no more than three profile-authorized
  candidates with previews and rights evidence. Reviewer does not search or expand it.
- Candidates may be human-supplied, licensed stock, or at most one image commissioned through a profile-authorized
  generator such as GPT web. No category wins automatically. Generation is optional and never preselects a winner.
- Writer sends the shortlist and this contract's path/hash directly to Reviewer. A human-facing report is not delivery.
- Reviewer describes and compares each candidate, then returns exactly one recommendation or `none acceptable`.

## Shared acceptance criteria

For every candidate, Writer must establish and Reviewer must independently verify:

1. Specific relevance to the article's subject and promise, reader interest, and absence of misleading implications.
2. A meaningful focal point and readable explanatory relationships at header size and after the actual destination crop.
3. One dominant visual story, clear spatial hierarchy, and purposeful placement of every prominent object.
4. Licensing, creator/source and credit evidence for supplied or stock work; generator, date, prompt/provenance, usage
   terms, and disclosure/credit needs for generated work.
5. A factual description of what is visibly shown, separated from inference, followed by strengths, weaknesses, and an
   explicit `accept` or `reject` verdict.

A cinematic editorial infographic is a supported generated direction: a relevant human or lived-in context when
useful, a recognizable subject object, and restrained diagram overlays—nodes, paths, roles, or boundaries—anchored to
what they explain. Verify every depicted object, label, path, role, boundary, and relationship against the article.
Reject invented relationships, malformed or unreadable text, misleading devices/interfaces, excessive clutter, or
spectacle that outruns truth.

Generic AI “cozy productivity” filler—mugs/cups, loose paper or notebooks, stacked books, decorative desk clutter, and
similar props—is a weakness unless each item has an article-specific explanatory purpose. Subdued environmental
atmosphere is acceptable when it recedes and does not compete with the subject. Do not copy a reference image's
distinctive composition or characters or depict a recognizable real person without authorization.

If all candidates fail, Reviewer returns `none acceptable`. Writer may prepare a new bounded shortlist for a new
review; neither role silently substitutes an image.
