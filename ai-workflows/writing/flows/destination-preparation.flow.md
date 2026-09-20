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
5. If this destination draft is new or has changed since the last independent review, Writer must immediately send the
   exact archived revision and exact destination draft to the verified Reviewer through the authorized review route.
   Creating or updating a destination draft implicitly authorizes this required internal review handoff; it does not
   require a second human prompt. Writer must not finish the destination-preparation request or describe the destination
   as reviewed until the Reviewer returns a destination-specific disposition. If Reviewer is unavailable, report the
   draft URL and `BLOCKED_DESTINATION_REVIEW` rather than silently omitting the handoff.

## Exit

Return to the archive flow, then automatically enter the [independent critique flow](independent-critique.flow.md) before release
readiness is claimed. If access, import, or rendering fails, preserve the archived article and report the exact
unfinished destination step. Never publish as a recovery action.
