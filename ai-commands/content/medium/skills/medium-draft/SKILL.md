---
name: medium-draft
description: Prepare and verify an unpublished Medium article draft from an authorized source, including editor formatting, diagrams, and topics. Do not use for publishing.
---

# Medium draft

Use this skill only through an authorized Medium destination command or an explicit human request to prepare a
Medium draft. It does not authorize publication, submission to a publication, scheduling, or edits to an already
published article.

1. Resolve the canonical article and metadata from the configured archive or the human's explicit source. Verify
   the signed-in Medium profile link equals the workflow's `account_profile_url`; stop on a mismatch. Check for an
   existing Medium draft URL before creating anything; preserve source attribution and publication state.
2. Open or import into the intended draft. Inspect the actual editor result: repair raw Markdown markers, lost
   emphasis, heading levels, lists, quotations, code, links, image placement, and title/subtitle. Do not trust an
   import success message as proof of formatting. Use Medium's native drop cap on the first prose paragraph when it
   suits the opening, and native three-dot section breaks at major narrative transitions. Keep meaningful section
   headings; do not add a divider before every heading or use literal ellipses as a substitute. Verify the rendered
   spacing and reading flow.
3. Give each draft a relevant lead image near the title. Prefer a suitable image supplied by the human; otherwise
   Writer may shortlist a stock photograph with verified reuse rights or commission one generated candidate through
   a profile-authorized image service such as GPT web. AI generation is an option, not the default winner and not a
   reason to exceed the three-candidate limit. A useful generated direction is a cinematic editorial infographic:
   a human-centered or lived-in scene when relevant, a recognizable subject object, and restrained diagram overlays
   such as nodes, paths, roles, or trust boundaries that explain the article visually. Do not copy a reference image's
   distinctive composition or characters, depict a recognizable real person without authorization, or let decorative
   complexity obscure the subject. Exclude generic AI “cozy productivity” filler—coffee mugs/cups, loose paper or
   notebooks, stacked books, decorative desk clutter, and similar props—unless a specific item materially explains the
   article. Subdued environmental context may establish mood, but it must not compete with the subject. Prefer one
   dominant visual story, a clear spatial hierarchy, and diagram overlays visibly anchored to the meaningful people,
   roles, objects, and boundaries they explain. Every prominent object must earn its place through the brief. Record
   stock creator/source/license, or for generated work record the service,
   generation date, prompt/provenance, and usage terms, plus any required credit in article metadata; add a visible
   credit when required or appropriate. Check the crop and appearance in the draft and its preview. If no suitable
   licensed image is available, leave the draft unpublished and report the missing lead image rather than using an
   unverified image.
4. For a diagram, keep its editable source in the archive and place a legible rendered image or clean screenshot of
   the rendered diagram in the draft. A fenced Mermaid block must be converted by rendering that exact source through
   an authorized Mermaid-capable renderer, then exporting a Medium-supported image such as PNG (or another format
   verified in the current editor). Do not paste Mermaid source, convert it into a paragraph beginning `Diagram—`, or
   treat alt text/caption as the visual. Crop editor chrome, preserve the complete diagram, use sufficient resolution,
   check desktop and narrow/mobile readability, and add useful alt text plus a caption when needed. Record the diagram
   source revision and exported asset with the article so later edits can be reproduced. AI generation is acceptable
   for diagrams only when it faithfully represents the verified source. Upload the asset, read the draft back, and
   visually verify that the diagram itself rendered beside the intended passage. If rendering or upload cannot be
   verified, keep the Medium draft unpublished and report `BLOCKED_DIAGRAM_RENDERING`; a labeled text explanation may
   aid accessibility but cannot replace a diagram the article claims to contain.
   Before editing Medium, build a complete source-diagram inventory with a stable ID, source location, intended article
   position, and source revision for every Mermaid fence and every diagram placeholder. Convert and verify every
   inventory item, not only the first one encountered, and record the uploaded asset/evidence against the same ID.
   Re-scan the finished Medium draft for leftovers. Arrow-chain prose such as `A → B → C`, `Diagram—` descriptions,
   Mermaid fences, raw diagram syntax, caption-only or alt-text-only blocks, and diagram placeholders are unresolved
   conversions unless the article explicitly intends them as ordinary prose. The number and identities of rendered
   destination diagrams must reconcile one-to-one with the source inventory; any mismatch leaves the draft unpublished
   with `BLOCKED_DIAGRAM_RECONCILIATION`.
5. Choose topics supported by the article's content and likely reader intent, within Medium's current limit.
   Verify they are attached to the draft and record them in article metadata. Do not add generic tags solely for reach.
6. Review the draft itself for section order, links, visuals, attribution, and readable layout. Return the draft URL,
   selected topics, and unresolved issues; update archive metadata and verify the read-back.
7. Stop at the unpublished draft. Leave Publish and Submit to the human. Release Coordinator alone may schedule later
   through the separately authorized Medium schedule skill; Writer must not press Schedule even if the editor offers it.
