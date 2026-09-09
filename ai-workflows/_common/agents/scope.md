# Agent scope

Every initialized agent declares a `scope`.

- `workflow` means the agent belongs to one workflow logical project/group.
- `system` means the agent exists outside workflow logical projects/groups and may operate across them only through explicitly granted system capabilities.

Scope defines where an agent belongs, not what it may access. Cross-scope access still requires explicit authority.

A system-scoped agent is not part of any workflow-group lifecycle transaction. Ordinary workflow initialization, reconciliation, reinitialization, and deletion leave it unchanged. System lifecycle uses an explicit system initialization/reinitialization operation. Only one active System agent may exist for a selected platform binding.

Scope does not choose where an agent runs or which provider/model it uses. Those are resolved by the selected profile and platform implementation.
