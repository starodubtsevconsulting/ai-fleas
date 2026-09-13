# Default Governor strategy — v1

This is the default **strategy/workflow component** for a Cross-Workflow Governor strategy selection.

It defines how goals, priorities, workflow allocation, decisions, evidence, risks, and review are represented. It is portable and storage-independent.

## Structure

- governed subject reference
- active goals and priorities
- current primary bet when applicable
- workflow-to-goal relationships
- decisions and rationale
- hypotheses/opportunities kept separate from active goals
- risks and constraints
- strategic evidence
- review cadence and triggers
- authority boundaries

## Operating rule

The governed human owns goals. The Governor compares current evidence and opportunity cost against those goals and recommends allocation changes. Workflow awareness is strategic only and does not grant ordinary workflow execution.

## Required goal fields

For each goal keep, when applicable: id, intent, status, priority, rationale, horizon, constraints, success signals, workflows, dependencies, and review trigger.

## Required decision fields

For material decisions keep, when applicable: decision, context, rationale, alternatives, evidence, opportunity cost, confidence, owner, review trigger, and result.

## Cross-link

The selected human component supplies execution assumptions and evidence about the governed human. Human execution evidence may change planning assumptions without silently changing human-owned goals.
