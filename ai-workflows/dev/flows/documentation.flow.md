# Documentation flow

## Purpose

[Dev](../dev.workflow.md), implementation/review. Keep affected durable documentation current with the resulting system.

## Entry

Known component, design, candidate, existing documentation, and authoritative source/schema/configuration evidence.
No affected durable surface means not applicable with a reason. Protected governance remains Judge-owned.

## Steps

1. Designer/Reviewer identifies affected facts and the smallest existing documentation surface.
2. Designer/Reviewer specifies contracts, invariants, edge cases, and useful diagrams supported by the candidate.
3. Coder updates product documentation through the existing [doc](../../../ai-commands/content/doc/doc.command.md) principles;
   returns the reviewable document in the relevant change.
4. Command Runner supplies applicable link/schema/diagram/repository check results.
5. Designer/Reviewer verifies factual alignment and discoverability before claiming reviewability or acceptance.

## Exit

Return to the invoking implementation/review checkpoint with current documentation or justified exclusion. Conflicting
sources block disputed claims and return to planning/debugging; review-discovered drift requires a same-scope correction
and affected rechecks. PR/tracker narration does not replace durable system documentation.
