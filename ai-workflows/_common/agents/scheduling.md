# Agent scheduling

Any logical agent may have a schedule. Scheduling is independent from continuity and from the agent's role.

A scheduled agent wakes at the configured interval, loads the configured instruction, performs that instruction within its existing authority, and returns until the next run.

The selected platform adapter implements the timer or scheduled trigger. It must preserve the logical agent identity and workflow scope.

When an agent's initialization contract requires a schedule, scheduler bootstrap is a two-phase handshake. The platform
initializer creates the agent and supplies the portable schedule definition and initial scope. The initialized agent then
requests the selected platform adapter to create or reconcile its concrete timer, verifies the returned scheduler receipt,
and only then emits its readiness token. The agent owns later schedule-scope reconciliation; the adapter continues to own
platform-specific mechanics. This keeps heartbeat, cron, daemon, and other timer details out of portable initialization.

Example:

```yaml
schedule:
  enabled: true
  every: 10m
  instruction: agents/schedules/example.yml
```

When `enabled` is false, no scheduled trigger is created for that agent.
