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
   choose a stock photograph with verified reuse rights. Do not generate a photographic lead image with AI by
   default. Record its creator, source URL, license, and any required credit in article metadata; add a visible
   credit when required or appropriate. Check the crop and appearance in the draft and its preview. If no suitable
   licensed image is available, leave the draft unpublished and report the missing lead image rather than using an
   unverified image.
4. For a diagram, keep its editable source in the archive and place a legible rendered image or clean screenshot of
   the rendered diagram in the draft. Crop editor chrome, check mobile readability, and add useful alt text or a
   caption. AI generation is acceptable for diagrams. If rendering cannot be verified, use a labeled text
   explanation and flag the missing visual.
5. Choose topics supported by the article's content and likely reader intent, within Medium's current limit.
   Verify they are attached to the draft and record them in article metadata. Do not add generic tags solely for reach.
6. Review the draft itself for section order, links, visuals, attribution, and readable layout. Return the draft URL,
   selected topics, and unresolved issues; update archive metadata and verify the read-back.
7. Stop at the unpublished draft. Leave Publish and Submit to the human. Release Coordinator alone may schedule later
   through the separately authorized Medium schedule skill; Writer must not press Schedule even if the editor offers it.
