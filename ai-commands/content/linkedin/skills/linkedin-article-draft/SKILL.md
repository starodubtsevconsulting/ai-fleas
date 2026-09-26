---
name: linkedin-article-draft
description: Prepare and verify an unpublished LinkedIn Article through an authorized signed-in browser session. Do not publish.
---

# LinkedIn Article draft

Use only through an authorized LinkedIn destination or explicit human request. This skill prepares an unpublished Article; it never authorizes Publish or Schedule.

1. Resolve the canonical article/revision/assets and configured archive. Verify the signed-in LinkedIn identity against `account_profile_url`. Check archive/browser evidence for an existing draft before creating another.
2. Open LinkedIn's Article editor for the intended author/profile. Use current semantic controls, not saved coordinates. Transfer the canonical title and body, then inspect the actual editor representation. Repair raw Markdown, lost emphasis, heading/list/quote/code structure, broken links, image placement, duplicated paragraphs, and spacing. Do not add LinkedIn-specific headings or promotional copy merely to fill the surface.
3. Preserve the article's editorial structure while adapting only where LinkedIn requires it. Record every intentional destination difference. Do not silently shorten or rewrite the canonical article; a materially different LinkedIn adaptation is a new representation requiring review.
4. Apply the canonical Writing header-image contract. Upload the accepted lead image, preserve provenance/credit requirements, and inspect the actual crop/placement. Missing or rejected header imagery remains a blocker.
5. Build a complete source visual/diagram inventory before conversion. Preserve editable Mermaid/diagram sources in the archive; render unsupported diagrams to a LinkedIn-supported image and verify each appears exactly once at the intended passage. Re-scan the full Article for Mermaid fences, raw diagram syntax, `Diagram—` prose, arrow-chain placeholders, orphaned captions/alt text, missing or duplicate visuals. Any mismatch reports `BLOCKED_DIAGRAM_RECONCILIATION`.
6. Verify every link, quotation/attribution, image credit, caption, and special block. Inspect the rendered/editor view from beginning through middle and end, plus every visual. If LinkedIn provides a preview surface, inspect it too. Check narrow/mobile presentation when the available browser tooling supports it; otherwise record that narrow-layout verification is pending.
7. Keep platform metadata/promotional framing separate from the canonical article. Do not invent hashtags, mentions, audience claims, or calls to action. Add them only when the article brief/profile explicitly requests them and verify them as editorial copy.
8. Return the LinkedIn draft identity/URL or strongest stable browser evidence, exact source revision, state, destination differences, and unresolved issues for archive recording. Read back the saved draft when LinkedIn exposes it.
9. Stop unpublished. Writer must never press Publish or Schedule from this skill. If account identity, editor access, save state, rendering, assets, or draft identity cannot be verified, report the exact blocker; publishing is never a recovery action.

LinkedIn UI may change. Prefer live labels/semantics and visual verification over remembered layout.
