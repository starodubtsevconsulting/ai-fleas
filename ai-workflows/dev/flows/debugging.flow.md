# Debugging flow

## Purpose

[Dev](../dev.workflow.md). Diagnose a concrete failure and return to the gate that exposed it.

## Entry

Known authorized target, candidate/environment, observed versus expected behavior, failure evidence, and diagnostic effects.
Diagnosis alone does not authorize a fix, instrumentation, new ticket, or deployment.

## Steps

1. Designer/Reviewer states a falsifiable question and selects the first implicated evidence surface.
2. Command Runner reproduces or collects scoped facts through the failing test/build or enabled profile-resolved log/
   [monitoring](../../../ai-commands/system/monitoring/monitoring.command.md) route; includes relevant correlation values.
3. Designer/Reviewer tests hypotheses against supporting and contradicting evidence; identifies a supported cause or missing proof.
4. Coder applies the smallest correction already within approved scope; returns focused source/test evidence.
5. Designer/Reviewer invokes [testing](testing.flow.md) to repeat the failed and invalidated gates for the corrected candidate.

## Exit

Return verified proof to the exact failed checkpoint, or preserve observations and the next diagnostic question with an
owner/action. Non-reproduction is not resolution, and an opened log link is not read evidence. Missing routes block capture;
materially different scope returns to [planning](planning.flow.md). Manager owns any authorized tracker update/follow-up.
