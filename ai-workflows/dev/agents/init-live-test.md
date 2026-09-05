# Development initialization acceptance

Use this acceptance contract only when managed-agent initialization is explicitly requested.

The standalone public-rules case passes when no host initializer is configured and the request returns
`BLOCKED_HOST_INITIALIZER` with zero task or repository mutation. A configured-host case passes only when the host proves
the selected profile, Dev workflow, exact work target, complete roster, communication topology, lifecycle implementation,
identity bindings, and permission boundary before creating any task.

A plain `init` is a separate positive case: it loads repository, profile, workflow, and project context and creates no
managed-agent task.
