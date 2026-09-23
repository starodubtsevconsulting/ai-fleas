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
   For a native three-dot section break, place the caret in an empty paragraph at the intended boundary and invoke
   Medium's **Add a new part** action. In the current macOS editor, use `Command+Enter` (`Meta+Return`). Do not type
   `---`, `***`, literal ellipses, or Unicode dashes into the Medium editor as substitutes; they can become ordinary or
   malformed text. After insertion, verify that Medium created a real section divider, that subsequent content occupies
   a new section, and that the divider renders as three centered dots on desktop and narrow layouts. If the shortcut
   does not work, use the visible **Add a new part** control after confirming the caret is in the intended empty
   paragraph. The canonical Markdown article may continue to represent the same boundary with `---`; this native-editor
   rule applies only inside Medium.
3. Give each draft a relevant lead image near the title. Writer and Reviewer use the single canonical
   [header-image selection contract](../../../../ai-workflows/writing/guides/header-image-contract.md); this provider
   skill does not restate or override it. Record the selected candidate's required provenance/rights metadata, add any
   required visible credit, and verify its crop in the Medium draft and preview. If no candidate is accepted, leave the
   draft unpublished and report the unresolved header-image gate.
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
