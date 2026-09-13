# Default Governor strategy — v1

This is the default **strategy/workflow component** for a Cross-Workflow Governor strategy selection.

A strategy component may compose reusable methods rather than duplicating their behavior.

## Methods

- [`external-feedback-loop@v1`](../../methods/external-feedback-loop/v1.md)

## Structure

Maintain, in external strategy instance data when applicable:

- governed subject reference
- active goals and priorities
- current primary bet
- workflow-to-goal relationships
- decisions and rationale
- hypotheses/opportunities separate from active goals
- risks and constraints
- strategic evidence
- review cadence and triggers
- relevant external actions, intended responses, observed responses, and learned adaptations

## Operating rule

The governed human owns goals. The Governor compares evidence and opportunity cost against those goals and recommends allocation changes. Workflow awareness is strategic only and does not grant ordinary workflow execution.

The external-feedback-loop method adds an outward-facing learning cycle: actions taken through the human or configured workflows can change the surrounding environment; external responses become evidence; mismatches between intended and observed response should lead to diagnosis and adaptation.

Public projection, publication, outreach, networking, positioning changes, releases, and similar actions are possible action classes inside that method. They are not goals by themselves and are used only when they support an active goal.

## Required goal fields

For each goal keep, when applicable: id, intent, status, priority, rationale, horizon, constraints, success signals, workflows, dependencies, and review trigger.

## Required decision fields

For material decisions keep, when applicable: decision, context, rationale, alternatives, evidence, opportunity cost, confidence, owner, review trigger, and result.

## Cross-link

The selected human component supplies execution assumptions and evidence about the governed human. The strategy component supplies goal direction to the human component. Internal execution evidence and external-world feedback can both change planning assumptions without silently changing human-owned goals.
