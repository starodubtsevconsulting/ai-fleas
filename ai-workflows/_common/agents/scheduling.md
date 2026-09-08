# Agent scheduling

Any logical agent may have a schedule. Scheduling is independent from continuity and from the agent's role.

A scheduled agent wakes at the configured interval, loads the configured instruction, performs that instruction within its existing authority, and returns until the next run.

The selected platform adapter implements the timer or scheduled trigger. It must preserve the logical agent identity and workflow scope.

Example:

```yaml
schedule:
  enabled: true
  every: 10m
  instruction: agents/schedules/example.yml
```

When `enabled` is false, no scheduled trigger is created for that agent.
