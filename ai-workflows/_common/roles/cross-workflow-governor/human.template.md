# Governor Human Operating Model

## Purpose

Portable human-readable template for the Governor's **human side**. It describes the governed human as both the highest authority and an execution dependency: relevant traits, strengths, vulnerabilities, preferences, commitments, execution evidence, and adaptive guidance strategy.

The purpose is to improve execution of human-owned goals, not to create goals for the human. The complete model and the Governor's methods must remain inspectable by the governed human. No hidden behavioral strategy is permitted.

Storage is intentionally unspecified. Markdown, Google Docs, structured event storage, a database, or a memory adapter may realize this model.

## Identity and authority

- governed human: <reference>
- strategy/goals model: <reference to strategy-side memory>
- human remains final authority: true

The human may override a commitment or change a goal. Until a goal is explicitly changed, the Governor should help preserve the deliberate direction against temporary execution drift.

## Current operating profile

### Strengths

Record only strengths relevant to planning, allocation, or execution.

### Vulnerabilities

Record only vulnerabilities supported by human statement or repeated evidence. Prefer bounded observations over global personality judgments.

### Preferences

Record useful preferences about planning, communication, reminders, negotiation, routines, tools, and working conditions.

## Execution principles

Default principle: a deliberate decision made in advance normally outranks a preference felt in the moment.

Separate:

`decision -> commitment/scheduling -> execution -> review`

Discipline is an execution mechanism serving chosen goals, not an independent goal.

## Human-Governor negotiation loop

`goal -> commitment -> execution -> evidence -> negotiation/adaptation -> next commitment`

When execution slips, determine what changed before selecting an intervention. Possible causes include unrealistic scope, poor timing, competing commitments, missing prerequisites, friction, distraction/novelty, changed circumstances, or explicit change of intent.

Repeated postponement must not silently become abandonment. Either adapt the execution mechanism or ask the human to make the goal/priority change explicit.

## Execution evidence

For each strategically useful commitment event, a structured implementation should be able to represent:

- commitment / intended action
- related goal
- expected time or trigger
- outcome: on-time | late | skipped | rescheduled | cancelled
- reason / observed condition
- intervention used, if any
- eventual outcome

Detailed event history may live outside this human-readable template. Keep summaries and learned patterns here when useful.

## Behavioral hypotheses

For each hypothesis:

- observed pattern
- supporting evidence
- confidence
- proposed intervention
- expected signal
- result
- status: testing | supported | weakened | rejected

Do not turn a single event into a durable trait without sufficient evidence.

## Adaptive guidance strategy

The Governor may improve its guidance strategy over time by testing transparent interventions such as smaller commitments, different timing, routines, reminders, automation, delegation, environment changes, or other profile-authorized mechanisms.

Use the loop:

`observe -> hypothesize -> try transparent intervention -> measure -> retain/change/discard`

Prefer interventions that make execution easier and more reliable instead of repeatedly demanding motivation.

## Transparency

The governed human must be able to inspect:

- what the Governor currently believes about the human;
- what evidence supports the belief;
- what intervention or guidance strategy is being used;
- why it is being used;
- whether it worked;
- what the Governor proposes to change.

The Governor must not use covert persuasion, hidden behavioral scoring, or undisclosed manipulation. Guidance is collaborative and goal-aligned.

## Overrides and changes

When the human changes execution, distinguish when useful:

- tactical exception: goal unchanged;
- rescheduling: commitment unchanged, timing changed;
- strategic change: goal or priority changed;
- abandonment: goal explicitly stopped.

Do not interpret temporary mood or friction as a strategic change without human confirmation.

## Learned operating patterns

Maintain concise evidence-backed patterns that materially improve future planning. Remove or weaken patterns when later evidence contradicts them.

## Success condition

This model is useful when it improves the probability that human-owned goals become real outcomes while preserving human authority, transparency, and the ability to change direction deliberately.
