# Destination preparation flow

## Purpose

[Writing](../writing.workflow.md), step 5. Format and verify an unpublished destination draft without releasing it.

## Entry

A verified archived article, explicit profile-selected destination, permitted access, and existing draft identity
if one is already present.

## Steps

1. The active writing task resolves the exact destination command, mode, and workflow-owned config path from the
   selected profile's active `destinations[]` binding; proof: the selected binding, registered archive reference,
   and existing/new draft URL. An open browser tab alone does not select a provider.
2. The task invokes that destination command's contract and provider skill. The destination command owns editor
   formatting, visuals, topic/tag entry, and provider-specific verification; proof: a reviewed unpublished draft.
3. The task compares the destination draft with the canonical archived article and records intentional formatting
   differences or unresolved issues; proof: draft-specific review notes.
4. The task returns the destination URL, state, and topics/tags to the [archive flow](archive.flow.md); proof: metadata
   read-back and a human handoff. `draft-only` forbids Publish, Submit, and Schedule actions.

## Exit

Return to the archive flow, then the [independent critique flow](independent-critique.flow.md) before release
readiness is claimed. If access, import, or rendering fails, preserve the archived article and report the exact
unfinished destination step. Never publish as a recovery action.
