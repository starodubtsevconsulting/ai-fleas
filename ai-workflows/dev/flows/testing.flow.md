# Testing flow

## Purpose

[Dev](../dev.workflow.md), step 4 and applicable verification checkpoints. Produce current behavioral proof using the
[shared evidence rules](../../_common/flows/contract.md#evidence-and-recovery).

## Entry

Known target/component, plan step, candidate/environment, expected behavior, eligible gate, and permitted effects.
Later parent gates stay pending; entering testing does not move them earlier.

## Steps

1. Designer/Reviewer selects the next eligible gate and expected proof using [testing guidance](../guides/testing.md).
2. Command Runner executes authorized registered checks, including [test](../../../ai-commands/development/test/test.command.md);
   returns terminal conclusions and candidate-bound evidence.
3. Designer/Reviewer compares observations with acceptance, including required event/persistence/runtime effects.
4. UI Acceptance Tester supplies the matching independent visible receipt at the parent UI checkpoint, when required.
5. Designer/Reviewer records gate results and the next unfinished checkpoint; automated, review, UI, and human proofs stay distinct.

## Exit

Return to the invoking implementation/review/deployment checkpoint with current proof or a blocker. Use
[debugging](debugging.flow.md) for failed gates; repeat failed and invalidated checks after correction or relevant
source/base/artifact/environment changes. Preserve valid evidence; a required failure blocks its dependent decision.
