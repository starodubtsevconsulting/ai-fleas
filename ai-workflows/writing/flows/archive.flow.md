# Archive flow

## Purpose

[Writing](../writing.workflow.md), steps 4 and 5. Maintain the configured article folder as permanent, editable
memory before and after destination preparation.

## Entry

An authorized article project, candidate or source article, existing archive layout, and current status metadata.

## Steps

1. The active writing task locates the intended article record, avoiding duplicate folders for the same work;
   proof: the selected archive path and any existing record.
2. The task copies or updates the canonical Markdown article without deleting or replacing unrelated files, and
   preserves source URL, language, diagrams' editable source, and other assets when available; proof: a read-back of
   the archived content against the candidate or source.
3. The task records draft/publication state, destination URL if one exists, selected topics/tags, independent
   critique and human-review status, release proposal versus actual scheduled/published state, and unresolved
   editorial decisions in the archive metadata; proof: metadata read-back. Never label a draft published merely
   because a submission screen was opened.
4. The task confirms a configured editor such as Obsidian opens the same folder through its registered project
   mapping; proof: the exact vault path, not its display name. External folder sync remains separate from the
   editor; do not create a redundant sync.

## Exit

After the first pass, continue to [destination preparation](destination-preparation.flow.md) when applicable.
After destination preparation, return to [independent critique](independent-critique.flow.md) with current draft
URL/status/topics recorded. On write or sync failure, keep the source intact and report what did and did not persist.
This flow never deletes archive material.
