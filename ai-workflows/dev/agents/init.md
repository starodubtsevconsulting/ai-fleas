# Development managed-agent initialization

This is a host-neutral lifecycle gate for an explicitly requested managed-agent setup. It is not used by a plain `init`
or `initialize` request, which loads repository, profile, workflow, and project context only.

Managed-agent initialization requires all of the following:

- an explicit human request to initialize or reinitialize managed agents;
- one verified profile, Dev workflow, and exact profile-authorized work target;
- the common [workflow-agent contract](../../agents.md);
- a complete host-owned roster, communication topology, lifecycle implementation, and identity binding;
- a host permission boundary that permits the requested task lifecycle changes.

If any requirement is missing, return `BLOCKED_HOST_INITIALIZER` and create, modify, message, archive, or replace nothing.
Do not infer a companion, inspect a sibling implementation in search of one, or treat filesystem reachability as a host
binding. A companion may implement this gate only when the selected profile or an explicit human instruction names it.
