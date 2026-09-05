# Proxy-backed Agent execution

Proxying is an Agent execution mechanism, not a Role. A proxy-backed Agent keeps its declared Role, Team authority,
identity and lifecycle while delegating actual work through a configured bridge to another Agent/model.

The Agent manifest uses structured configuration:

```yaml
execution:
  mode: proxy
  bridge: <registered-capability>
  target: <profile-resolved-target>
```

A bare proxy flag is insufficient because runtime must resolve the bridge, target, scope projection, correlation,
timeout, failure behavior and provenance. Missing required proxy execution fields make the Agent not ready.

Proxy execution never lends authority. The existing Role and Team matrices remain authoritative. The wrapper must not
perform the delegated work itself, broaden scope, discover an undeclared endpoint, or silently choose another target.

Direct and proxy-backed execution receive the same profile/workflow-resolved physical scope. Explicit outside-scope
paths are rejected before delegation and remain distinguishable from bridge, handshake and target failures.
