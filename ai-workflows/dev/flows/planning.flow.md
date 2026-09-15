# Planning flow

## Purpose

[Dev](../dev.workflow.md), step 2. Produce a bounded plan for new or resumed implementation.
Read-only questions and direct administration do not require product planning.

## Entry

Known authorized target, requested outcome, and existing source/plan evidence. Manager resolves tickets and staffing
when applicable. Role authority remains with the [Team](../agents/team.md); protected governance remains Judge-owned.

## Steps

1. Designer/Reviewer reconciles requirements with source and current delivery evidence; retains verified completed work.
2. Designer/Reviewer defines scope, acceptance, design, dependency order, owned steps, and applicable proof in the plan below.
3. Designer/Reviewer presents the plan and resolves material decisions with the human; approval follows existing policy.
4. Designer/Reviewer preserves the plan and next unfinished step through the selected recovery mechanism; the existing
   [plan command](../../../ai-commands/utility/plan/plan.command.md) applies when enabled.
5. Manager synchronizes tracker-facing content when configured, applicable, and authorized through
   [ticket-tracker](../../../ai-commands/connect/ticket-tracker/ticket-tracker.command.md), preserving component groups,
   verifying readback, and leaving unrelated human-authored content intact.

## Plan output

- Scope, repositories, acceptance criteria, exclusions, constraints, and material questions.
- Resumed baseline: verified done with evidence, partial, not started, or unknown; forward steps contain only unresolved work.
- Written design and useful diagrams; component dependencies and outcome milestones when needed.
- Checklist: one configured owner and expected proof per step. Keep small work flat; group multi-component work in dependency order.
- Per-component verification/delivery applicability: documentation, tests, review, UI, demo, deployment, release, and final versions
  as relevant. No listed gate is automatically required.
- Recovery point: completed evidence, blockers, next ready step, owner/action.

The plan is this flow’s output. Existing command formatting and tracker/recovery contracts remain authoritative.
Before the next step, check the plan against new evidence. Material changes return to the planning owner/human;
failed existing checks use bounded correction without another approval cycle. Preserve valid work and pause disputed scope.

## Exit

Once decisions and required persistence pass, return to Dev step 3; already-delivered work returns to the next unfinished
acceptance/closure gate. Missing identity, decisions, or required sync blocks dependent implementation with a recorded
owner/action and resume point. Local notes do not prove a successful external write.
