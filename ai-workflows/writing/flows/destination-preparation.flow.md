# Destination preparation flow

## Purpose

[Writing](../writing.workflow.md), step 5. Format and verify an unpublished destination draft without releasing it.

## Entry

A verified archived article, explicit profile-selected destination set, permitted access, and existing draft identities
if one is already present.

## Steps

1. Resolve every selected destination independently through the profile's active `destinations[]` bindings. The profile may define one or several default destination IDs; an explicit article choice overrides that default set. Proof: selected destination IDs, bindings, archive reference, and existing/new draft identities. An open browser tab does not select a provider.
2. Run the remaining preparation and verification steps independently for each selected destination. One destination passing does not clear another; unsupported/unavailable destinations remain explicit pending blockers rather than being silently dropped.
2. The task invokes that destination command's contract and provider skill. The destination command owns editor
   formatting, visuals, topic/tag entry, and provider-specific verification; proof: a reviewed unpublished draft.
   Writer must inventory source visuals before conversion. When the source contains Mermaid or another non-native
   diagram format, Writer preserves its editable source, renders and exports it to a destination-supported image,
   uploads it at the intended passage, and verifies the actual rendered diagram at desktop and narrow layouts. Raw
   diagram syntax, a caption, alt text, or a prose label is not a converted diagram. Failed rendering or upload leaves
   the draft unpublished with `BLOCKED_DIAGRAM_RENDERING`.
   Writer must create a complete pre-conversion diagram inventory and reconcile every stable inventory ID to one
   rendered destination visual. After conversion, re-scan the full draft for unconverted arrow chains (`A → B → C`),
   `Diagram—` prose, Mermaid fences, raw syntax, captions without visuals, and other placeholders. Do not stop after
   converting one diagram. Any missing, duplicate, or residual item leaves `BLOCKED_DIAGRAM_RECONCILIATION`.
3. The task compares the destination draft with the canonical archived article and records intentional formatting
   differences or unresolved issues. It visually inspects the rendered beginning, middle, end, and every special block
   at a normal desktop viewport and a materially different narrow layout when supported. Source text, editor fields,
   and metadata read-back do not prove rendered quality; proof: draft-specific review notes plus direct rendered
   evidence such as screenshots, including blockquote spacing and attribution placement when blockquotes exist and
   source-to-destination visual reconciliation proving every inventoried diagram is visibly present exactly once and
   no diagram placeholder remains.
4. The task returns the destination URL, state, and topics/tags to the [archive flow](archive.flow.md); proof: metadata
   read-back and a human handoff. `draft-only` forbids Publish, Submit, and Schedule actions.
5. If this destination draft is new or has changed since the last independent review, Writer must immediately expose the
   exact archived revision, exact destination draft, and proposed review references through the Router result contract.
   Creating or updating a destination draft implicitly authorizes this required internal review handoff; it does not
   require a second human prompt. Writer must not finish the destination-preparation request or describe the destination
   as reviewed until the Router records a destination-specific Reviewer disposition. If routing is unavailable, report the
   draft URL and `BLOCKED_DESTINATION_REVIEW` rather than silently omitting the handoff.

## Exit

Return to the archive flow, then automatically enter the [independent critique flow](independent-critique.flow.md) before release
readiness is claimed. If access, import, or rendering fails, preserve the archived article and report the exact
unfinished destination step. Never publish as a recovery action.
