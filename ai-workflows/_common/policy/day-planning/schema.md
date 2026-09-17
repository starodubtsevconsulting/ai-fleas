# Day-planning strategy contract

A Personal Governor day-planning configuration has three layers:

1. **Base strategy** — reusable method for constructing a day.
2. **Profile parameters** — governed-person-specific boundaries, preferences, constraints, and capacity assumptions.
3. **Temporary overlays** — evidence-triggered modifications for the current planning horizon.

## Minimal binding

```yaml
dayPlanning:
  strategy: fixed-schedule-time-blocking
```

## Parameterized binding

```yaml
dayPlanning:
  strategy: fixed-schedule-time-blocking
  boundaries:
    wake: "06:30"
    seriousWorkStop: "17:00"
    electronicsOff: "21:30"
    targetSleep: "22:30"
  primaryGoal:
    preferredDaypart: morning
```

## Invariants

- Strategies must not invent or replace human-owned goals.
- Exact personal schedules must not be hard-coded into reusable strategy files.
- Temporary capacity changes should modify allocation without silently rewriting long-term strategy.
- Calendar writes and other external effects remain subject to the Personal Governor's normal authority rules.
- The human can override planning choices and strategy selection.
- Repeated execution evidence may justify proposing a parameter or strategy change.
